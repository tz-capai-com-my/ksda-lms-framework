import type { Metadata } from "next";
import Link from "../SiteLink";
import { brand } from "@/config/brand";
import { requireLmsAdmin } from "@/app/capai-admin";
import { SignOut } from "@/app/learn/LearnerExperience";
import { supabaseConfig } from "@/app/learn/supabase/config";
import { getLearnerReport } from "./learner-report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Administration | ${brand.name}`,
  description: "Private learner reporting and framework configuration guidance.",
  robots: { index: false, follow: false },
  openGraph: { images: [] }, twitter: { images: [] },
};
export default async function AdministrationPage() {
  const user = await requireLmsAdmin("/admin");
  const learners = await getLearnerReport();
  return <main className="admin-page admin-command-page">
    <header className="admin-header"><Link href="/learn">{brand.name} · Learning hub</Link><div><span>Signed in as {user.email}</span><SignOut config={supabaseConfig()} /></div></header>
    <section className="admin-command-hero">
      <div><p className="eyebrow gold-text">Private administration</p><h1>Learner records.</h1><p>Review sign-ups, programme enrolments and saved progress.</p></div>
      <div className="admin-command-signal"><span>Reporting connection</span><strong>{learners.status === "working" ? "Connected" : learners.status === "needs-connection" ? "Pending" : "Unavailable"}</strong><small>Access requires a verified Supabase email on the server admin allowlist.</small></div>
    </section>
    <section className="admin-command-cards"><Link href="/admin/learners"><span>Learning hub</span><strong>{learners.status === "working" ? learners.report.total_users ?? "—" : "—"}</strong><h2>Learner register</h2><p>Read-only account, onboarding, enrolment and progress records, with a complete CSV export.</p><b>Open learner register →</b></Link></section>
    <section className="admin-connection-note"><h2>Configure this deployment</h2><p>Set the brand in <code>config/brand.ts</code> and use a separate Supabase project for this deployment. Configure the Supabase connection, <code>LMS_ADMIN_EMAILS</code>, <code>LMS_LEARNER_REPORT_URL</code> and the server-only <code>LMS_LEARNER_REPORT_SECRET</code> in your hosting environment.</p><p>An empty admin allowlist denies access. Reporting credentials stay on the server; this page does not display or edit them. Follow the repository setup documentation before connecting a live project.</p></section>
    <section className="admin-connection-note"><h2>Edit learning modules</h2><p>Modules are maintained in the repository under <code>content/ksda/</code>. Review both language versions, course identifiers and completion rules, then run the repository checks before deploying.</p><p>This administration area provides reports. It does not include a module editor or change learner records.</p></section>
    <footer className="admin-footer"><p>Private {brand.name} administration.</p><Link href="/learn">Open learning hub →</Link></footer>
  </main>;
}
