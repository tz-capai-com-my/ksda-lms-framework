import test from 'node:test';
import assert from 'node:assert/strict';
import {validProgressBody,verifyEnvelope,sha256} from '../app/reading-review/model.ts';
test('reading saves reject answer text, notes, user IDs, percentages and invalid origins',()=>{
 const valid={release:'ksda-independent-test-fixture',mission:'topic-alpha',revision:'a'.repeat(64),reviewed:{'one':'viewport_dwell','two':'self_confirmed'},last:'two'};
 assert.equal(validProgressBody(valid),true);
 for(const extra of [{notes:'private note'},{answers:['answer']},{user_id:'different-user'},{percentage:100},{lang:'ms'}])assert.equal(validProgressBody({...valid,...extra}),false);
 for(const reviewed of [{one:null},{one:true},{one:100},{one:'watched'},['one'],'text'])assert.equal(validProgressBody({...valid,reviewed}),false);
});
test('preview accepts only the exact database manifest and mission revision',async()=>{
 const mission={mission_id:'topic-alpha',sections:[{id:'topic-alpha-detail-1',block_ids:['paragraph-1']}]};
 const payload=JSON.stringify(mission),revision=await sha256(payload);
 const manifest=JSON.stringify({source_manifest_hash:'b'.repeat(64),asset_manifest_hash:'c'.repeat(64),code_manifest_hash:'d'.repeat(64),release_id:'ksda-independent-test-fixture',missions:[{mission_id:'topic-alpha',revision_hash:revision}]});
 const envelope={source_hash:'b'.repeat(64),asset_hash:'c'.repeat(64),code_hash:'d'.repeat(64),release_id:'ksda-independent-test-fixture',publication_active:false,progress_scope:'preview',manifest_text:manifest,content_hash:await sha256(manifest),payload_text:payload,revision_hash:revision,block_ids:['paragraph-1']};
 await verifyEnvelope(envelope);
 for(const change of [{payload_text:payload+' '},{manifest_text:manifest+' '},{block_ids:['other']},{publication_active:true},{progress_scope:'live'},{asset_hash:'e'.repeat(64)},{code_hash:'e'.repeat(64)},{source_hash:'e'.repeat(64)}])await assert.rejects(verifyEnvelope({...envelope,...change}),/INTEGRITY_ERROR/);
 const held=JSON.stringify({mission_id:'topic-alpha',sections:[{id:'held-section',block_ids:['paragraph-1']}]});
 const badManifest=JSON.stringify({excluded_section_ids:['held-section'],source_manifest_hash:'b'.repeat(64),asset_manifest_hash:'c'.repeat(64),code_manifest_hash:'d'.repeat(64),release_id:envelope.release_id,missions:[{mission_id:'topic-alpha',revision_hash:await sha256(held)}]});
 await assert.rejects(verifyEnvelope({...envelope,payload_text:held,revision_hash:await sha256(held),manifest_text:badManifest,content_hash:await sha256(badManifest)}),/REVISION_INTEGRITY_ERROR/);
});
test('editorial bindings accept PNG or WebP only and retain exact dimensions and mission identity',async()=>{
 const copy={en:'Scene',ms:'Adegan'},photo=asset_id=>({asset_id,width:2,height:3,alt:copy,caption:copy});
 const mission={mission_id:'topic-alpha',sections:[{id:'topic-alpha-detail-1',block_ids:['paragraph-1']}],editorial_photos:{opening:photo('one'),closer:{...photo('two'),after_section:'topic-alpha-detail-1'}}};
 const payload=JSON.stringify(mission),revision=await sha256(payload);
 for(const format of ['image/png','image/webp','image/gif','text/html']){
  const assets=['one','two'].flatMap(visual_id=>['en','ms'].map(locale=>({visual_id,locale,mission_id:'topic-alpha',format,width:2,height:3,sha256:'a'.repeat(64)})));
  const manifest=JSON.stringify({source_manifest_hash:'b'.repeat(64),asset_manifest_hash:'c'.repeat(64),code_manifest_hash:'d'.repeat(64),release_id:'ksda-independent-test-fixture',missions:[{mission_id:'topic-alpha',revision_hash:revision}],assets});
  const envelope={source_hash:'b'.repeat(64),asset_hash:'c'.repeat(64),code_hash:'d'.repeat(64),release_id:'ksda-independent-test-fixture',publication_active:false,progress_scope:'preview',manifest_text:manifest,content_hash:await sha256(manifest),payload_text:payload,revision_hash:revision,block_ids:['paragraph-1']};
  if(format==='image/png'||format==='image/webp')await verifyEnvelope(envelope);else await assert.rejects(verifyEnvelope(envelope),/REVISION_INTEGRITY_ERROR/);
 }
});
