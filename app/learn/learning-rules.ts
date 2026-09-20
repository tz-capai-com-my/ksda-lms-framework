// Pure, deterministic rules. No learner writing, AI judgement or per-block history.
export type Checkpoint = { id: string; question: string; options: string[]; correctOption: string };
export type MissionRule = { id: string; requiredCheckpoints: Checkpoint[]; actionRequired: boolean; reviewRequired: boolean };
export type CourseRules = { reviewed: boolean; missions: MissionRule[] };

// Populate only from reviewed course/checkpoint assets. The supplied 28 missions
// are DRAFT and have no approved executable checkpoints; do not invent answers.
export const approvedRules: Record<string, CourseRules> = {};

// Supabase stores current_mission as text. Validate it before sequence checks;
// do not rely on coercion or let malformed records unlock a later mission.
export function missionNumber(value: unknown): number {
  const number = typeof value === "number" ? value
    : typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("INVALID_STORED_MISSION");
  return number;
}

export function progressAfter(completedMissions: number, totalMissions: number) {
  if (!Number.isInteger(totalMissions) || totalMissions < 1 || !Number.isInteger(completedMissions) || completedMissions < 0 || completedMissions > totalMissions) throw new Error("INVALID_PROGRESS");
  return { current_mission: completedMissions + 1, progress_percentage: Math.floor(100 * completedMissions / totalMissions) };
}

export function evaluateCheckpoint(rule: MissionRule, payload: Record<string, unknown>) {
  if (!rule.requiredCheckpoints.length) return false;
  const answers = payload.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  const supplied = answers as Record<string, unknown>;
  if (Object.keys(supplied).length !== rule.requiredCheckpoints.length) return false;
  return rule.requiredCheckpoints.every(c => c.options.includes(String(supplied[c.id])) && supplied[c.id] === c.correctOption)
    && (!rule.actionRequired || payload.actionConfirmed === true)
    && (!rule.reviewRequired || payload.reviewConfirmed === true);
}
