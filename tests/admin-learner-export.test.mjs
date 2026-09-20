import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
register('./admin-workers-loader.mjs', import.meta.url);
const secret='test-only-never-real-secret-for-fixtures';
globalThis.adminTestBindings={LMS_ADMIN_EMAILS:'owner@example.invalid',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_offline_fixture',LMS_LEARNER_REPORT_URL:'https://example.supabase.co/functions/v1/admin-learner-report',LMS_LEARNER_REPORT_SECRET:secret};
let identity;
let calls=[];
let mode='full';
function learner(n){return {user_id:`fixture-${n}`,email:`learner${n}@example.invalid`,display_name:n===50?'  =SUM(1,2)':'Name "quoted", line\nTwo',preferred_language:'ms',onboarding_completed:true,account_status:'active',signed_up_at:'2026-09-19T00:00:00Z',email_verified_at:null,last_sign_in_at:null,enrolments:n===50?[{course_id:'fire',title:'Fire Safety',status:'active',enrolled_at:'2026-09-19T00:00:00Z',progress_percentage:0,current_mission:'\n=1+1',last_activity_at:null,completed_at:null},{course_id:'first-aid',title:'First Aid',status:'active',enrolled_at:'2026-09-19T00:00:00Z',progress_percentage:50,current_mission:'3',last_activity_at:null,completed_at:null}]:[]};}
globalThis.fetch=async(input,init)=>{
 const request=new Request(input,init);
 if(new URL(request.url).pathname==='/auth/v1/user'){assert.equal(request.headers.get('authorization'),'Bearer offline-access-token');return Response.json({id:'fixture-admin',email:identity,email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});}
 assert.match(String(input),/functions\/v1\/admin-learner-report$/);
 assert.match(init.headers['X-LMS-Signature'],/^[a-f0-9]{64}$/);
 const {page}=JSON.parse(init.body);calls.push(page);
 if(mode==='failure'&&page===2)return new Response('',{status:503});
 const empty=mode==='empty';
 const learners=empty?[]:page===1?Array.from({length:50},(_,n)=>learner(n)):[learner(mode==='duplicate'?0:50)];
 return Response.json({page:mode==='wrong-page'?2:page,page_size:50,total_users:empty?0:51,has_more:empty?false:page===1,fetched_at:'2026-09-19T00:00:00Z',learners});
};
const worker=(await import('../dist/server/index.js')).default;
function load(email,extra={}){identity=email;const user={id:'fixture-admin',email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};const session={access_token:'offline-access-token',refresh_token:'offline-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};const cookie='sb-example-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');return worker.fetch(new Request('https://lms.example.invalid/admin/learners/export',{headers:{...extra,...(email?{cookie}:{})}}),{}, {waitUntil(){},passThroughOnException(){}});}
test('export rejects anonymous, learner and cross-site requests before querying',async()=>{
 calls=[];
 for(const email of [undefined,'learner@example.invalid']){const r=await load(email);assert.equal(r.status,403);assert.match(r.headers.get('cache-control'),/no-store/);assert.doesNotMatch(await r.text(),/fixture-/);}
 assert.equal((await load('owner@example.invalid',{'sec-fetch-site':'cross-site'})).status,403);assert.deepEqual(calls,[]);
});
test('owner export includes all pages, no-enrolment users, both enrolments and spreadsheet-safe cells',async()=>{
 calls=[];mode='full';const r=await load('owner@example.invalid');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/csv/);assert.match(r.headers.get('content-disposition'),/attachment; filename="[A-Za-z0-9_-]+_Learner_Register_/);assert.match(r.headers.get('cache-control'),/no-store/);
 const raw=await r.arrayBuffer();assert.deepEqual([...new Uint8Array(raw).slice(0,3)],[239,187,191]);const csv=new TextDecoder().decode(raw);
 assert.deepEqual(calls,[1,2]);assert.match(csv,/fixture-0/);assert.match(csv,/fixture-50/);assert.match(csv,/Not enrolled/);assert.match(csv,/Fire Safety/);assert.match(csv,/First Aid/);assert.match(csv,/"'  =SUM\(1,2\)"/);assert.match(csv,/"'\n=1\+1"/);assert.match(csv,/Name ""quoted"", line\nTwo/);assert.match(csv,/"0"/);assert.doesNotMatch(csv,/test-only-never-real-secret|X-LMS-Signature/);
});
test('later-page failures, duplicates and incorrect page numbers never download partial records',async()=>{
 for(const value of ['failure','duplicate','wrong-page']){mode=value;const r=await load('owner@example.invalid');assert.equal(r.status,503);assert.equal(r.headers.get('content-disposition'),null);assert.doesNotMatch(await r.text(),/fixture-|learner\d@/);}
});
test('empty register is a valid header-only CSV; missing connection is an error',async()=>{
 mode='empty';const empty=await load('owner@example.invalid');assert.equal(empty.status,200);assert.match(await empty.text(),/Learner ID/);
 delete globalThis.adminTestBindings.LMS_LEARNER_REPORT_SECRET;calls=[];const missing=await load('owner@example.invalid');assert.equal(missing.status,503);assert.deepEqual(calls,[]);globalThis.adminTestBindings.LMS_LEARNER_REPORT_SECRET=secret;
});
