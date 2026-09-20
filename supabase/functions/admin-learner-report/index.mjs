/* global Deno */
// Read-only, server-to-server admin report. No learner JWT or public key grants access.
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const scope = "lms.admin-learner-report.v1";
const encoder = new TextEncoder();
const pageSize = 50;
const response = (status, body) => Response.json(body, { status, headers: {
  "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
} });

export async function handleReport(request, options = {}) {
  const getEnv = options.getEnv || (name => Deno.env.get(name));
  if (request.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });
  const secret = getEnv("LMS_LEARNER_REPORT_SECRET");
  if (!secret || secret.length < 32) return response(503, { error: "REPORT_NOT_CONFIGURED" });
  const timestamp = request.headers.get("X-LMS-Timestamp") || "";
  const signature = request.headers.get("X-LMS-Signature") || "";
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 120 || !/^[a-f0-9]{64}$/.test(signature)) {
    return response(401, { error: "UNAUTHORIZED" });
  }
  // Bound actual bytes before buffering the request, including chunked requests.
  const reader = request.body?.getReader();
  if (!reader) return response(400, { error: "INVALID_REQUEST" });
  let raw = "", size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 256) { await reader.cancel(); return response(413, { error: "TOO_LARGE" }); }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/.{2}/g), byte => parseInt(byte, 16));
  if (!await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`${scope}\n${timestamp}\n${raw}`))) {
    return response(401, { error: "UNAUTHORIZED" });
  }
  let payload;
  try { payload = JSON.parse(raw); } catch { return response(400, { error: "INVALID_REQUEST" }); }
  if (!payload || Object.keys(payload).length !== 1 || !Number.isInteger(payload.page) || payload.page < 1 || payload.page > 100000) {
    return response(400, { error: "INVALID_REQUEST" });
  }
  try {
    let admin;
    if (options.createAdmin) admin = options.createAdmin();
    else {
      // Supabase injects these credentials; they never leave this Edge Function.
      const keys = JSON.parse(getEnv("SUPABASE_SECRET_KEYS") || "{}");
      const adminKey = keys.default || getEnv("SUPABASE_SERVICE_ROLE_KEY");
      if (!adminKey || !getEnv("SUPABASE_URL")) return response(503, { error: "REPORT_NOT_CONFIGURED" });
      admin = createClient(getEnv("SUPABASE_URL"), adminKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
      });
    }
    const { data, error } = await admin.auth.admin.listUsers({ page: payload.page, perPage: pageSize });
    if (error) throw new Error("AUTH_QUERY_FAILED");
    const users = data.users;
    const ids = users.map(user => user.id);
    const rows = async (table, fields, column, values) => {
      if (!values.length) return [];
      const result = [];
      for (let start = 0; start < 10000; start += 500) {
        const query = await admin.from(table).select(fields).in(column, values).order(table === "profiles" ? "user_id" : "id").range(start, start + 499);
        if (query.error) throw new Error("REPORT_QUERY_FAILED");
        result.push(...query.data);
        if (query.data.length < 500) return result;
      }
      throw new Error("REPORT_TOO_LARGE");
    };
    const [profiles, enrolments, progress] = await Promise.all([
      rows("profiles", "user_id,display_name,preferred_language,onboarding_completed,account_status", "user_id", ids),
      rows("module_enrolments", "id,user_id,course_id,enrolled_at,status", "user_id", ids),
      rows("module_progress", "id,user_id,course_id,current_mission,progress_percentage,last_activity_at,completed_at", "user_id", ids),
    ]);
    const courseIds = [...new Set(enrolments.map(row => row.course_id))];
    const courses = await rows("courses", "id,title,slug", "id", courseIds);
    const profileMap = new Map(profiles.map(row => [row.user_id, row]));
    const courseMap = new Map(courses.map(row => [row.id, row]));
    const progressMap = new Map(progress.map(row => [`${row.user_id}:${row.course_id}`, row]));
    const learners = users.map(user => {
      const profile = profileMap.get(user.id);
      return {
        user_id: user.id, email: user.email || null, signed_up_at: user.created_at,
        email_verified_at: user.email_confirmed_at || null, last_sign_in_at: user.last_sign_in_at || null,
        display_name: profile?.display_name || null, preferred_language: profile?.preferred_language || null,
        onboarding_completed: profile?.onboarding_completed === true, account_status: profile?.account_status || null,
        enrolments: enrolments.filter(row => row.user_id === user.id).map(row => {
          const course = courseMap.get(row.course_id), saved = progressMap.get(`${user.id}:${row.course_id}`);
          return { course_id: row.course_id, title: course?.title || "Course unavailable", status: row.status,
            enrolled_at: row.enrolled_at, progress_percentage: saved?.progress_percentage ?? null,
            current_mission: saved?.current_mission ?? null, last_activity_at: saved?.last_activity_at || null,
            completed_at: saved?.completed_at || null };
        }),
      };
    });
    // Do not rely on auth-js pagination links (older parsers truncate multi-digit pages).
    const total = Number.isInteger(data.total) && (data.total > 0 || !users.length && payload.page === 1) ? data.total : null;
    return response(200, { page: payload.page, page_size: pageSize, total_users: total,
      has_more: total === null ? users.length === pageSize : payload.page * pageSize < total,
      fetched_at: new Date().toISOString(), learners });
  } catch {
    return response(503, { error: "REPORT_UNAVAILABLE" });
  }
}

if (typeof Deno !== "undefined") Deno.serve(request => handleReport(request));
