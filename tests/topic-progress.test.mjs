import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";

// Offline production-worker regressions. These tests do not send an OTP,
// create a real account, access another real learner, or write to Supabase.
// Copy this file into the repository's tests/ directory before running it.
register("./cloudflare-workers-loader.mjs", import.meta.url);
process.env.SUPABASE_URL = "https://frameworkexample.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_offline_fixture";
const origin = "https://learning.example.com";
const user = { id: "00000000-0000-4000-8000-000000000123", aud: "authenticated", role: "authenticated", email: "offline@example.invalid", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: "offline-invalid-in-production", refresh_token: "offline-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };
const cookieName = "sb-frameworkexample-auth-token";
const cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
const catalogue = JSON.parse(await readFile(new URL("../config/course-catalogue.json", import.meta.url), "utf8"));
const lessonSource = JSON.parse(await readFile(new URL("../content/ksda/free-topics.json", import.meta.url), "utf8"));
const courseDefinitions = catalogue.map(course => [course.slug, course.databaseSlug, course.title, lessonSource.find(item => item.slug === course.slug).topics.map(topic => topic.id)]);
const courses = courseDefinitions.map(([localSlug, slug, title, missions], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
  slug, title, short_description: "Offline catalogue fixture", experience_style: "mission", access_type: "free", status: "published", sort_order: index + 1,
  localSlug, missions,
}));
const fire = courses.find(course => course.missions.length > 1) || courses[0];
let profile, enrolments, progress, writes, raceOnInsert, conflictOnSave;
function reset() {
  profile = { user_id: user.id, display_name: "Offline fixture", preferred_language: "en", onboarding_completed: true, account_status: "active" };
  enrolments = []; progress = []; writes = []; raceOnInsert = false; conflictOnSave = false;
  courses.forEach(course => { course.access_type = "free"; });
}
reset();
function matching(rows, url) {
  return rows.filter(row => [...url.searchParams].every(([key, value]) => {
    if (["select", "order", "limit", "offset"].includes(key)) return true;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map(v => v.replace(/^"|"$/g, "")).includes(String(row[key]));
    throw new Error(`Unexpected filter in fixture: ${key}=${value}`);
  }));
}
function selected(row, url) {
  const columns = url.searchParams.get("select");
  if (!columns || columns === "*") return { ...row };
  return Object.fromEntries(columns.split(",").map(key => [key, row[key]]));
}
function rowsResponse(rows, request, url) {
  const data = rows.map(row => selected(row, url));
  if (request.headers.get("accept")?.includes("application/vnd.pgrst.object+json")) {
    return data.length === 1 ? Response.json(data[0]) : Response.json({ code: "PGRST116", message: "Fixture does not contain exactly one row", details: `${data.length} rows` }, { status: 406 });
  }
  return Response.json(data);
}
function duplicate() { return Response.json({ code: "23505", message: "Offline unique-index fixture" }, { status: 409 }); }
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  assert.equal(url.origin, process.env.SUPABASE_URL, "Tests never make external requests");
  assert.equal(request.headers.get("authorization"), "Bearer " + session.access_token, "Every learner operation uses the authenticated session");
  if (url.pathname === "/auth/v1/user") return Response.json(user);
  const table = url.pathname.replace("/rest/v1/", "");
  if (["profiles", "module_enrolments", "module_progress"].includes(table) && request.method !== "POST") {
    assert.equal(url.searchParams.get("user_id"), "eq." + user.id, "The authenticated UUID scopes every learner read/update");
  }
  if (request.method === "GET") {
    if (table === "profiles") return rowsResponse(matching(profile ? [profile] : [], url), request, url);
    if (table === "courses") return rowsResponse(matching(courses, url), request, url);
    if (table === "module_enrolments") return rowsResponse(matching(enrolments, url), request, url);
    if (table === "module_progress") return rowsResponse(matching(progress, url), request, url);
  }
  if (request.method === "POST" && ["module_enrolments", "module_progress"].includes(table)) {
    const body = await request.json();
    assert.equal(body.user_id, user.id);
    const rows = table === "module_enrolments" ? enrolments : progress;
    if (rows.some(row => row.user_id === body.user_id && row.course_id === body.course_id)) return duplicate();
    rows.push({ ...body }); writes.push({ table, method: "POST", body });
    if (table === "module_enrolments" && raceOnInsert) { raceOnInsert = false; return duplicate(); }
    return new Response(null, { status: 201 });
  }
  if (request.method === "PATCH" && table === "module_progress") {
    const body = await request.json();
    assert.deepEqual(Object.keys(body).sort(), ["completed_at", "current_mission", "last_activity_at", "progress_percentage"], "Completion stores only minimal progress, never answers or notes");
    assert.equal(typeof body.current_mission, "string", "The existing database current_mission column remains TEXT");
    assert.ok(url.searchParams.has("current_mission"), "Save compares the previous mission");
    assert.ok(url.searchParams.has("progress_percentage"), "Save compares the previous percentage");
    if (conflictOnSave) { conflictOnSave = false; return rowsResponse([], request, url); }
    const rows = matching(progress, url);
    for (const row of rows) Object.assign(row, body);
    writes.push({ table, method: "PATCH", body });
    return rowsResponse(rows, request, url);
  }
  throw new Error(`Unexpected offline fixture request: ${request.method} ${url.pathname}`);
};
const worker = (await import("../dist/server/index.js")).default;
const bindings = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
function request(path, body, sessionCookie = cookie) {
  const headers = { cookie: sessionCookie, accept: path.includes("/api/") ? "application/json" : "text/html" };
  if (body !== undefined) Object.assign(headers, { origin, "content-type": "application/json" });
  return worker.fetch(new Request(origin + path, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }), bindings, ctx);
}
const enrol = (course = fire) => request("/learn/api/enrol", { slug: course.localSlug });
const complete = (missionId, extras = {}, course = fire) => request("/learn/api/progress", { slug: course.localSlug, missionId, completionConfirmed: true, ...extras });

