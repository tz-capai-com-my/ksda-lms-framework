// Disposable local PostgreSQL tests. Never connects to Supabase or sends email.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadReadingPackage} from '../scripts/validate-reading-package.mjs';
import {renderReadingInstall,renderReadingActivation} from '../scripts/generate-reading-install.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const newMigration='supabase/migrations/20260929091809_independent_interactive_reading.sql';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const authMock=`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;`;
const as=(db,role,id,sql,args=[])=>db.transaction(async tx=>{
  assert.ok(['anon','authenticated','service_role'].includes(role));
  await tx.exec(`set local role ${role}`);
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
  return (await tx.query(sql,args)).rows;
});
async function base(db){
  await db.exec(authMock);await db.exec(await read('supabase/migrations/20260920000000_fresh_ksda.sql'));await db.exec(await read('supabase/seed.sql'));
}
async function learners(db){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[a,'a@example.invalid',b,'b@example.invalid']);
  for(const id of [a,b])await as(db,'authenticated',id,"insert into public.profiles(user_id,display_name,preferred_language,onboarding_completed) values($1,'Synthetic Learner','en',true)",[id]);
}
async function enrol(db,id,course){
  await as(db,'authenticated',id,"insert into public.module_enrolments(user_id,course_id,status) values($1,$2,'active')",[id,course]);
  await as(db,'authenticated',id,"insert into public.module_progress(user_id,course_id,current_mission,progress_percentage) values($1,$2,'1',0)",[id,course]);
}
async function snapshot(db){return JSON.stringify((await db.query(`select
 (select jsonb_agg(p order by user_id) from public.profiles p) profiles,
 (select jsonb_agg(e order by user_id,course_id) from public.module_enrolments e) enrolments,
 (select jsonb_agg(p order by user_id,course_id) from public.module_progress p) progress,
 (select jsonb_agg(c order by id) from public.courses c) courses`)).rows);}
async function rejectBatch(db,sql,pattern){try{await assert.rejects(db.exec(sql),pattern);}finally{await db.exec('rollback');}}
function changedPhysicalManifest(data,change){
 const releases=data.releases.map(release=>{
  if(release.id!==data.bundle.source_id)return release;
  const doc=JSON.parse(release.manifest_text);change(doc);
  const manifest_text=JSON.stringify(doc);
  return {...release,manifest_text,content_hash:createHash('sha256').update(manifest_text).digest('hex')};
 });
 return {...data,releases};
}

