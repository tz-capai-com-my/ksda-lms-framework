import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

// Entirely offline: no OAuth provider, real learner, email or database write.
register("./cloudflare-workers-loader.mjs", import.meta.url);
process.env.SUPABASE_URL = "https://independent-fixture.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_offline_fixture";
const origin = "https://learning.example.com";
const cookieName = "sb-independent-fixture-auth-token";
const verifier = "offline-pkce-verifier";
const verifierCookie = `${cookieName}-code-verifier=base64-${Buffer.from(JSON.stringify(verifier)).toString("base64url")}`;
const user = { id: "00000000-0000-4000-8000-000000000123", aud: "authenticated", role: "authenticated", email: "offline@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "google", providers: ["email", "google"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
let profile = { user_id: user.id, display_name: "Existing learner", preferred_language: "ms", onboarding_completed: true, account_status: "active" };
let rejectCode = false, authUnavailable = false, authRejected = false, exchanges = 0;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  assert.equal(url.origin, process.env.SUPABASE_URL, "No test can make external requests");
  if (url.pathname === "/auth/v1/token") {
    exchanges++;
    assert.equal(request.method, "POST");
    assert.equal(url.searchParams.get("grant_type"), "pkce");
    const body = await request.json();
    assert.equal(body.code_verifier, verifier);
    assert.equal(body.auth_code, "offline-code");
    if (rejectCode) return Response.json({ code: "flow_state_expired", message: "Expired offline code" }, { status: 400 });
    return Response.json({ access_token: "offline-invalid-in-production", refresh_token: "offline-refresh", token_type: "bearer", expires_in: 3600, user });
  }
  if (url.pathname === "/auth/v1/user") {
    assert.equal(request.method, "GET");
    if (authUnavailable) return Response.json({ code: "unexpected_failure", message: "Offline outage" }, { status: 503 });
    if (authRejected) return Response.json({ code: "bad_jwt", message: "Offline rejection" }, { status: 401 });
    return Response.json(user);
  }
  assert.equal(request.method, "GET", "Login must not write to learning tables");
  if (url.pathname === "/rest/v1/profiles") { assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`); return Response.json(profile); }
  if (url.pathname === "/rest/v1/module_enrolments" || url.pathname === "/rest/v1/module_progress") { assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`); return Response.json([]); }
  throw new Error("Unexpected offline request: " + url.pathname);
};
const worker = (await import("../dist/server/index.js")).default;
const bindings = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const call = (path, cookie = verifierCookie) => worker.fetch(new Request(origin + path, { headers: { cookie, "x-forwarded-host": "attacker.invalid" } }), bindings, ctx);
function privateRedirect(response) {
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")).origin, origin);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
}
function browserCookies(response) {
  return response.headers.getSetCookie().filter(cookie => !/Max-Age=0(?:;|$)/i.test(cookie)).map(cookie => cookie.split(";", 1)[0]).join("; ");
}

