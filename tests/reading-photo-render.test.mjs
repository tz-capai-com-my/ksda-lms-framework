import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
test('photo reading renders two translated scenes and optional speech without legacy diagrams',async()=>{
 const root=resolve(import.meta.dirname,'..'),temp=resolve(root,'.render-test');await mkdir(temp,{recursive:true});
 const result=await build({entryPoints:[resolve(root,'app/learn/CompanionReading.tsx')],bundle:true,platform:'node',format:'esm',packages:'external',write:false,jsx:'automatic'});
 const file=resolve(temp,'reader.mjs');await writeFile(file,result.outputFiles[0].text);
 try{
  const {MissionReading}=await import(pathToFileURL(file));
  const mission={mission_id:'photo-fixture',course_key:'fixture',title:{en:'Story',ms:'Cerita'},bridge:{en:'Lead',ms:'Pembukaan'},sections:[{id:'s1',type:'knowledge',ksda_stage:'K',title:{en:'Section',ms:'Bahagian'},block_ids:['p1'],paragraphs:[{en:'Paragraph',ms:'Perenggan'}]}],questions:[],reflection_feedback:[],knowledge_check:{id:'k1',prompt:{en:'Check',ms:'Semak'},options:[]},notes_prompt:{en:'Note',ms:'Nota'},declaration:{en:'Declaration',ms:'Pengakuan'},review_holds:[],pilot_spoken_prompt:{en:'I can pause.',ms:'Saya boleh berhenti seketika.'},editorial_photos:{opening:{asset_id:'opening',width:1672,height:941,alt:{en:'Opening scene',ms:'Adegan pembukaan'},caption:{en:'First moment',ms:'Detik pertama'}},closer:{asset_id:'closer',width:1536,height:1024,alt:{en:'Closer scene',ms:'Adegan penutup'},caption:{en:'Second moment',ms:'Detik kedua'},after_section:'s1'}}};
  for(const locale of ['en','ms']){
   const html=renderToStaticMarkup(React.createElement(MissionReading,{mission,envelope:{release_id:'fixture',revision_hash:'a'.repeat(64),progress_scope:'learner'},locale,embedded:true,apiPath:'/learn/api/reading?scope=learner'}));
   assert.equal((html.match(/<img /g)||[]).length,2);assert.match(html,/width="1672" height="941"/);assert.match(html,/width="1536" height="1024"/);
   assert.match(html,new RegExp(mission.editorial_photos.opening.alt[locale]));assert.match(html,new RegExp(mission.pilot_spoken_prompt[locale]));
   assert.match(html,/scope=learner/);assert.match(html,/asset=opening/);assert.match(html,/asset=closer/);assert.match(html,/loading="lazy"/);assert.match(html,/reading-notes/);assert.doesNotMatch(html,/CAPAi|capai\.com\.my/);assert.doesNotMatch(html,/undefined|<audio|<video|type="file"/);
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
