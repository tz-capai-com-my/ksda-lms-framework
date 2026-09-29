import { brand } from "@/config/brand";
import { safeCourseDestination } from "./course-model";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { supabaseConfig } from "./supabase/config";
import { learnerServerClient } from "./supabase/server";
import { courseColumns, profileColumns, databaseSlug, type Course, type Profile } from "./course-model";

export async function publishedCourses(): Promise<{ courses: Course[]; unavailable: boolean }> {
  try {
    const config = supabaseConfig();
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
    const { data, error } = await client.from("courses").select(courseColumns).eq("status", "published").order("sort_order");
    if (error) throw error;
    return { courses: data || [], unavailable: false };
  } catch { return { courses: [], unavailable: true }; }
}

export class LearningError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
// A journey choice only: this marker is user-editable and grants no access.
// Google identities come from Supabase-managed app metadata, never form input.
export function learnerDestination(user: User, profile: Profile | null): "/learn/dashboard" | "/learn/onboarding" | "/learn/set-password" {
  if (profile?.onboarding_completed) return "/learn/dashboard";
  const providers = user.app_metadata?.providers;
  const google = user.app_metadata?.provider === "google" || (Array.isArray(providers) && providers.includes("google"));
  return brand.features.passwordLogin && brand.features.passwordSetup && !google && user.user_metadata?.ksda_password_set !== true ? "/learn/set-password" : "/learn/onboarding";
}
export async function authenticatedLearner(reportAuthFailure = false) {
  const client = await learnerServerClient();
  return authenticatedLearnerWithClient(client, reportAuthFailure);
}
// OAuth routes supply a request-local client whose cookie writes are attached
// explicitly to the final response. All learner methods share these checks.
export async function authenticatedLearnerWithClient(client: Awaited<ReturnType<typeof learnerServerClient>>, reportAuthFailure = false) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    // A provider outage is not a logout. Keep authorization closed, but allow
    // the learner to retry without consuming another one-time code.
    const rejected = error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403;
    if (reportAuthFailure) {
      // Only diagnostic categories: never log email, UUID, cookies or tokens.
      console.warn("LMS learner session check failed", {
        name: error.name?.replace(/[^a-zA-Z0-9_]/g, "").slice(0,64),
        code: error.code?.replace(/[^a-zA-Z0-9_]/g, "").slice(0,64),
        status: error.status,
      });
    }
    if (!rejected) throw new LearningError("AUTH_UNAVAILABLE", 503);
    throw new LearningError("SIGN_IN_REQUIRED", 401);
  }
  if (!user) throw new LearningError("SIGN_IN_REQUIRED", 401);
  const result = await client.from("profiles").select(profileColumns).eq("user_id", user.id).maybeSingle();
  if (result.error) throw new LearningError("PROFILE_UNAVAILABLE");
  const profile = result.data as Profile | null;
  if (profile && profile.account_status !== "active") throw new LearningError("ACCOUNT_UNAVAILABLE", 403);
  return { client, user, profile };
}
export async function requireLearner(onboarded = true, returnTo = "") {
  const next = safeCourseDestination(returnTo);
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  let learner;
  try { learner = await authenticatedLearner(); }
  catch (error) {
    if (error instanceof LearningError && error.status === 401) redirect(`/learn/sign-in${suffix}`);
    throw error;
  }
  if (onboarded && !learner.profile?.onboarding_completed) redirect(`${learnerDestination(learner.user, learner.profile)}${suffix}`);
  return learner;
}
export async function courseBySlug(client: Awaited<ReturnType<typeof learnerServerClient>>, slug: string) {
  const { data, error } = await client.from("courses").select(courseColumns).eq("slug", databaseSlug(slug)).eq("status", "published").maybeSingle();
  if (error) throw new LearningError("CATALOGUE_UNAVAILABLE");
  return data as Course | null;
}
