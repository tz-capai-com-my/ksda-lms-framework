import { brand } from "@/config/brand";
import { isLmsAdmin } from "@/app/capai-admin";
import { csvDocument } from "@/app/csv";
import { getLearnerReport } from "../../learner-report";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site" || !await isLmsAdmin()) {
    return Response.json({ error: "ADMIN_REQUIRED" }, { status: 403, headers });
  }
  const rows: unknown[][] = [["Learner ID", "Email", "Display name", "Language", "Email verified (UTC)", "Onboarding completed", "Account status", "Sign-up (UTC)", "Last sign-in (UTC)", "Course ID", "Course title", "Enrolment status", "Enrolled (UTC)", "Progress (%)", "Current mission", "Last activity (UTC)", "Completed (UTC)"]];
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  try {
    // Buffer the complete result: never offer a silently truncated/partial export.
    for (let page = 1; page <= 200; page++) {
      const result = await getLearnerReport(page);
      if (result.status !== "working") throw new Error("REPORT_UNAVAILABLE");
      const report = result.report;
      if (report.page !== page || report.page_size !== 50 || (report.has_more && report.learners.length !== 50)) throw new Error("INVALID_PAGE");
      if (page === 1) expectedTotal = report.total_users;
      if (report.total_users !== expectedTotal) throw new Error("REGISTER_CHANGED_RETRY");
      for (const learner of report.learners) {
        if (!learner.user_id || seen.has(learner.user_id)) throw new Error("REGISTER_CHANGED_RETRY");
        seen.add(learner.user_id);
        const identity = [learner.user_id, learner.email, learner.display_name, learner.preferred_language, learner.email_verified_at, learner.onboarding_completed ? "Yes" : "No", learner.account_status, learner.signed_up_at, learner.last_sign_in_at];
        if (!learner.enrolments.length) rows.push([...identity, "", "", "Not enrolled", "", "", "", "", ""]);
        for (const course of learner.enrolments) rows.push([...identity, course.course_id, course.title, course.status, course.enrolled_at, course.progress_percentage, course.current_mission, course.last_activity_at, course.completed_at]);
      }
      if (!report.has_more) {
        if (expectedTotal !== null && seen.size !== expectedTotal) throw new Error("REGISTER_CHANGED_RETRY");
        return new Response(csvDocument(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${brand.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "KSDA"}_Learner_Register_${new Date().toISOString().slice(0, 10)}.csv"` } });
      }
    }
    throw new Error("EXPORT_LIMIT");
  } catch {
    return Response.json({ error: "EXPORT_UNAVAILABLE", message: "The full export could not be prepared. Please retry." }, { status: 503, headers });
  }
}
