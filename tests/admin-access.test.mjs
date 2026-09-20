import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
register("./admin-workers-loader.mjs", import.meta.url);
const secret = "test-only-never-real-secret-for-fixtures";
const supabaseUrl = "https://example.supabase.co";
globalThis.adminTestBindings = { LMS_ADMIN_EMAILS: "owner@example.invalid", SUPABASE_URL: supabaseUrl, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_offline_fixture", LMS_LEARNER_REPORT_URL: supabaseUrl + "/functions/v1/admin-learner-report", LMS_LEARNER_REPORT_SECRET: secret };
let reportCalls = 0, authCalls = 0, identity, confirmed = true, rejected = false;
const report = { page: 1, page_size: 50, total_users: 1, has_more: false, fetched_at: "2026-09-19T00:00:00Z", learners: [{ user_id: "fixture-user", email: "learner@example.invalid", signed_up_at: "2026-09-01", email_verified_at: "2026-09-01", last_sign_in_at: null, display_name: null, preferred_language: null, onboarding_completed: false, account_status: null, enrolments: [] }] };
function cookie(email) {
  const user = { id: "fixture-admin", email, aud: "authenticated", role: "authenticated", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { role: "admin" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  return "sb-example-auth-token=base64-" + Buffer.from(JSON.stringify({ access_token: "offline-access-token", refresh_token: "offline-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user })).toString("base64url");
}
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  assert.equal(url.origin, supabaseUrl, "No external services are contacted");
  if (url.pathname === "/auth/v1/user") {
    authCalls++;
    assert.equal(request.headers.get("authorization"), "Bearer offline-access-token");
    if (rejected) return Response.json({ message: "Offline revoked session", code: "bad_jwt" }, { status: 401 });
    return Response.json({ id: "fixture-admin", email: identity, aud: "authenticated", role: "authenticated", email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null, app_metadata: {}, user_metadata: { role: "admin" }, created_at: "2026-01-01T00:00:00Z" });
  }
  assert.equal(url.pathname, "/functions/v1/admin-learner-report");
  assert.equal(request.method, "POST");
  assert.match(request.headers.get("X-LMS-Signature"), /^[a-f0-9]{64}$/);
  reportCalls++;
  return Response.json(report);
};
const worker = (await import("../dist/server/index.js")).default;
function load(email, { claim = email, headers = {}, verified = true, reject = false, path = "/admin/learners" } = {}) {
  identity = email; confirmed = verified; rejected = reject;
  return worker.fetch(new Request("https://lms.example.invalid" + path, { headers: { ...headers, ...(claim ? { cookie: cookie(claim) } : {}) } }), {}, { waitUntil() {}, passThroughOnException() {} });
}
test("anonymous and non-admin users cannot read reports, even with forged Sites headers or cookie metadata", async () => {
  reportCalls = 0;
  const anonymous = await load(undefined, { headers: { "oai-authenticated-user-email": "owner@example.invalid" } });
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get("location"), /\/learn\/sign-in\?next=/);
  assert.match(anonymous.headers.get("cache-control"), /no-store/);
  const learner = await load("learner@example.invalid", { claim: "owner@example.invalid", headers: { "oai-authenticated-user-email": "owner@example.invalid" } });
  assert.equal(learner.status, 307);
  assert.match(learner.headers.get("location"), /\/learn\/dashboard$/);
  assert.doesNotMatch(await learner.text(), /fixture-user|learner@example.invalid/);
  assert.equal(reportCalls, 0);
});
test("only a remotely verified, confirmed allowlisted email can render the private report", async () => {
  reportCalls = 0; authCalls = 0;
  globalThis.adminTestBindings.LMS_ADMIN_EMAILS = " other@example.invalid, OWNER@example.invalid ";
  const response = await load("owner@example.invalid");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /learner@example.invalid/);
  assert.match(html, /Onboarding incomplete/);
  assert.match(html, /No course enrolments yet/);
  assert.doesNotMatch(html, /test-only-never-real-secret|X-LMS-Signature|SUPABASE_SERVICE_ROLE_KEY/);
  assert.ok(authCalls > 0); assert.ok(reportCalls > 0);
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("unconfirmed and revoked sessions fail closed before a reporting request", async () => {
  reportCalls = 0;
  for (const options of [{ verified: false }, { reject: true }]) {
    const response = await load("owner@example.invalid", options);
    assert.equal(response.status, 307);
    assert.doesNotMatch(await response.text(), /fixture-user/);
  }
  assert.equal(reportCalls, 0);
});
test("an explicitly empty allowlist denies access even when a process default allows the email", async () => {
  process.env.LMS_ADMIN_EMAILS = "owner@example.invalid";
  globalThis.adminTestBindings.LMS_ADMIN_EMAILS = "";
  reportCalls = 0;
  const response = await load("owner@example.invalid");
  assert.equal(response.status, 307);
  assert.equal(reportCalls, 0);
  delete process.env.LMS_ADMIN_EMAILS;
  globalThis.adminTestBindings.LMS_ADMIN_EMAILS = "owner@example.invalid";
});
test("process environment works when worker bindings are absent; overview has no community dependency", async () => {
  const bindings = globalThis.adminTestBindings;
  for (const [name, value] of Object.entries(bindings)) process.env[name] = value;
  globalThis.adminTestBindings = {};
  try {
    const response = await load("owner@example.invalid", { path: "/admin" });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Edit learning modules/);
    assert.match(html, /\/admin\/learners/);
    assert.doesNotMatch(html, /\/admin\/intake|Community enquiries|test-only-never-real-secret/);
  } finally {
    for (const name of Object.keys(bindings)) delete process.env[name];
    globalThis.adminTestBindings = bindings;
  }
});
test("missing reporting configuration is pending and performs no report read", async () => {
  delete globalThis.adminTestBindings.LMS_LEARNER_REPORT_SECRET;
  reportCalls = 0;
  const response = await load("owner@example.invalid");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Learner connection pending/);
  assert.equal(reportCalls, 0);
  globalThis.adminTestBindings.LMS_LEARNER_REPORT_SECRET = secret;
});