// These cases check production code against a minimal HTTP database fixture;
// actual production RLS and email delivery still require their separate checks.
test("free enrolment is idempotent and handles a unique-index race without duplicates", async () => {
  reset(); raceOnInsert = true;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await enrol();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).progress.progress_percentage, 0);
  }
  assert.equal(enrolments.length, 1);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].current_mission, "1");
  assert.equal(progress[0].completed_at, null);
});

test("completion requires an authenticated onboarded free learner, explicit confirmation, and the current topic", async () => {
  reset();
  assert.equal((await request("/learn/api/progress", { slug: fire.localSlug, missionId: fire.missions[0], completionConfirmed: true }, "")).status, 401);
  assert.equal((await complete(fire.missions[0], { user_id: "00000000-0000-4000-8000-000000000999" })).status, 400);
  profile.onboarding_completed = false;
  assert.equal((await enrol()).status, 409);
  profile.onboarding_completed = true;
  fire.access_type = "paid";
  assert.equal((await enrol()).status, 403);
  fire.access_type = "free";
  assert.equal((await complete(fire.missions[0])).status, 409);
  assert.equal((await enrol()).status, 200);
  for (const confirmation of [undefined, false, "true"]) {
    const body = { slug: fire.localSlug, missionId: fire.missions[0] };
    if (confirmation !== undefined) body.completionConfirmed = confirmation;
    assert.equal((await request("/learn/api/progress", body)).status, 422);
  }
  const skipped = await complete(fire.missions[1] || "missing-topic");
  assert.equal(skipped.status, fire.missions.length > 1 ? 409 : 404);
  assert.equal((await skipped.json()).error, fire.missions.length > 1 ? "MISSION_LOCKED" : "MISSION_NOT_FOUND");
  assert.equal(progress[0].progress_percentage, 0);
  assert.equal(writes.filter(write => write.method === "PATCH").length, 0);
});