test('independent reading fresh installation, release binding and isolation',async t=>{
 const db=new PGlite();
 try{
  const data=await loadReadingPackage(new URL('examples/capai-community-reading',root).pathname);
  await base(db);await db.exec(await read(newMigration));await learners(db);
  const rid=data.bundle.delivery_id;
  const first=data.revisions[0],second=data.revisions.find(x=>x.course_key===first.course_key&&x.mission_id!==first.mission_id);
  const course=(await db.query('select id from public.courses where slug=$1',[first.database_slug])).rows[0].id;
  for(const id of [a,b])await enrol(db,id,course);
  const before=await snapshot(db);
  const get=(who,mission=first.mission_id)=>as(db,'authenticated',who,'select public.ksda_reading_delivery($1,$2,$3) as value',['learner',rid,mission]);
  const save=(who,markers,revision=first.revision_hash,last=null)=>as(db,'authenticated',who,'select public.ksda_reading_delivery_progress($1,$2,$3,$4,$5,$6) as value',['learner',rid,first.mission_id,revision,markers,last]);
  await t.test('additive schema has RLS, no seeded reviewer and no active pointer',async()=>{
   assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ksda_reading_private' and c.relkind='r' and c.relrowsecurity")).rows[0].n,11);
   assert.equal((await db.query('select count(*)::int n from ksda_reading_private.reviewers')).rows[0].n,0);
   assert.equal((await db.query('select release_id from ksda_reading_private.publication')).rows[0].release_id,null);
  });
  await t.test('physical seal rejects missing and unsupported presentation instead of skipping validation',async()=>{
   for(const change of [doc=>{delete doc.presentation;},doc=>{doc.presentation='unknown-photos';}]){
    await rejectBatch(db,renderReadingInstall(changedPhysicalManifest(data,change)),/UNSUPPORTED_PHYSICAL_PRESENTATION/);
    assert.equal((await db.query('select count(*)::int n from ksda_reading_private.releases')).rows[0].n,0);
   }
  });
  await t.test('physical seal rejects rehashed photo, held-section and course-mapping mismatches',async()=>{
   for(const [change,reason]of [
    [doc=>{doc.assets[0].sha256='0'.repeat(64);},/PHOTO_ASSET_MISMATCH/],
    [doc=>{doc.excluded_section_ids=[first.payload.sections[0].id];},/PHOTO_MISSION_MISMATCH/],
    [doc=>{doc.missions[0].database_slug='independent-wrong-course';},/PHOTO_MISSION_MISMATCH/],
   ]){
    await rejectBatch(db,renderReadingInstall(changedPhysicalManifest(data,change)),reason);
    assert.equal((await db.query('select count(*)::int n from ksda_reading_private.releases')).rows[0].n,0);
    assert.equal(await snapshot(db),before);
   }
  });
  await t.test('validated package imports complete bytes without publication or learner changes',async()=>{
   await db.exec(renderReadingInstall(data));
   assert.equal((await db.query('select count(*)::int n from ksda_reading_private.mission_revisions')).rows[0].n,data.revisions.length);
   assert.equal((await db.query('select count(*)::int n from ksda_reading_private.photos')).rows[0].n,data.photos.length);
   assert.equal((await db.query('select count(*)::int n from ksda_reading_private.asset_delivery')).rows[0].n,data.photos.length*2);
   assert.equal((await db.query('select release_id from ksda_reading_private.publication')).rows[0].release_id,null);
   assert.equal((await db.query('select count(*)::int n from ksda_reading_private.release_approvals')).rows[0].n,0);
   assert.equal(await snapshot(db),before);
  });
  await t.test('duplicate import fails transactionally and cannot overwrite sealed content',async()=>{
   await rejectBatch(db,renderReadingInstall(data),/RELEASE_ALREADY_EXISTS/);
   await assert.rejects(db.query('update ksda_reading_private.mission_revisions set payload_text=payload_text where release_id=$1',[data.bundle.source_id]),/SEALED_RELEASE_IMMUTABLE/);
  });
  await t.test('explicit independent operator activation binds exact code/content/source/assets',async()=>{
   assert.throws(()=>renderReadingActivation(data,{expectedRelease:null}),/APPROVAL_REFERENCE/);
   await db.exec(renderReadingActivation(data,{expectedRelease:null,approvalReference:'SYNTHETIC LOCAL OPERATOR APPROVAL ONLY'}));
   assert.equal((await db.query('select release_id from ksda_reading_private.publication')).rows[0].release_id,rid);
   const value=(await get(a))[0].value;
   assert.equal(value.code_hash,data.identity.code_hash);assert.equal(value.payload_text,first.payload_text);assert.equal(value.release_id,rid);
   await assert.rejects(db.query('select ksda_reading_private.select_publication($1,$2,$3)',[rid,rid,'0'.repeat(64)]),/EXACT_APPROVAL_REQUIRED/);
  });
  await t.test('anonymous, reviewer bypass, direct-table and activation calls remain denied',async()=>{
   await assert.rejects(as(db,'anon',null,'select public.ksda_reading_delivery($1,$2,$3)',['learner',rid,first.mission_id]),/permission denied/);
   await assert.rejects(as(db,'authenticated',a,'select public.ksda_reading_delivery($1,$2,$3)',['preview',rid,first.mission_id]),/REVIEWER_REQUIRED/);
   await assert.rejects(as(db,'authenticated',a,'select * from ksda_reading_private.delivery_progress'),/permission denied/);
   await assert.rejects(as(db,'authenticated',a,'select ksda_reading_private.select_publication(null,null,null)'),/permission denied/);
  });
  await t.test('future missions and their photos are locked by existing progress',async()=>{
   await assert.rejects(get(a,second.mission_id),/MISSION_LOCKED/);
   const photo=data.photos.find(x=>x.mission_id===second.mission_id);
   await assert.rejects(as(db,'authenticated',a,'select public.ksda_reading_delivery_asset($1,$2,$3,$4)',['learner',rid,photo.asset_id,'en']),/MISSION_LOCKED/);
  });
  await t.test('unconfirmed, banned and inactive identities cannot use reading RPCs',async()=>{
   await db.query('update auth.users set email_confirmed_at=null where id=$1',[b]);
   await assert.rejects(get(b),/SIGN_IN_REQUIRED/);
   await db.query("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id=$1",[b]);
   await assert.rejects(get(b),/SIGN_IN_REQUIRED/);
   await db.query('update auth.users set banned_until=null where id=$1',[b]);
   await db.query("update public.profiles set account_status='suspended' where user_id=$1",[b]);
   await assert.rejects(get(b),/SIGN_IN_REQUIRED/);
   await db.query("update public.profiles set account_status='active' where user_id=$1",[b]);
   assert.equal((await get(b))[0].value.release_id,rid);
  });
  await t.test('reading markers are per user/release/revision and reject invented fields',async()=>{
   const markerBaseline=await snapshot(db);
   const block=first.block_ids[0];await save(a,{[block]:'self_confirmed'},first.revision_hash,block);
   assert.equal((await get(a))[0].value.progress.reviewed[block],'self_confirmed');
   assert.deepEqual((await get(b))[0].value.progress.reviewed,{});
   await assert.rejects(save(a,{[block]:'self_confirmed'},'0'.repeat(64)),/REVISION/);
   await assert.rejects(save(a,{private_note:'sensitive text'}),/BLOCK|MARKER/);
   const earned=(await db.query('select current_mission,progress_percentage from public.module_progress where user_id=$1 and course_id=$2',[a,course])).rows[0];
   assert.deepEqual(earned,{current_mission:'1',progress_percentage:0});
   assert.equal(await snapshot(db),markerBaseline);
  });
  await t.test('all ordered mission envelopes and every localized photo resolve after ordinary sequential progression',async()=>{
   const groups=new Map();for(const revision of data.revisions){if(!groups.has(revision.database_slug))groups.set(revision.database_slug,[]);groups.get(revision.database_slug).push(revision);}
   for(const [slug,revisions]of groups){
    const c=(await db.query('select id,mission_count from public.courses where slug=$1',[slug])).rows[0];
    if(c.id!==course)await enrol(db,a,c.id);
    for(let n=0;n<revisions.length;n++){
     const revision=revisions[n],value=(await get(a,revision.mission_id))[0].value;
     assert.equal(value.payload_text,revision.payload_text);assert.equal(value.revision_hash,revision.revision_hash);
     for(const photo of data.photos.filter(x=>x.mission_id===revision.mission_id))for(const locale of ['en','ms']){
      const asset=(await as(db,'authenticated',a,'select public.ksda_reading_delivery_asset($1,$2,$3,$4) as value',['learner',rid,photo.asset_id,locale]))[0].value;
      assert.equal(asset.hash,photo.sha256);assert.deepEqual(Buffer.from(asset.body,'base64'),photo.body);
     }
     await as(db,'authenticated',a,'update public.module_progress set current_mission=$1,progress_percentage=$2,completed_at=$3 where user_id=$4 and course_id=$5',[String(n+2),Math.floor(100*(n+1)/revisions.length),n===revisions.length-1?'2026-01-01T00:00:00Z':null,a,c.id]);
    }
   }
   assert.ok((await db.query('select progress_percentage from public.module_progress where user_id=$1',[a])).rows.every(x=>x.progress_percentage===100));
  });
 }finally{await db.close();}
});

