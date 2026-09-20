import { brand } from "@/config/brand";
import { safeCourseDestination } from "../course-model";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authenticatedLearner, LearningError } from "../data";
import { supabaseConfig } from "../supabase/config";
import { SignIn } from "../LearnerExperience";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Continue with email | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
 const next = safeCourseDestination((await searchParams).next);
 let destination = "";
 try { const {profile} = await authenticatedLearner(); destination = profile?.onboarding_completed ? "/learn/dashboard" : "/learn/onboarding"; }
 catch(error) { if (!(error instanceof LearningError && error.status === 401)) throw error; }
 if(destination) redirect(destination === "/learn/dashboard" ? next || destination : `${destination}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
 return <SignIn config={supabaseConfig()} next={next} />;
}
