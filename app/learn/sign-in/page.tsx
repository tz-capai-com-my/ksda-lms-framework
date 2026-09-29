import { brand } from "@/config/brand";
import { safeCourseDestination } from "../course-model";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authenticatedLearner, learnerDestination, LearningError } from "../data";
import { supabaseConfig } from "../supabase/config";
import { SignIn } from "../LearnerExperience";
import "./sign-in.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Sign in | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; auth_error?: string }> }) {
 const params = await searchParams;
 const next = safeCourseDestination(params.next);
 let initialError = params.auth_error === "account" ? "account" : params.auth_error === "oauth" ? "oauth" : params.auth_error === "callback" ? "callback" : "";
 let destination = "";
 try { const {user, profile} = await authenticatedLearner(); destination = learnerDestination(user, profile); }
 catch(error) {
   if (error instanceof LearningError && error.code === "ACCOUNT_UNAVAILABLE") initialError = "account";
   else if (!(error instanceof LearningError && error.status === 401)) throw error;
 }
 if(destination && !initialError) redirect(destination === "/learn/dashboard" ? next || destination : `${destination}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
 return <SignIn config={supabaseConfig()} next={next} initialError={initialError} />;
}