test('v0.1.0 upgrade preserves existing users, course IDs, progress and guard rules',async t=>{
 const db=new PGlite();
 try{
  const data=await loadReadingPackage(new URL('examples/capai-community-reading',root).pathname);
  await base(db);await learners(db);
  const c=(await db.query('select id,mission_count from public.courses order by sort_order limit 1')).rows[0];
  await enrol(db,a,c.id);
  await as(db,'authenticated',a,'update public.module_progress set current_mission=$1,progress_percentage=$2 where user_id=$3 and course_id=$4',['2',Math.floor(100/c.mission_count),a,c.id]);
  const before=await snapshot(db);
  await t.test('only additive migration is applied; existing base migration is not replayed',async()=>{
   await db.exec(await read(newMigration));assert.equal(await snapshot(db),before);
  });
  await t.test('independent UUID mapping imports current examples without rewriting earned progress',async()=>{
   await db.exec(renderReadingInstall(data,{activate:true,expectedRelease:null,approvalReference:'SYNTHETIC LOCAL UPGRADE APPROVAL ONLY'}));
   assert.equal(await snapshot(db),before);
   const mapped=(await db.query('select distinct course_id from ksda_reading_private.mission_revisions where course_key=$1',[data.revisions[0].course_key])).rows[0].course_id;assert.equal(mapped,c.id);
  });
  await t.test('base course-count/progress invariants stay enforced after upgrade',async()=>{
   await assert.rejects(db.query('update public.courses set mission_count=mission_count+1 where id=$1',[c.id]),/ENROLLED_COURSE_STRUCTURE_IMMUTABLE/);
   await assert.rejects(as(db,'authenticated',a,"update public.module_progress set current_mission='1',progress_percentage=0 where user_id=$1 and course_id=$2",[a,c.id]),/PROGRESS_ONE_STEP_REQUIRED/);
   assert.equal(await snapshot(db),before);
  });
 }finally{await db.close();}
});
