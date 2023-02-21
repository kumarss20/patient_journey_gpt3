
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Loading } from 'react-simple-chatbot';

import Speech from 'speak-tts'


const CONFIDENTIAL = "[CONFIDENTIAL]";
const speech = new Speech()
require('dotenv').config()


const { Configuration, OpenAIApi } = require("openai");
const neo4j = require('neo4j-driver')

const driver = neo4j.driver(process.env.REACT_APP_NEO4JURI, neo4j.auth.basic(process.env.REACT_APP_NEO4JUSER, process.env.REACT_APP_NEO4JPASSWORD))


// const session = driver.session({database:"diagnosis"})
const session = driver.session()

const configuration = new Configuration({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

//console.log("OPENAI_API_KEY", process.env.OPENAI_API_KEY);


speech.init({
  'volume': 1,
  'lang': 'en-GB',
  'rate': 1,
  'pitch': 1,
  'voice': 'Google UK English Male',
  'splitSentences': true,
  'listeners': {
    'onvoiceschanged': (voices) => {
      console.log("Event voiceschanged", voices)
    }
  }
})

class DoctorAI extends Component {
  constructor(props) {
    super(props);
    // console.log('bot initialized')
    this.state = {
      loading: true,
      result: ''
    };

    this.triggetNext = this.triggetNext.bind(this);
  }

  callDoctorAI() {

    const self = this;
    const { steps } = this.props;
    const search = steps.user.value;
    async function callAsync() {
      let training = `

#pull me the details of patient patient_id 
MATCH (p:Patient) WHERE p.id = 'patient_id' RETURN p

#I'm looking for details on last doctor visit ?
MATCH (p:Patient)-[:HAS_ENCOUNTER]-(e:Encounter) WHERE p.id =~ '(?i)ddf50bb2-d65f-48cc-904f-b02528d90d43' RETURN e LIMIT 1

#I'm looking for details on all my previous doctor visit ?
MATCH (p:Patient)-[:HAS_ENCOUNTER]-(e:Encounter) WITH * WHERE e.description is not null AND n.id =~ '(?i)ddf50bb2-d65f-48cc-904f-b02528d90d43' RETURN "Date : " + e.date + "Reason for visit :" + e.description

#Do i have any conditions observed during my last visit ?
MATCH (n:Patient)-[:HAS_ENCOUNTER]-(e:Encounter) WHERE e.description is not null AND n.id = 'ddf50bb2-d65f-48cc-904f-b02528d90d43' WITH * order by e.date DESC  LIMIT 1 OPTIONAL MATCH (e)-[:HAS_CONDITION]-(c:Condition) RETURN DISTINCT coalesce(c.description, 'no conditions observed')

#Is there any drugs prescribed during my last visit ? 
MATCH (n:Patient)-[:HAS_ENCOUNTER]-(e:Encounter) WHERE e.description is not null  AND n.id = 'ddf50bb2-d65f-48cc-904f-b02528d90d43' WITH * order by e.date DESC  LIMIT 1 OPTIONAL MATCH (e)-[:HAS_DRUG]-(c:Condition) RETURN DISTINCT coalesce(c.description, 'no drugs prescribed')

#What are the most common preconditions for stroke ?
MATCH (cn:Condition) WHERE toLower(cn.description) contains 'stroke'
WITH cn.code as code
CALL { WITH code WITH code MATCH (c:Condition {code:code})<-[:HAS_CONDITION]-(e:Encounter)<-[:NEXT*1..4]-(pree:Encounter)-[:HAS_CONDITION]-(c1:Condition)
WITH c, e,  COLLECT(DISTINCT c1.description) as preconditions WITH apoc.coll.frequencies(apoc.coll.flatten(COLLECT(preconditions))) as precondns
UNWIND precondns as precondn WITH precondn.item as precondition,  precondn.count as no_of_occurences ORDER BY no_of_occurences DESC  WITH * LIMIT 2 WITH COLLECT(precondition) as most_common_preconditions
RETURN 'Sure, the most common precondtions are \n'+ apoc.text.join(most_common_preconditions, ',\n') as preconditions
} RETURN preconditions


#pull up last 10 visit details for patient patient_id
MATCH (p:Patient {id:'patient_id'})-[:HAS_ENCOUNTER]->(e:Encounter)-[:NEXT*]->(e1)-[:HAS_PROCEDURE]->(pr:Procedure), (e1)-[:HAS_CONDITION]->(c:Condition) WITH DISTINCT date(datetime(e.date)) as visit_date , c.description as condition, pr.description as prod RETURN apoc.text.join(['On ',toString(visit_date),'visited for ',condition,'check','and the procedure performed is',prod],' ') as res  LIMIT 10

#What drugs are often prescribed for condition?
MATCH (c:Condition) WHERE toLower(c.description) CONTAINS toLower('hypertension') WITH c.code as code CALL { with code with code MATCH (c:Condition {code:code})<-[:HAS_CONDITION]-(e:Encounter) WITH c, COUNT(e) as total_encounter MATCH (c)<-[:HAS_CONDITION]-(e:Encounter)-[:HAS_DRUG]-(d:Drug) WITH total_encounter, d.description as drug,COUNT(e) as no_of_times_precribed  RETURN drug, (toFloat(no_of_times_precribed)/toFloat(total_encounter))*100 as percentage} 
WITH drug, round(percentage * 100)/100 AS percentage order by percentage DESC LIMIT 10
RETURN apoc.text.join([drug ,' : ', toString(percentage), '%'],'')

#what are the insurance claim details for patient patient_id ?
MATCH (p:Patient{id:'patient_id'})-[:HAS_ENCOUNTER]->(e:Encounter)-[:HAS_CONDITION]->(c:Condition), (e)-[:HAS_PAYER]->(pr:Payer)
WHERE e.description is not null
WITH c.description as description, SUM(e.baseCost) as base_cost,SUM(e.claimCost) as claimed_cost, SUM(e.coveredAmount) as covered_amount, pr.name as insurance_provider
RETURN apoc.text.join(['𝐂𝐨𝐧𝐝𝐢𝐭𝐢𝐨𝐧 :', description, ' \n𝐁𝐚𝐬𝐞 𝐜𝐨𝐬𝐭 : ', toString(base_cost), ' \n𝐂𝐥𝐚𝐢𝐦𝐞𝐝 𝐜𝐨𝐬𝐭 : ', toString(claimed_cost),  ' \n𝐂𝐨𝐯𝐞𝐫𝐞𝐝 𝐚𝐦𝐨𝐮𝐧𝐭', toString(covered_amount),'\n𝑰𝒏𝒔𝒖𝒓𝒂𝒏𝒄𝒆 𝒑𝒓𝒐𝒗𝒊𝒅𝒆𝒓 : ', insurance_provider],'') as result
#`;

      console.log("Sending prompt to chatGPT and waiting for resposne as a cypher query \n The promot text is ", search)
      let query = training + search + "\n"

      let textToSpeak = ''
      try {
        // console.log("promptWithContext", promptWithContext)
        var startTime_gpt = performance.now()
        if (search) {

          const response = await openai.createCompletion("text-davinci-002", {
            prompt: query,
            temperature: 0,
            max_tokens: 800,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop: ["#", ";"],
          });


          // console.log('response:', response);
          let cypher = response.data.choices[0].text;
          console.log('Response from openAI chatGPT: \n' + cypher);
          var endTime_gpt = performance.now()

          console.log(`chatGPT query execution time ${endTime_gpt - startTime_gpt} milliseconds`)

          try {
            var startTime = performance.now()
            const result = await session.run(cypher)
            var endTime = performance.now()

            console.log(`neo4j query execution time ${endTime - startTime} milliseconds`)

            //const singleRecord = result.records[0]

            const records = result.records

            records.forEach(element => {
              if(element.length === 1)
                textToSpeak += element.get(0) + "\n "
              else 
                textToSpeak = 'skip'
            });

            //textToSpeak = singleRecord.get(0)
            textToSpeak = textToSpeak.slice(0, -2)
            self.setState({ loading: false, result: textToSpeak });

            // console.log("records", records)
          } finally {
            //await session.close()
          }

          // on application exit:
          //await driver.close()
        }
      }
      catch (error) {
        //console.log(process.env);
        console.error(error)
        console.log('Doctor AI:' + textToSpeak);
        textToSpeak = "Sorry I can't answer that. Could you please try again?"
      }

      let isConfidential = false;
      if (textToSpeak.startsWith(CONFIDENTIAL)) {
        isConfidential = true;
        // textToSpeak = textToSpeak.substring(CONFIDENTIAL.length)
      }


      if (isConfidential || textToSpeak.length > 115 || textToSpeak === 'skip') {
        speech.speak({ text: "Please find the information below" })
          .then(() => { console.log("Success !") })
          .catch(e => { console.error("An error occurred :", e) })
      } else {
        speech.speak({ text: textToSpeak })
          .then(() => { console.log("Success !") })
          .catch(e => { console.error("An error occurred :", e) })
      }

    }
    callAsync();
  }

  triggetNext() {
    this.setState({}, () => {
      this.props.triggerNextStep();
    });
  }

  componentDidMount() {
    this.callDoctorAI();
    this.triggetNext();
  }

  render() {
    const { loading, result } = this.state;
    const lines = result.split("\n");
    const elements = [];
    
    for (const [index, value] of lines.entries()) {
      elements.push(<span key={index}>{value}<br /></span>)
    }

    return (
      <div className="bot-response">
        {loading ? <Loading /> : elements}
      </div>
    );
  }
}

DoctorAI.propTypes = {
  steps: PropTypes.object,
  triggerNextStep: PropTypes.func,
};

DoctorAI.defaultProps = {
  steps: undefined,
  triggerNextStep: undefined,
};

export default DoctorAI;
