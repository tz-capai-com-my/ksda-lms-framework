import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyEnvelope, type ReviewEnvelope, type ReleaseManifest } from "../reading-review/model";
import { READING_CODE_HASH } from "./reading-build";
import { getFreeCourse } from "./free-content";
import { LearningError } from "./data";

export async function loadReading(client: SupabaseClient, scope: "learner", release: string | null, mission: string | null, course?: string) {
  const { data, error } = await client.rpc("ksda_reading_delivery", { p_scope: scope, p_release: release, p_mission: mission });
  if (error) throw new LearningError(error.code === "42501" ? "READING_ACCESS_DENIED" : "READING_UNAVAILABLE", error.code === "42501" ? 403 : 503);
  if (data === null) {
    if (release) throw new LearningError("READING_UNAVAILABLE");
    return null; // Deliberate no-active-release fallback; errors never silently downgrade.
  }
  const verified = await verifyEnvelope(data as ReviewEnvelope, { scope, code: READING_CODE_HASH, release: release ?? undefined, mission: mission ?? undefined, course });
  if (course) {
    const expected = getFreeCourse(course)?.topics.map(t => t.id);
    const manifest = JSON.parse(verified.manifest_text) as ReleaseManifest;
    const actual = manifest.missions.filter(m => m.course_key === course).map(m => m.mission_id);
    if (!expected || JSON.stringify(actual) !== JSON.stringify(expected)) throw new LearningError("MISSION_ORDER_MISMATCH");
  }
  return verified;
}
