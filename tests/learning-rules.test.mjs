import test from 'node:test';
import assert from 'node:assert/strict';
import {progressAfter,evaluateCheckpoint,approvedRules,missionNumber} from '../app/learn/learning-rules.ts';

test('stored text mission positions preserve deterministic progress and reject malformed values',()=>{
 for(const stored of ['1','2',1,2]) {
  const current=missionNumber(stored);
  assert.equal(current,Number(stored));
  assert.equal(progressAfter(current,8).current_mission,current+1);
 }
 for(const invalid of [null,undefined,'',' ','0','01','-1','1.5','1e2',' 1','mission-1',0,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
  assert.throws(()=>missionNumber(invalid),/INVALID_STORED_MISSION/);
 }
});

test('progress is deterministic and sequential across campaign lengths',()=>{
 for(const total of [6,7,8]) {
  assert.deepEqual(progressAfter(0,total),{current_mission:1,progress_percentage:0});
  for(let done=0;done<=total;done++) {
   const result=progressAfter(done,total);
   assert.equal(result.progress_percentage,Math.floor(100*done/total));
   assert.equal(result.current_mission,done+1);
   assert.equal(result.progress_percentage===100,done===total);
  }
 }
 assert.throws(()=>progressAfter(-1,6));assert.throws(()=>progressAfter(7,6));assert.throws(()=>progressAfter(1,0));assert.throws(()=>progressAfter(1.5,6));
});
test('a completion click alone is never a checkpoint',()=>{
 const rule={id:'neutral-fixture',requiredCheckpoints:[{id:'choice',question:'Unit fixture only',options:['A','B'],correctOption:'B'}],actionRequired:true,reviewRequired:true};
 assert.equal(evaluateCheckpoint(rule,{}),false);
 assert.equal(evaluateCheckpoint(rule,{answers:{choice:'A'},actionConfirmed:true,reviewConfirmed:true}),false);
 assert.equal(evaluateCheckpoint(rule,{answers:{choice:'B'},actionConfirmed:true}),false);
 assert.equal(evaluateCheckpoint(rule,{answers:{choice:'B'},actionConfirmed:true,reviewConfirmed:true}),true);
 assert.equal(evaluateCheckpoint(rule,{answers:{choice:'B',writing:'not accepted'},actionConfirmed:true,reviewConfirmed:true}),false);
 assert.equal(evaluateCheckpoint({...rule,requiredCheckpoints:[]},{answers:{},actionConfirmed:true,reviewConfirmed:true}),false);
});
test('unreviewed source campaigns have no executable approved checkpoints',()=>{
 assert.deepEqual(approvedRules,{});
});
