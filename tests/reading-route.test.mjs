// Actual built worker, synthetic Supabase HTTP fixture; no production connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {READING_CODE_HASH} from '../app/learn/reading-build.ts';
import {lossy} from './fixtures/reading-webp.mjs';
register('./cloudflare-workers-loader.mjs',import.meta.url);
process.env.SUPABASE_URL='https://frameworkexample.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_offline_fixture';
process.env.KSDA_READING_DELIVERY_ENABLED='true';
const hash=b=>createHash('sha256').update(b).digest('hex');
const origin='https://learning.example.com';
const user={id:'00000000-0000-4000-8000-000000000123',aud:'authenticated',role:'authenticated',email:'reader@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const session={access_token:'offline-reading-fixture',refresh_token:'offline-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const cookie='sb-frameworkexample-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
const release='ksda-independent-runtime-fixture',mission='custom-topic';
const payload=JSON.stringify({mission_id:mission,course_key:'custom-course',sections:[{id:'section',block_ids:['one','two']}]});
const revision=hash(payload),sourceHash='b'.repeat(64),assetHash='c'.repeat(64);
const manifest=JSON.stringify({release_id:release,source_manifest_hash:sourceHash,asset_manifest_hash:assetHash,code_manifest_hash:READING_CODE_HASH,missions:[{mission_id:mission,course_key:'custom-course',revision_hash:revision,block_count:2}]});
let writes=[],brokenCode=false,denyAsset=false,assetCalls=0,readingCalls=0;
globalThis.fetch=async(input,init)=>{
 const req=new Request(input,init),url=new URL(req.url);
 assert.equal(url.origin,process.env.SUPABASE_URL,'No external destination is allowed');
 assert.equal(req.headers.get('authorization'),'Bearer '+session.access_token,'Only independently authenticated session authority is sent');
 if(url.pathname==='/auth/v1/user')return Response.json(user);
 if(url.pathname==='/rest/v1/rpc/ksda_reading_delivery'){
  readingCalls++;const body=await req.json();assert.equal(body.p_scope,'learner');
  return Response.json({release_id:release,status:'approved',source_hash:sourceHash,asset_hash:assetHash,code_hash:brokenCode?'f'.repeat(64):READING_CODE_HASH,manifest_text:manifest,content_hash:hash(manifest),payload_text:payload,revision_hash:revision,block_ids:['one','two'],publication_active:true,progress_scope:'learner',progress:{reviewed:{},last_block_id:null,updated_at:null}});
 }
 if(url.pathname==='/rest/v1/rpc/ksda_reading_delivery_progress'){
  const body=await req.json();writes.push(body);
  assert.deepEqual(Object.keys(body).sort(),['p_scope','p_release','p_mission','p_revision','p_reviewed','p_last'].sort());
  return Response.json({reviewed:body.p_reviewed,last_block_id:body.p_last,updated_at:'2026-09-29T00:00:00Z'});
 }
 if(url.pathname==='/rest/v1/rpc/ksda_reading_delivery_asset'){
  assetCalls++;
  if(denyAsset)return Response.json({code:'42501',message:'Independent fixture denial'},{status:403});
  return Response.json({body:lossy.toString('base64'),encoding:'base64',hash:hash(lossy),expected_hash:hash(lossy),mime:'image/webp',width:2,height:3,code_hash:READING_CODE_HASH});
 }
 throw new Error('Unexpected offline request: '+url.pathname);
};
const worker=(await import('../dist/server/index.js')).default;
const bindings={ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},ctx={waitUntil(){},passThroughOnException(){}};
const url='/learn/api/reading?scope=learner';
function request(path=url,{body,cookieValue=cookie,requestOrigin=origin,extraHeaders={}}={}){
 return worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookieValue,accept:'application/json',...(body===undefined?{}:{'content-type':'application/json',origin:requestOrigin}),...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings,ctx);
}
const save={release,mission,revision,reviewed:{one:'self_confirmed'},last:'one'};
test('reading transport has explicit feature opt-in and requires own learner session',async()=>{
 process.env.KSDA_READING_DELIVERY_ENABLED='false';assert.equal((await request()).status,404);process.env.KSDA_READING_DELIVERY_ENABLED='true';
 assert.equal((await request(url,{cookieValue:'',extraHeaders:{'oai-authenticated-user-email':'owner@example.invalid'}})).status,401);
 assert.equal((await request('/learn/api/reading?scope=preview')).status,400);
});
test('verified reading is private and photographs are requested separately on demand',async()=>{
 assetCalls=0;readingCalls=0;const r=await request(url+'&release='+release+'&mission='+mission);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.match(r.headers.get('vary'),/Cookie/);
 const value=await r.json();assert.equal(value.payload_text,payload);assert.equal(readingCalls,1);assert.equal(assetCalls,0);
 const image=await request(url+'&release='+release+'&asset=photo&lang=ms');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');assert.match(image.headers.get('content-security-policy'),/sandbox/);assert.match(image.headers.get('cache-control'),/no-store/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),lossy);assert.equal(assetCalls,1);
 denyAsset=true;assert.equal((await request(url+'&release='+release+'&asset=photo')).status,403);denyAsset=false;
});
test('marker writes reject foreign identities/private text and preserve compiled release binding',async()=>{
 writes=[];
 assert.equal((await request(url,{body:save,requestOrigin:'https://other.invalid'})).status,403);
 for(const extra of [{user_id:'another-user'},{notes:'private writing'},{answers:[1]},{percentage:100}])assert.equal((await request(url,{body:{...save,...extra}})).status,400);
 brokenCode=true;assert.equal((await request(url,{body:save})).status,503);assert.equal(writes.length,0);brokenCode=false;
 const r=await request(url,{body:save});assert.equal(r.status,200);assert.deepEqual((await r.json()).reviewed,save.reviewed);assert.equal(writes.length,1);assert.equal(writes[0].p_scope,'learner');
});
