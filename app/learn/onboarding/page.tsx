import { brand } from "@/config/brand";
import { safeCourseDestination } from "../course-model";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLearner } from "../data";
import { ProfileForm } from "../LearnerExperience";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Complete your profile | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeCourseDestination((await searchParams).next);
  const { user, profile } = await requireLearner(false, next);
  if (profile?.onboarding_completed) redirect(next || "/learn/dashboard");
  return <ProfileForm email={user.email || ""} profile={profile} onboarding next={next} />;
}
