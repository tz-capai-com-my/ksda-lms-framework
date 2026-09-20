import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { renderCourseSeed } from '../scripts/generate-course-seed.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const people = {
  a: '00000000-0000-4000-8000-000000000001',
  b: '00000000-0000-4000-8000-000000000002',
  pending: '00000000-0000-4000-8000-000000000003',
  suspended: '00000000-0000-4000-8000-000000000004',
};

// Only the test database supplies auth mocks. Production uses Supabase Auth.
const authMock = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

async function as(db, role, id, action) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec(`set role ${role}`);
  try { return await action(); } finally { await db.exec('reset role'); }
}
const denied = async (action, expected = /permission denied|row-level security/i) => assert.rejects(action, expected);
const profile = (db, id, name = 'Offline learner') => as(db, 'authenticated', id, () => db.query(
  'insert into public.profiles (user_id, display_name, preferred_language, onboarding_completed) values ($1, $2, $3, true) returning user_id, display_name, preferred_language, onboarding_completed, account_status',
  [id, name, 'en'],
));
const enrol = (db, id, course) => as(db, 'authenticated', id, () => db.query(
  "insert into public.module_enrolments (user_id, course_id, status) values ($1, $2, 'active') returning course_id, status", [id, course],
));
const start = (db, id, course, mission = '1', percentage = 0) => as(db, 'authenticated', id, () => db.query(
  'insert into public.module_progress (user_id, course_id, current_mission, progress_percentage, last_activity_at, completed_at) values ($1, $2, $3, $4, now(), null) returning *',
  [id, course, mission, percentage],
));

