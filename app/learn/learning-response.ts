// Validate only the response fields the client consumes before updating its UI.
export type LearningSessionResponse = {
  destination: "/learn/dashboard" | "/learn/onboarding";
  profile: { preferred_language: string; onboarding_completed: boolean } | null;
};
export type LearningProgressResponse = {
  progress: { current_mission: number; progress_percentage: number };
};
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function learningErrorCode(value: unknown): string {
  return record(value) && typeof value.error === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.error)
    ? value.error : "LEARNING_UNAVAILABLE";
}
export function parseLearningSession(value: unknown): LearningSessionResponse {
  if (!record(value)) throw new Error("LEARNING_UNAVAILABLE");
  const destination = value.destination;
  if (destination !== "/learn/dashboard" && destination !== "/learn/onboarding") throw new Error("LEARNING_UNAVAILABLE");
  if (value.profile === null && destination === "/learn/onboarding") return { destination, profile: null };
  const profile = value.profile;
  if (!record(profile) || typeof profile.preferred_language !== "string" || typeof profile.onboarding_completed !== "boolean") {
    throw new Error("LEARNING_UNAVAILABLE");
  }
  if (destination !== (profile.onboarding_completed ? "/learn/dashboard" : "/learn/onboarding")) {
    throw new Error("LEARNING_UNAVAILABLE");
  }
  return { destination, profile: { preferred_language: profile.preferred_language, onboarding_completed: profile.onboarding_completed } };
}
export function parseLearningProgress(value: unknown, totalTopics: number): LearningProgressResponse {
  const progress = record(value) ? value.progress : undefined;
  if (!record(progress) || !Number.isSafeInteger(totalTopics) || totalTopics < 1) throw new Error("PROGRESS_REVIEW_REQUIRED");
  const stored = progress.current_mission;
  const current = typeof stored === "number" ? stored
    : typeof stored === "string" && /^[1-9]\d*$/.test(stored) ? Number(stored) : NaN;
  const percentage = progress.progress_percentage;
  if (!Number.isSafeInteger(current) || current < 1 || current > totalTopics + 1
    || typeof percentage !== "number" || !Number.isInteger(percentage)
    || percentage !== Math.floor(100 * (current - 1) / totalTopics)) {
    throw new Error("PROGRESS_REVIEW_REQUIRED");
  }
  return { progress: { current_mission: current, progress_percentage: percentage } };
}