test("Google callback persists single/chunked cookies and the existing learner identity", async () => {
  for (const padding of ["", "x".repeat(5000)]) {
    user.user_metadata = { padding };
    const response = await call("/learn/auth/callback?code=offline-code&next=%2Flearn%2Fcourses%2Ffire-life-safety");
    privateRedirect(response);
    assert.equal(response.headers.get("location"), origin + "/learn/courses/fire-life-safety");
    const setCookies = response.headers.getSetCookie();
    assert.ok(setCookies.some(cookie => cookie.startsWith("ksda_locale=ms;")));
    assert.ok(setCookies.some(cookie => cookie.includes("-code-verifier=") && /Max-Age=0/i.test(cookie)));
    const authCookies = setCookies.filter(cookie => cookie.startsWith(cookieName) && !cookie.includes("-code-verifier="));
    assert.ok(authCookies.some(cookie => padding ? cookie.startsWith(cookieName + ".0=") : cookie.startsWith(cookieName + "=")));
    for (const cookie of authCookies) { assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=Lax/i); assert.match(cookie, /Path=\//i); }
    const session = await call("/learn/api/session", browserCookies(response));
    assert.equal(session.status, 200);
    const data = await session.json();
    assert.equal(data.profile.user_id, user.id);
    assert.equal(data.profile.preferred_language, "ms");
    assert.equal(data.destination, "/learn/dashboard");
  }
  user.user_metadata = {};
});

test("invalid return destinations cannot escape the app; new learners retain onboarding", async () => {
  for (const next of ["https://attacker.invalid", "//attacker.invalid", "/learn/courses/unknown", "/learn/courses/fire-life-safety?next=https://attacker.invalid"]) {
    const response = await call(`/learn/auth/callback?code=offline-code&next=${encodeURIComponent(next)}`);
    privateRedirect(response);
    assert.equal(response.headers.get("location"), origin + "/learn/dashboard");
  }
  // Existing framework admin return routes remain supported; the destination independently checks its allowlist.
  const adminReturn = await call("/learn/auth/callback?code=offline-code&next=%2Fadmin");
  assert.equal(adminReturn.headers.get("location"), origin + "/admin");
  assert.equal(new URL((await call("/admin", browserCookies(adminReturn))).headers.get("location"), origin).pathname, "/learn/dashboard");
  const existing = profile;
  profile = null;
  const response = await call("/learn/auth/callback?code=offline-code&next=%2Flearn%2Fcourses%2Ffire-life-safety");
  assert.equal(response.headers.get("location"), origin + "/learn/onboarding?next=%2Flearn%2Fcourses%2Ffire-life-safety");
  profile = existing;
});

test("missing, duplicate, cancelled and expired codes fail safely without leaking values", async () => {
  exchanges = 0;
  for (const path of ["/learn/auth/callback", "/learn/auth/callback?code=", "/learn/auth/callback?code=one&code=two", "/learn/auth/callback?error=access_denied&error_description=private-detail"]) {
    const response = await call(path);
    privateRedirect(response);
    assert.equal(response.headers.get("location"), origin + "/learn/sign-in?auth_error=callback");
  }
  assert.equal(exchanges, 0);
  const missingVerifier = await call("/learn/auth/callback?code=offline-code", "");
  privateRedirect(missingVerifier);
  assert.equal(exchanges, 0);
  rejectCode = true;
  const expired = await call("/learn/auth/callback?code=offline-code");
  privateRedirect(expired);
  assert.equal(expired.headers.get("location"), origin + "/learn/sign-in?auth_error=callback");
  rejectCode = false;
});

test("suspended/rejected accounts stay closed and Auth outages retain retryable cookies", async () => {
  profile.account_status = "suspended";
  const blocked = await call("/learn/auth/callback?code=offline-code");
  privateRedirect(blocked);
  assert.equal(blocked.headers.get("location"), origin + "/learn/sign-in?auth_error=account");
  assert.equal((await call("/learn/api/session", browserCookies(blocked))).status, 403);
  profile.account_status = "active";
  authRejected = true;
  const rejected = await call("/learn/auth/callback?code=offline-code");
  privateRedirect(rejected);
  assert.equal(rejected.headers.get("location"), origin + "/learn/sign-in?auth_error=callback");
  authRejected = false;
  authUnavailable = true;
  const outage = await call("/learn/auth/callback?code=offline-code");
  privateRedirect(outage);
  assert.ok(browserCookies(outage).includes(cookieName));
  authUnavailable = false;
  assert.equal((await call("/learn/api/session", browserCookies(outage))).status, 200);
});

test("recovery PKCE exchanges the verifier and opens a protected reset page", async () => {
  const recoveryVerifier = `${cookieName}-code-verifier=base64-${Buffer.from(JSON.stringify(verifier + "/recovery")).toString("base64url")}`;
  const response = await call("/learn/auth/callback?code=offline-code&next=https://attacker.invalid", recoveryVerifier);
  privateRedirect(response);
  assert.equal(response.headers.get("location"), origin + "/learn/reset-password");
  const page = await call("/learn/reset-password", browserCookies(response));
  assert.equal(page.status, 200);
  assert.match(page.headers.get("cache-control"), /no-store/);
  assert.match(await page.text(), /Reset your learning password/);
  // A prior valid login cannot make a reset code without its verifier succeed.
  const priorExchanges = exchanges;
  const failed = await call("/learn/auth/callback?code=offline-code", browserCookies(response));
  assert.equal(exchanges, priorExchanges);
  assert.equal(failed.headers.get("location"), origin + "/learn/sign-in?auth_error=callback");
});

test("new email password journey, Google exemption and existing profiles preserve routing", async () => {
  const previousProfile = profile, previousMetadata = user.app_metadata;
  const response = await call("/learn/auth/callback?code=offline-code");
  const cookies = browserCookies(response);
  profile = null;
  user.app_metadata = { provider: "email", providers: ["email"] };
  assert.equal((await (await call("/learn/api/session", cookies)).json()).destination, "/learn/set-password");
  const first = await call("/learn/set-password", cookies);
  assert.equal(first.status, 200);
  assert.match(await first.text(), /Set your learning password/);
  const incomplete = await call("/learn/onboarding?next=https://attacker.invalid", cookies);
  assert.equal(new URL(incomplete.headers.get("location"), origin).pathname, "/learn/set-password");
  assert.equal(new URL(incomplete.headers.get("location"), origin).search, "");
  user.user_metadata = { ksda_password_set: true };
  assert.equal((await (await call("/learn/api/session", cookies)).json()).destination, "/learn/onboarding");
  user.user_metadata = {};
  user.app_metadata = previousMetadata;
  assert.equal((await (await call("/learn/api/session", cookies)).json()).destination, "/learn/onboarding");
  assert.equal(new URL((await call("/learn/set-password", cookies)).headers.get("location"), origin).pathname, "/learn/onboarding");
  profile = previousProfile;
  user.app_metadata = { provider: "email", providers: ["email"] };
  assert.equal((await (await call("/learn/api/session", cookies)).json()).destination, "/learn/dashboard");
  assert.equal(new URL((await call("/learn/onboarding", cookies)).headers.get("location"), origin).pathname, "/learn/dashboard");
  user.app_metadata = previousMetadata;
});

test("recovery rejects inactive accounts and unverified password-page access", async () => {
  const recoveryVerifier = `${cookieName}-code-verifier=base64-${Buffer.from(JSON.stringify(verifier + "/recovery")).toString("base64url")}`;
  profile.account_status = "suspended";
  const blocked = await call("/learn/auth/callback?code=offline-code", recoveryVerifier);
  assert.equal(blocked.headers.get("location"), origin + "/learn/sign-in?auth_error=account");
  profile.account_status = "active";
  const response = await call("/learn/auth/callback?code=offline-code", recoveryVerifier);
  const verifiedAt = user.email_confirmed_at;
  user.email_confirmed_at = null;
  const denied = await call("/learn/reset-password", browserCookies(response));
  assert.equal(new URL(denied.headers.get("location"), origin).pathname, "/learn/sign-in");
  assert.equal(new URL(denied.headers.get("location"), origin).search, "?auth_error=account");
  user.email_confirmed_at = verifiedAt;
});