test('fresh Supabase migration enforces the direct-write LMS contract under actual PostgreSQL roles', async t => {
  const db = new PGlite();
  try {
    const catalogue = JSON.parse(await read('config/course-catalogue.json'));
    const seed = await read('supabase/seed.sql');
    assert.equal(seed, renderCourseSeed(catalogue), 'regenerate the seed after changing the catalogue');
    await db.exec(authMock);
    await db.exec(await read('supabase/migrations/20260920000000_fresh_ksda.sql'));
    await db.exec(seed);
    for (const id of Object.values(people)) await db.query('insert into auth.users (id) values ($1)', [id]);
    const courses = (await db.query('select * from public.courses order by sort_order')).rows;
    const course = courses[0].id;
    const n = courses[0].mission_count;

    await t.test('creates exactly four application tables, enables RLS, and seeds current module counts', async () => {
      const tables = (await db.query("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by relname")).rows;
      assert.deepEqual(tables.map(row => row.relname), ['courses', 'module_enrolments', 'module_progress', 'profiles']);
      assert.ok(tables.every(row => row.relrowsecurity));
      assert.equal(courses.length, catalogue.length);
      for (let i = 0; i < courses.length; i++) {
        assert.equal(courses[i].slug, catalogue[i].databaseSlug);
        assert.equal(courses[i].mission_count, catalogue[i].missions);
        assert.equal(courses[i].access_type, 'free');
        assert.equal(courses[i].status, 'published');
      }
      assert.equal((await db.query("select data_type from information_schema.columns where table_schema='public' and table_name='module_progress' and column_name='current_mission'")).rows[0].data_type, 'text');
    });

    await t.test('anonymous visitors can read catalogue metadata but no private data or writes', async () => {
      await as(db, 'anon', null, async () => {
        assert.equal((await db.query('select id from public.courses')).rows.length, catalogue.length);
        for (const table of ['profiles', 'module_enrolments', 'module_progress']) {
          await denied(() => db.query(`select * from public.${table}`));
        }
        await denied(() => db.query("insert into public.profiles (user_id,display_name) values ($1,'Anonymous')", [people.a]));
      });
    });

    await t.test('profile defaults and ownership hold; learners cannot escalate status or reset onboarding', async () => {
      const own = await profile(db, people.a);
      assert.equal(own.rows[0].account_status, 'active');
      await profile(db, people.b, 'Other offline learner');
      await db.query("insert into public.profiles (user_id,display_name,onboarding_completed,account_status) values ($1,'Pending',false,'active'), ($2,'Suspended',true,'suspended')", [people.pending, people.suspended]);
      await as(db, 'authenticated', people.a, async () => {
        assert.deepEqual((await db.query('select user_id from public.profiles')).rows.map(row => row.user_id), [people.a]);
        await denied(() => db.query("insert into public.profiles (user_id,display_name) values ($1,'Spoofed')", [people.pending]));
        assert.equal((await db.query("update public.profiles set display_name='Spoofed' where user_id=$1 returning user_id", [people.b])).rows.length, 0);
        await denied(() => db.query("update public.profiles set account_status='active' where user_id=$1", [people.a]));
        await denied(() => db.query("update public.profiles set user_id=$1 where user_id=$2", [people.b, people.a]));
        await denied(() => db.query('delete from public.profiles where user_id=$1', [people.a]));
        await denied(() => db.query('update public.profiles set onboarding_completed=false where user_id=$1', [people.a]), /ONBOARDING_CANNOT_RESET/);
        assert.equal((await db.query("update public.profiles set display_name='Updated',preferred_language='ms',onboarding_completed=true where user_id=$1 returning display_name", [people.a])).rows[0].display_name, 'Updated');
      });
    });

    await t.test('enrolment requires own active onboarding and a published free course; duplicates and status changes fail', async () => {
      const fixtures = (await db.query("insert into public.courses (slug,title,short_description,status,access_type,mission_count) values ('draft-only','Draft','Offline fixture','draft','free',2), ('paid-only','Paid','Offline fixture','published','paid',2) returning id,slug")).rows;
      await enrol(db, people.a, course);
      await enrol(db, people.b, course);
      await denied(() => enrol(db, people.a, course), /duplicate key/);
      await denied(() => enrol(db, people.pending, course));
      await denied(() => enrol(db, people.suspended, course));
      for (const item of fixtures) await denied(() => enrol(db, people.a, item.id));
      await as(db, 'authenticated', people.a, async () => {
        await denied(() => db.query("insert into public.module_enrolments (user_id,course_id,status) values ($1,$2,'active')", [people.b, courses[1].id]));
        await denied(() => db.query("insert into public.module_enrolments (user_id,course_id,status) values ($1,$2,'withdrawn')", [people.a, courses[1].id]));
        assert.equal((await db.query('select * from public.module_enrolments')).rows.length, 1);
        await denied(() => db.query("update public.module_enrolments set status='active'"));
        await denied(() => db.query('delete from public.module_enrolments'));
        await denied(() => db.query("update public.courses set status='published'"));
      });
      await as(db, 'anon', null, async () => {
        assert.equal((await db.query("select id from public.courses where slug='draft-only'")).rows.length, 0);
      });
    });

    await t.test('progress starts at zero with active enrolment and cannot skip, reset, forge ownership or percentages', async () => {
      await denied(() => start(db, people.a, courses[1].id), /ACTIVE_ENROLMENT_REQUIRED/);
      await denied(() => start(db, people.a, course, '2', Math.floor(100 / n)), /PROGRESS_MUST_START_AT_ZERO/);
      await denied(() => start(db, people.a, course, '1', 50), /INVALID_PROGRESS/);
      await start(db, people.a, course);
      await start(db, people.b, course);
      await denied(() => start(db, people.a, course), /duplicate key/);
      await as(db, 'authenticated', people.a, async () => {
        const values = (await db.query('select user_id,current_mission,progress_percentage,completed_at from public.module_progress')).rows;
        assert.deepEqual(values, [{ user_id: people.a, current_mission: '1', progress_percentage: 0, completed_at: null }]);
        assert.equal((await db.query("update public.module_progress set current_mission='2',progress_percentage=$1 where user_id=$2 returning id", [Math.floor(100 / n), people.b])).rows.length, 0);
        await denied(() => db.query("update public.module_progress set current_mission='3',progress_percentage=$1", [Math.floor(200 / n)]), /PROGRESS_ONE_STEP_REQUIRED/);
        await denied(() => db.query("update public.module_progress set current_mission='2',progress_percentage=99"), /INVALID_PROGRESS/);
        await denied(() => db.query("update public.module_progress set current_mission='01'"), /INVALID_MISSION/);
        await denied(() => db.query("update public.module_progress set current_mission='2',progress_percentage=$1,completed_at=now()", [Math.floor(100 / n)]), /PREMATURE_COMPLETION/);
        await denied(() => db.query('update public.module_progress set user_id=$1', [people.b]));
        await denied(() => db.query('delete from public.module_progress'));
        const update = "update public.module_progress set current_mission='2',progress_percentage=$1,last_activity_at=now(),completed_at=null where user_id=$2 and course_id=$3 and current_mission='1' and progress_percentage=0 returning current_mission,progress_percentage";
        assert.deepEqual((await db.query(update, [Math.floor(100 / n), people.a, course])).rows, [{ current_mission: '2', progress_percentage: Math.floor(100 / n) }]);
        assert.equal((await db.query(update, [Math.floor(100 / n), people.a, course])).rows.length, 0, 'stale optimistic update does not overwrite newer progress');
        await denied(() => db.query("update public.module_progress set current_mission='1',progress_percentage=0"), /PROGRESS_ONE_STEP_REQUIRED/);
      });
    });

    await t.test('inactive enrolments and unpublished courses block advancement; course structure is stable after enrolment', async () => {
      await db.query("update public.module_enrolments set status='suspended' where user_id=$1 and course_id=$2", [people.a, course]);
      await as(db, 'authenticated', people.a, () => denied(() => db.query("update public.module_progress set current_mission='3',progress_percentage=$1", [Math.floor(200 / n)]), /ACTIVE_ENROLMENT_REQUIRED/));
      await db.query("update public.module_enrolments set status='active' where user_id=$1 and course_id=$2", [people.a, course]);
      await db.query("update public.courses set status='archived' where id=$1", [course]);
      await as(db, 'authenticated', people.a, () => denied(() => db.query("update public.module_progress set current_mission='3',progress_percentage=$1", [Math.floor(200 / n)]), /COURSE_UNAVAILABLE/));
      await denied(() => db.query('update public.courses set mission_count=mission_count+1 where id=$1', [course]), /ENROLLED_COURSE_STRUCTURE_IMMUTABLE/);
      await denied(() => db.query("update public.courses set slug='changed-course' where id=$1", [course]), /ENROLLED_COURSE_STRUCTURE_IMMUTABLE/);
      await db.exec(seed);
      assert.equal((await db.query('select status from public.courses where id=$1', [course])).rows[0].status, 'archived', 'regenerating metadata must not republish an archived course');
      await db.query("update public.courses set status='published' where id=$1", [course]);
    });

    await t.test('one-step completion reaches N+1/100, timestamps are server-owned, completed records cannot reset', async () => {
      await as(db, 'authenticated', people.a, async () => {
        for (let completed = 2; completed <= n; completed++) {
          const percentage = Math.floor(100 * completed / n);
          const final = completed === n;
          const result = await db.query('update public.module_progress set current_mission=$1,progress_percentage=$2,last_activity_at=$3,completed_at=$4 where user_id=$5 and course_id=$6 and current_mission=$7 returning current_mission,progress_percentage,completed_at,last_activity_at',
            [String(completed + 1), percentage, '1999-01-01T00:00:00Z', final ? '1999-01-01T00:00:00Z' : null, people.a, course, String(completed)]);
          assert.equal(result.rows.length, 1);
          assert.equal(result.rows[0].current_mission, String(completed + 1));
          assert.equal(result.rows[0].progress_percentage, percentage);
          assert.equal(result.rows[0].completed_at !== null, final);
          assert.ok(new Date(result.rows[0].last_activity_at).getUTCFullYear() > 1999);
        }
        const completed = (await db.query('select * from public.module_progress')).rows[0];
        assert.ok(new Date(completed.completed_at).getUTCFullYear() > 1999);
        await denied(() => db.query("update public.module_progress set current_mission='1',progress_percentage=0,completed_at=null"), /PROGRESS_ONE_STEP_REQUIRED/);
        await denied(() => db.query('update public.module_progress set current_mission=$1,progress_percentage=100', [String(n + 2)]), /INVALID_PROGRESS/);
        await denied(() => db.query('update public.module_progress set completed_at=null'), /PROGRESS_NO_RESET/);
        const retry = (await db.query("update public.module_progress set last_activity_at='1999-01-01T00:00:00Z' returning *")).rows[0];
        assert.deepEqual(retry, completed, 'idempotent same-progress retry preserves timestamps');
      });
    });

    await t.test('service-role administration works while suspended learners lose private learning access', async () => {
      await as(db, 'service_role', null, async () => {
        assert.equal((await db.query('select * from public.module_progress')).rows.length, 2);
        await db.query("update public.profiles set account_status='suspended' where user_id=$1", [people.a]);
      });
      await as(db, 'authenticated', people.a, async () => {
        assert.equal((await db.query('select account_status from public.profiles')).rows[0].account_status, 'suspended');
        assert.equal((await db.query('select * from public.module_progress')).rows.length, 0);
        assert.equal((await db.query('select * from public.module_enrolments')).rows.length, 0);
        assert.equal((await db.query("update public.profiles set display_name='Attempted' returning user_id")).rows.length, 0);
        await denied(() => db.query("update public.profiles set account_status='active'"));
      });
      await db.query('delete from auth.users where id=$1', [people.b]);
      for (const table of ['profiles', 'module_enrolments', 'module_progress']) {
        assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [people.b])).rows.length, 0);
      }
    });
  } finally {
    await db.close();
  }
});

test('seed generator rejects ambiguous configuration and escapes SQL string values', () => {
  const course = { databaseSlug: 'example-module', title: "Learner's module", outcome: "A learner's outcome", missions: 3 };
  assert.match(renderCourseSeed([course]), /Learner''s module/);
  assert.throws(() => renderCourseSeed([course, course]), /duplicate/);
  assert.throws(() => renderCourseSeed([{ ...course, missions: 0 }]), /invalid/);
  assert.throws(() => renderCourseSeed([{ ...course, missions: 129 }]), /invalid/);
  assert.throws(() => renderCourseSeed([{ ...course, databaseSlug: 'bad; drop table' }]), /invalid/);
});
