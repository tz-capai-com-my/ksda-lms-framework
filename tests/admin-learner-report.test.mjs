import assert from "node:assert/strict";
import { register } from "node:module";
import { createHmac } from "node:crypto";
import test from "node:test";
register("./admin-report-loader.mjs", import.meta.url);
const { handleReport } = await import("../supabase/functions/admin-learner-report/index.mjs");
const secret = "test-only-signing-secret-do-not-use-in-production";
let queries = 0;
const fixture = {
  profiles: [{user_id:"user-a",display_name:"Learner A",preferred_language:"en",onboarding_completed:true,account_status:"active"}],
  module_enrolments: [{id:"e1",user_id:"user-a",course_id:"c1",enrolled_at:"2026-09-01",status:"active"}],
  module_progress: [{id:"p1",user_id:"user-a",course_id:"c1",progress_percentage:50,current_mission:"fire-m03",last_activity_at:"2026-09-19",completed_at:null}],
  courses: [{id:"c1",title:"Fire Safety",slug:"fire-life-safety-awareness"}],
};
function admin(fail = false, total = 2) {
  queries++;
  return {
    auth:{admin:{listUsers:async()=>({data:{total,users:[
      {id:"user-a",email:"a@example.invalid",created_at:"2026-09-01",email_confirmed_at:"2026-09-01",user_metadata:{secret:"must-not-return"},phone:"must-not-return"},
      {id:"user-b",email:"b@example.invalid",created_at:"2026-09-02"},
    ]},error:null})}},
    from(table) { const chain = {select(){return chain;},in(){return chain;},order(){return chain;},async range(){return {data:fixture[table],error:fail?{message:"private database detail"}:null};}};return chain; },
  };
}
function request({body=JSON.stringify({page:1}),timestamp=String(Math.floor(Date.now()/1000)),tamper=false,method="POST"}={}) {
  const signature=createHmac("sha256",secret).update(`lms.admin-learner-report.v1\n${timestamp}\n${body}`).digest("hex");
  return new Request("https://example.invalid/functions/v1/admin-learner-report",{method,headers:{"X-LMS-Timestamp":timestamp,"X-LMS-Signature":signature},...(method==="POST"?{body:tamper?JSON.stringify({page:2}):body}:{})});
}
const deps={getEnv:name=>name==="LMS_LEARNER_REPORT_SECRET"?secret:undefined,createAdmin:()=>admin()};
test("joins Auth IDs to minimal enrolment records including signups without profiles",async()=>{
  const response=await handleReport(request(),deps);assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/no-store/);assert.equal(response.headers.get("Access-Control-Allow-Origin"),null);
  const data=await response.json();assert.equal(data.total_users,2);assert.equal(data.learners.length,2);
  assert.equal(data.learners[0].enrolments[0].progress_percentage,50);
  assert.equal(data.learners[1].onboarding_completed,false);assert.deepEqual(data.learners[1].enrolments,[]);
  assert.doesNotMatch(JSON.stringify(data),/user_metadata|must-not-return|phone|token|secret/);
});
test("rejects missing, tampered, stale and wrongly scoped signatures before database access",async()=>{
  queries=0;
  const missing=new Request("https://example.invalid",{method:"POST",body:"{}"});
  assert.equal((await handleReport(missing,deps)).status,401);
  assert.equal((await handleReport(request({tamper:true}),deps)).status,401);
  assert.equal((await handleReport(request({timestamp:String(Math.floor(Date.now()/1000)-301)}),deps)).status,401);
  const wrong=request();wrong.headers.set("X-LMS-Signature",createHmac("sha256",secret).update("another-function").digest("hex"));
  assert.equal((await handleReport(wrong,deps)).status,401);assert.equal(queries,0);
});
test("accepts only bounded page input, never an arbitrary user or action",async()=>{
  queries=0;
  for(const body of [{page:0},{page:1,user_id:"other"},{page:1,action:"delete"},{page:100001},null])assert.equal((await handleReport(request({body:JSON.stringify(body)}),deps)).status,400);
  assert.equal((await handleReport(request({method:"GET"}),deps)).status,405);assert.equal(queries,0);
});
test("query errors are unavailable, not an empty register; pagination handles page 10",async()=>{
  const failed=await handleReport(request(),{...deps,createAdmin:()=>admin(true)});
  assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:"REPORT_UNAVAILABLE"});
  const page=await handleReport(request({body:JSON.stringify({page:10})}),{...deps,createAdmin:()=>admin(false,551)});
  assert.equal((await page.json()).has_more,true);
});