test("an existing enrolment with missing progress remains repairable on course entry", async () => {
  reset();
  enrolments.push({ user_id: user.id, course_id: fire.id, status: "active" });
  const page = await request(`/learn/courses/${fire.localSlug}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /initialReady.{0,20}false/, "Hydrated course must retry initialization when progress is missing");
  const initialized = await enrol();
  assert.equal(initialized.status, 200);
  assert.equal(enrolments.length, 1);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].progress_percentage, 0);
  assert.equal((await complete(fire.missions[0])).status, 200);
  assert.equal(progress[0].progress_percentage, Math.floor(100 / fire.missions.length));
  const readyPage = await (await request(`/learn/courses/${fire.localSlug}`)).text();
  assert.match(readyPage, /initialReady.{0,20}true/);
});

test("first topic saves deterministic progress that a later dashboard request displays; repeat completion is harmless", async () => {
  reset(); await enrol();
  const saved = await complete(fire.missions[0]);
  assert.equal(saved.status, 200);
  const result = (await saved.json()).progress;
  assert.equal(result.current_mission, "2");
  assert.equal(result.progress_percentage, Math.floor(100 / fire.missions.length));
  assert.equal(result.completed_at, null);
  assert.ok(Number.isFinite(Date.parse(result.last_activity_at)));
  const dashboard = await request("/learn/dashboard");
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.match(html, /Fire &amp; Life Safety Awareness/);
  assert.match(html, /16(?:<!-- -->)?%/);
  assert.match(html, /Continue learning/);
  const before = structuredClone(progress[0]);
  assert.equal((await complete(fire.missions[0])).status, 200);
  assert.deepEqual(progress[0], before, "A repeated submission neither increments progress nor rewrites its timestamp");
});

test("all six Fire topics reach 100 percent once, and only then set completed_at", async () => {
  reset(); await enrol();
  for (let index = 0; index < fire.missions.length; index++) {
    const response = await complete(fire.missions[index]);
    assert.equal(response.status, 200);
    const saved = (await response.json()).progress;
    assert.equal(saved.current_mission, String(index + 2));
    assert.equal(saved.progress_percentage, Math.floor(100 * (index + 1) / fire.missions.length));
    if (index < fire.missions.length - 1) assert.equal(saved.completed_at, null);
    else assert.ok(Number.isFinite(Date.parse(saved.completed_at)));
  }
  assert.equal(enrolments.length, 1);
  assert.equal(progress.length, 1);
  const completed = structuredClone(progress[0]);
  assert.equal((await complete(fire.missions.at(-1))).status, 200);
  assert.deepEqual(progress[0], completed);
  const html = await (await request("/learn/dashboard")).text();
  assert.match(html, /100(?:<!-- -->)?%/);
  assert.match(html, /Review programme/);
});

test("optimistic concurrency and malformed stored progress fail closed without overwriting saved records", async () => {
  reset(); await enrol();
  const before = structuredClone(progress[0]);
  conflictOnSave = true;
  const response = await complete(fire.missions[0]);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PROGRESS_CHANGED_RELOAD");
  assert.deepEqual(progress[0], before);
  for (const malformed of [{ current_mission: "bogus" }, { current_mission: String(fire.missions.length + 2) }, { progress_percentage: 101 }]) {
    progress[0] = { ...before, ...malformed };
    const guarded = await complete(fire.missions[0]);
    assert.equal(guarded.status, 409);
    assert.equal((await guarded.json()).error, "PROGRESS_REVIEW_REQUIRED");
  }
});

test("all configured authenticated course pages open video, questions and notes instead of the draft holding screen", async () => {
  reset();
  for (const course of courses) {
    const response = await request(`/learn/courses/${course.localSlug}`);
    assert.equal(response.status, 200, course.localSlug);
    const html = await response.text();
    assert.match(html, /<video|A video is not required/i, `${course.localSlug}: a truthful video placeholder is visible`);
    assert.match(html, /questions/i, `${course.localSlug}: interactive questions are visible`);
    assert.match(html, /notes/i, `${course.localSlug}: notes are visible`);
    assert.match(html, /mark (?:topic )?(?:as )?complete/i, `${course.localSlug}: completion is available`);
    assert.doesNotMatch(html, /Missions awaiting review|Learning access in preparation/);
    assert.doesNotMatch(html, /shop\.capai\.com\.my/);
    assert.doesNotMatch(html, /31 December/);
    assert.doesNotMatch(html, /Please purchase responsibly/);
    assert.doesNotMatch(html, /<summary>Workbook reference/);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  assert.equal(enrolments.length, 0, "Simply viewing a topic does not silently enrol a learner");
  assert.equal(progress.length, 0, "Simply viewing a topic does not create or complete progress");
});

test("all configured topic routes render bilingual reading data and visible teaching lists without writing progress", async () => {
  reset();
  for (const course of courses) {
    enrolments.push({ user_id: user.id, course_id: course.id, status: "active" });
    progress.push({ user_id: user.id, course_id: course.id, current_mission: String(course.missions.length + 1), progress_percentage: 100, completed_at: "2026-01-01T00:00:00Z" });
    for (const missionId of course.missions) {
      const response = await request(`/learn/courses/${course.localSlug}/missions/${missionId}`);
      assert.equal(response.status, 200, missionId);
      const html = await response.text();
      assert.match(html, /<ul class="ksda-teaching-points"/, missionId);
      assert.match(html, /bodyMs/, missionId + " BM reading payload");
      assert.doesNotMatch(html, /Detailed source-based reading is currently in English/, missionId);
    }
  }
  assert.equal(writes.length, 0, "Reading translated modules does not change enrolment or completion");
});
