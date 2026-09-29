import { learnerServerClient } from "../../supabase/server";
import { privateHeaders, readingDeliveryEnabled } from "../../../reading-review/server";
import { validProgressBody } from "../../../reading-review/model";
import { loadReading } from "../../reading-server";
import { READING_CODE_HASH } from "../../reading-build";
import { verifiedAsset } from "../../../reading-review/asset";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });
async function readingClient(request: Request) {
  if (!readingDeliveryEnabled()) return { error: json({ error: "NOT_AVAILABLE" }, 404) };
  if (new URL(request.url).searchParams.get("scope") !== "learner") return { error: json({ error: "INVALID_SCOPE" }, 400) };
  const client = await learnerServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: json({ error: "SIGN_IN_REQUIRED" }, 401) };
  return { client };
}

export async function GET(request: Request) {
  try {
    const context = await readingClient(request);
    if (context.error) return context.error;
    const { client } = context, q = new URL(request.url).searchParams, release = q.get("release"), mission = q.get("mission");
    if (q.has("asset")) {
      if (!release) return json({ error: "INVALID_REQUEST" }, 400);
      const { data, error } = await client.rpc("ksda_reading_delivery_asset", { p_scope: "learner", p_release: release, p_asset: q.get("asset"), p_locale: q.get("lang") === "ms" ? "ms" : "en" });
      if (error) return json({ error: "READING_ACCESS_DENIED" }, error.code === "42501" ? 403 : 409);
      const asset = await verifiedAsset(data, READING_CODE_HASH);
      return new Response(asset.body, { headers: { ...privateHeaders, "Content-Type": asset.mime, "Content-Security-Policy": "default-src 'none'; sandbox" } });
    }
    return json(await loadReading(client, "learner", release, mission));
  } catch (error) {
    return json({ error: "READING_UNAVAILABLE" }, (error as { status?: number }).status === 403 ? 403 : 503);
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "INVALID_ORIGIN" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "INVALID_REQUEST" }, 415);
  try {
    const context = await readingClient(request);
    if (context.error) return context.error;
    const text = await request.text();
    if (text.length > 14000) return json({ error: "INVALID_REQUEST" }, 413);
    const body = JSON.parse(text);
    if (!validProgressBody(body)) return json({ error: "INVALID_REQUEST" }, 400);
    // Compiled-code check before write; SQL repeats current learner eligibility atomically.
    await loadReading(context.client, "learner", body.release, body.mission);
    const { data, error } = await context.client.rpc("ksda_reading_delivery_progress", { p_scope: "learner", p_release: body.release, p_mission: body.mission, p_revision: body.revision, p_reviewed: body.reviewed, p_last: body.last });
    return error ? json({ error: "SAVE_FAILED" }, error.code === "42501" ? 403 : 409) : json(data);
  } catch {
    return json({ error: "SAVE_FAILED" }, 503);
  }
}
