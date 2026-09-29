import { authenticatedLearner, learnerDestination, courseBySlug, LearningError } from "../../data";
import { reviewedCourse } from "../../content";
import { getFreeCourse } from "../../free-content";
import { profileColumns, progressColumns } from "../../course-model";
import { evaluateCheckpoint, missionNumber, progressAfter } from "../../learning-rules";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
type Context = { params: Promise<{ path: string[] }> };
function fail(error: unknown) {
  return error instanceof LearningError ? json({ error: error.code }, error.status) : json({ error: "LEARNING_UNAVAILABLE" }, 503);
}
function keysOnly(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new LearningError("INVALID_REQUEST", 400);
}

export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).path.join("/") !== "session") return json({ error: "NOT_FOUND" }, 404);
    const { user, profile } = await authenticatedLearner(true);
    return json({ email: user.email, profile, destination: learnerDestination(user, profile) });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new LearningError("INVALID_ORIGIN", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new LearningError("INVALID_REQUEST", 400);
    const text = await request.text();
    if (text.length > 6000) throw new LearningError("INVALID_REQUEST", 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new LearningError("INVALID_REQUEST", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new LearningError("INVALID_REQUEST", 400);
    const route = (await context.params).path.join("/");
    if (!["profile", "enrol", "progress"].includes(route)) return json({ error: "NOT_FOUND" }, 404);
    // Identity always comes from Supabase Auth, never request JSON.
    const { client, user, profile } = await authenticatedLearner();
    if (route === "profile") {
      keysOnly(body, ["display_name", "preferred_language", "acknowledged"]);
      const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";
      if (!display_name || display_name.length > 100 || !["en", "ms"].includes(String(body.preferred_language)) || (!profile?.onboarding_completed && body.acknowledged !== true)) throw new LearningError("INVALID_PROFILE", 400);
      const values = { display_name, preferred_language: body.preferred_language, onboarding_completed: true };
      const result = profile
        ? await client.from("profiles").update(values).eq("user_id", user.id).select(profileColumns).single()
        : await client.from("profiles").insert({ user_id: user.id, ...values }).select(profileColumns).single();
      if (result.error?.code === "23505") return json({ error: "PROFILE_ALREADY_EXISTS" }, 409);
      if (result.error) throw new LearningError("PROFILE_SAVE_FAILED");
      return json({ profile: result.data });
    }
    if (!profile?.onboarding_completed) throw new LearningError("ONBOARDING_REQUIRED", 409);
    keysOnly(body, route === "enrol" ? ["slug"] : ["slug", "missionId", "answers", "actionConfirmed", "reviewConfirmed", "completionConfirmed"]);
    if (typeof body.slug !== "string" || body.slug.length > 120) throw new LearningError("INVALID_REQUEST", 400);
    const course = await courseBySlug(client, body.slug);
    if (!course) throw new LearningError("COURSE_NOT_FOUND", 404);
    if (course.access_type !== "free") throw new LearningError("ACCESS_UNAVAILABLE", 403);
    let enrolment = await client.from("module_enrolments").select("course_id,status").eq("user_id", user.id).eq("course_id", course.id).maybeSingle();
    if (enrolment.error) throw new LearningError("ENROLMENT_UNAVAILABLE");
    if (route === "enrol" && !enrolment.data) {
      const inserted = await client.from("module_enrolments").insert({ user_id: user.id, course_id: course.id, status: "active" });
      if (inserted.error && inserted.error.code !== "23505") throw new LearningError("ENROLMENT_SAVE_FAILED");
      // Unique-index race: read the existing row, never duplicate or overwrite it.
      enrolment = await client.from("module_enrolments").select("course_id,status").eq("user_id", user.id).eq("course_id", course.id).maybeSingle();
    }
    if (enrolment.error || !enrolment.data) throw new LearningError("ENROLMENT_REQUIRED", 409);
    if (enrolment.data.status !== "active") throw new LearningError("ENROLMENT_INACTIVE", 403);
    let progress = await client.from("module_progress").select(progressColumns).eq("user_id", user.id).eq("course_id", course.id).maybeSingle();
    if (progress.error) throw new LearningError("PROGRESS_UNAVAILABLE");
    if (!progress.data && route === "enrol") {
      const inserted = await client.from("module_progress").insert({ user_id: user.id, course_id: course.id, current_mission: "1", progress_percentage: 0, last_activity_at: new Date().toISOString(), completed_at: null });
      if (inserted.error && inserted.error.code !== "23505") throw new LearningError("PROGRESS_SAVE_FAILED");
      progress = await client.from("module_progress").select(progressColumns).eq("user_id", user.id).eq("course_id", course.id).single();
    }
    if (progress.error || !progress.data) throw new LearningError("PROGRESS_UNAVAILABLE");
    if (route === "enrol") return json({ progress: progress.data });
    const pilot = getFreeCourse(body.slug);
    const rules = reviewedCourse(body.slug)?.rules;
    const missions = pilot?.topics || (rules?.reviewed ? rules.missions : undefined);
    if (!missions?.length) throw new LearningError("CONTENT_REVIEW_REQUIRED", 409);
    const missionIndex = missions.findIndex(m => m.id === body.missionId);
    if (missionIndex < 0) throw new LearningError("MISSION_NOT_FOUND", 404);
    const storedMission = progress.data.current_mission;
    let current: number;
    try { current = missionNumber(storedMission); }
    catch { throw new LearningError("PROGRESS_REVIEW_REQUIRED", 409); }
    if (current > missions.length + 1) throw new LearningError("PROGRESS_REVIEW_REQUIRED", 409);
    if (progress.data.progress_percentage !== progressAfter(current - 1, missions.length).progress_percentage) throw new LearningError("PROGRESS_REVIEW_REQUIRED", 409);
    if (current > missionIndex + 1) return json({ progress: progress.data });
    if (current !== missionIndex + 1) throw new LearningError("MISSION_LOCKED", 409);
    const checkpointMet = pilot ? body.completionConfirmed === true : !!rules && evaluateCheckpoint(rules.missions[missionIndex], body);
    if (!checkpointMet) throw new LearningError("CHECKPOINT_NOT_MET", 422);
    const next = progressAfter(current, missions.length);
    const now = new Date().toISOString();
    const saved = await client.from("module_progress").update({ ...next, current_mission: String(next.current_mission), last_activity_at: now, completed_at: next.progress_percentage === 100 ? now : null }).eq("user_id", user.id).eq("course_id", course.id).eq("current_mission", storedMission).eq("progress_percentage", progress.data.progress_percentage).select(progressColumns).maybeSingle();
    if (saved.error) throw new LearningError("PROGRESS_SAVE_FAILED");
    if (!saved.data) throw new LearningError("PROGRESS_CHANGED_RELOAD", 409);
    return json({ progress: saved.data });
  } catch (error) { return fail(error); }
}
