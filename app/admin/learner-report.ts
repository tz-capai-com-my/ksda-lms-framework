import { serverSetting } from "@/app/learn/supabase/config";
import { isLmsAdmin } from "@/app/capai-admin";

export type AdminLearner = {
  user_id: string; email: string | null; signed_up_at: string; email_verified_at: string | null;
  last_sign_in_at: string | null; display_name: string | null; preferred_language: string | null;
  onboarding_completed: boolean; account_status: string | null;
  enrolments: { course_id: string; title: string; status: string; enrolled_at: string;
    progress_percentage: number | null; current_mission: string | null; last_activity_at: string | null; completed_at: string | null }[];
};
export type LearnerReport = { page: number; page_size: number; total_users: number | null; has_more: boolean; fetched_at: string; learners: AdminLearner[] };
export type ReportResult = { status: "working"; report: LearnerReport } | { status: "needs-connection" | "unavailable" };

export async function getLearnerReport(page = 1): Promise<ReportResult> {
  // Defence in depth: the bridge can never be called with a learner session alone.
  if (!await isLmsAdmin()) throw new Error("ADMIN_REQUIRED");
  const secret = serverSetting("LMS_LEARNER_REPORT_SECRET");
  const url = serverSetting("LMS_LEARNER_REPORT_URL");
  if (!secret || secret.length < 32 || !url) return { status: "needs-connection" };
  try {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) return { status: "needs-connection" };
  } catch { return { status: "needs-connection" }; }
  try {
    const body = JSON.stringify({ page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`lms.admin-learner-report.v1\n${timestamp}\n${body}`));
    const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch(url, { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-LMS-Timestamp": timestamp, "X-LMS-Signature": hex },
      body, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { status: "unavailable" };
    const report = await response.json() as LearnerReport;
    if (!Array.isArray(report.learners) || report.learners.length > 50 || report.page < 1 || typeof report.has_more !== "boolean") return { status: "unavailable" };
    return { status: "working", report };
  } catch { return { status: "unavailable" }; }
}
