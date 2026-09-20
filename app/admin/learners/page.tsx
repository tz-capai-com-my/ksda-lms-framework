import { brand } from "@/config/brand";
import type { Metadata } from "next";
import Link from "@/app/SiteLink";
import { requireLmsAdmin } from "@/app/capai-admin";
import { getLearnerReport } from "../learner-report";
import LearnerExport from "./LearnerExport";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Learner Register | ${brand.name}`, robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { images: [] } };
function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString(brand.locale, { timeZone: brand.timeZone, dateStyle: "medium", timeStyle: "short" });
}

export default async function LearnersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = /^\d{1,6}$/.test(params.page || "") ? Math.min(100000, Math.max(1, Number(params.page))) : 1;
  return <LearnerRegister page={page} />;
}

async function LearnerRegister({ page }: { page: number }) {
  const user = await requireLmsAdmin(`/admin/learners?page=${page}`);
  const result = await getLearnerReport(page);
  return <main className="admin-page admin-learners-page">
    <header className="admin-header"><Link href="/admin">← Administration</Link><div><span>Signed in as {user.displayName}</span><Link href={`/admin/learners?page=${page}`}>Refresh records</Link></div></header>
    <section className="admin-heading"><div><p className="eyebrow gold-text">Private · Supabase records</p><h1>Learner register</h1><p>Sign-ups, onboarding and programme enrolments, matched by learner ID.</p></div>
      {result.status === "working" && result.report.total_users !== null && <strong>{result.report.total_users}<small>sign-ups</small></strong>}
    </section>
    {result.status !== "working" ? <section className="admin-empty"><h2>{result.status === "needs-connection" ? "Learner connection pending" : "Records could not be loaded"}</h2><p>{result.status === "needs-connection" ? "The private Supabase reporting connection has not been activated." : "Please refresh this page to try again. Your learner records have not been changed."}</p><p>A missing connection does not mean there are no sign-ups.</p></section> : <>
      <div className="admin-register-tools"><LearnerExport /><p>All sign-ups and enrolments · Excel-compatible CSV · Includes every page.</p></div>
      <p className="admin-register-note">Live read-only records · Updated {date(result.report.fetched_at)} ({brand.timeZone}). A sign-up may appear before email verification, onboarding or course enrolment.</p>
      {result.report.learners.length === 0 ? <section className="admin-empty"><h2>No sign-ups on this page.</h2>{page > 1 && <Link href="/admin/learners">Return to the first page</Link>}</section> : <div className="admin-table-wrap"><table className="admin-table admin-learners-table">
        <thead><tr><th>Learner</th><th>Account</th><th>Sign-up / last sign-in</th><th>Programmes and progress</th></tr></thead>
        <tbody>{result.report.learners.map(learner => <tr key={learner.user_id}>
          <td><strong>{learner.display_name || "Name not provided yet"}</strong>{learner.email ? <a href={`mailto:${learner.email}`}>{learner.email}</a> : <span>No email recorded</span>}<details><summary>Learner ID</summary><code>{learner.user_id}</code></details></td>
          <td><span className="admin-status">{learner.email_verified_at ? "Email verified" : "Email not verified"}</span><p>{learner.onboarding_completed ? "Onboarding completed" : "Onboarding incomplete"}</p><small>{learner.account_status ? `Account: ${learner.account_status}` : "Profile not created"}{learner.preferred_language ? ` · ${learner.preferred_language.toUpperCase()}` : ""}</small></td>
          <td>Joined {date(learner.signed_up_at)}<small>Last sign-in: {date(learner.last_sign_in_at)}</small></td>
          <td>{learner.enrolments.length === 0 ? <p>No course enrolments yet.</p> : learner.enrolments.map(enrolment => <div className="admin-enrolment" key={enrolment.course_id}><strong>{enrolment.title}</strong><span>{enrolment.progress_percentage === null ? "Progress not started" : `${enrolment.progress_percentage}% complete`} · {enrolment.status}</span><small>Enrolled {date(enrolment.enrolled_at)}</small>{enrolment.last_activity_at && <small>Last activity: {date(enrolment.last_activity_at)}</small>}{enrolment.completed_at && <small>Completed {date(enrolment.completed_at)}</small>}</div>)}</td>
        </tr>)}</tbody>
      </table></div>}
      <nav className="admin-register-pagination" aria-label="Learner register pages">{page > 1 && <Link href={`/admin/learners?page=${page - 1}`}>← Previous page</Link>}<span>Page {page} · up to {result.report.page_size} sign-ups per page</span>{result.report.has_more && <Link href={`/admin/learners?page=${page + 1}`}>Next page →</Link>}</nav>
    </>}
    <footer className="admin-footer"><p>Private {brand.name} administration · Dates use {brand.timeZone}. Learner writing is not collected.</p><Link href="/learn">Open learning hub →</Link></footer>
  </main>;
}
