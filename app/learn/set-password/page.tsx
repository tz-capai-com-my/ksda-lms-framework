import { brand } from "@/config/brand";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLearner, learnerDestination } from "../data";
import { PasswordSettings } from "../PasswordSettings";
import { supabaseConfig } from "../supabase/config";
import { safeCourseDestination } from "../course-model";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Set your password | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeCourseDestination((await searchParams).next);
  const { user, profile } = await requireLearner(false, next);
  if (!user.email_confirmed_at) redirect("/learn/sign-in?auth_error=account");
  if (profile?.onboarding_completed) redirect(next || "/learn/dashboard");
  // This user-editable marker avoids repeating a completed UX step. It is
  // never used to grant access or bypass learner/server authorization.
  if (learnerDestination(user, profile) === "/learn/onboarding") redirect(`/learn/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return <main><PasswordSettings config={supabaseConfig()} email={user.email || ""} userId={user.id} mode="setup" next={next} /></main>;
}
