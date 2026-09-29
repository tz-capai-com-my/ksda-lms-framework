export type Copy = { en: string; ms: string };
export type ReviewOrigin = "self_confirmed" | "viewport_dwell";
export type ReadingProgress = { reviewed: Record<string, ReviewOrigin>; last_block_id: string | null; updated_at: string | null };
export type ReadingSection = { id: string; type: string; ksda_stage: string; title: Copy; paragraphs: Copy[]; block_ids: string[]; asset_id: string; asset_width: number; asset_height: number; diagram: { title: Copy; nodes: Copy[]; caption: Copy; alt: Copy } };
export type EditorialPhoto = {asset_id:string; width:number; height:number; alt:Copy; caption:Copy};
export type ReadingMission = {
 editorial_photos?: {opening:EditorialPhoto; closer:EditorialPhoto & {after_section:string}}; pilot_spoken_prompt?:Copy;
 mission_id: string; course_key: string; title: Copy; bridge: Copy; opening_asset_id: string;
 opening_alt: Copy; opening_caption: Copy; opening_nodes: Copy[]; opening_width: number; opening_height: number; sections: ReadingSection[];
 questions: { id: string; prompt: string; promptMs: string; options: string[]; optionsMs: string[] }[];
 reflection_feedback: { question_id: string; options: Copy[] }[];
 knowledge_check: { id: string; prompt: Copy; options: { id: string; text: Copy; rationale: Copy; correct: boolean }[] };
 notes_prompt: Copy; declaration: Copy; video_link: string | null; video_embed: string | null;
 review_holds: string[];
};
export type ReleaseManifest = { excluded_section_ids?:string[]; release_id: string; content_release_id?:string; source_manifest_hash: string; asset_manifest_hash: string; code_manifest_hash: string; missions: { mission_id: string; course_key: string; title: Copy; revision_hash: string; block_count: number }[]; assets?:{visual_id:string; mission_id:string; locale:string; sha256:string; width:number; height:number; format:string}[] };
export type ReviewEnvelope = { release_id: string; status: string; content_hash: string; asset_hash: string; code_hash: string; source_hash: string; manifest_text: string; revision_hash?: string; payload_text?: string; block_ids?: string[]; progress?: ReadingProgress; publication_active: boolean; progress_scope: "preview" | "learner"; content_release_id?:string; journey_test?:{current_mission:number;progress_percentage:number} };
export async function sha256(text: string) {
 const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function verifyEnvelope(value: ReviewEnvelope, expected?: {scope:"preview"|"learner";code?:string;release?:string;mission?:string;course?:string}) {
 if (!value || value.publication_active !== ((expected?.scope??"preview")==="learner") || value.progress_scope !== (expected?.scope??"preview") || await sha256(value.manifest_text) !== value.content_hash) throw new Error("RELEASE_INTEGRITY_ERROR");
 if(expected?.code && value.code_hash!==expected.code || expected?.release && value.release_id!==expected.release) throw new Error("RELEASE_INTEGRITY_ERROR");
 const manifest = JSON.parse(value.manifest_text) as ReleaseManifest;
 if (manifest.release_id !== value.release_id || !/^[a-f0-9]{64}$/.test(value.source_hash) || !/^[a-f0-9]{64}$/.test(value.asset_hash) || !/^[a-f0-9]{64}$/.test(value.code_hash) || manifest.source_manifest_hash !== value.source_hash || manifest.asset_manifest_hash !== value.asset_hash || manifest.code_manifest_hash !== value.code_hash) throw new Error("RELEASE_INTEGRITY_ERROR");
 if (value.payload_text) {
  if (await sha256(value.payload_text) !== value.revision_hash) throw new Error("REVISION_INTEGRITY_ERROR");
  const mission = JSON.parse(value.payload_text) as ReadingMission;
  if(expected?.mission && mission.mission_id!==expected.mission || expected?.course && mission.course_key!==expected.course) throw new Error("REVISION_INTEGRITY_ERROR");
  if(mission.editorial_photos) {
   const photos=mission.editorial_photos;
   if(!mission.sections.some(s=>s.id===photos.closer.after_section) || photos.opening.asset_id===photos.closer.asset_id) throw new Error("REVISION_INTEGRITY_ERROR");
   for(const photo of [photos.opening,photos.closer])for(const locale of ["en","ms"] as const) {
    const asset=manifest.assets?.find(a=>a.visual_id===photo.asset_id&&a.locale===locale);
    if(!asset || asset.mission_id!==mission.mission_id || !["image/png","image/webp"].includes(asset.format) || asset.width!==photo.width || asset.height!==photo.height || !photo.alt?.[locale] || !photo.caption?.[locale]) throw new Error("REVISION_INTEGRITY_ERROR");
   }
  }
  const entry = manifest.missions.find(m => m.mission_id === mission.mission_id);
  if (entry?.revision_hash !== value.revision_hash || mission.sections.some(s => (manifest.excluded_section_ids??[]).includes(s.id)) || mission.sections.flatMap(s => s.block_ids).join("|") !== value.block_ids?.join("|")) throw new Error("REVISION_INTEGRITY_ERROR");
 }
 return value;
}
export function validProgressBody(body: unknown): body is { release: string; mission: string; revision: string; reviewed: Record<string, ReviewOrigin>; last: string | null } {
 if (!body || typeof body !== "object" || Array.isArray(body)) return false;
 const b = body as Record<string, unknown>;
 if (Object.keys(b).sort().join() !== ["release","mission","revision","reviewed","last"].sort().join()) return false;
 if (typeof b.release !== "string" || typeof b.mission !== "string" || typeof b.revision !== "string" || !/^[a-f0-9]{64}$/.test(b.revision) || (b.last !== null && typeof b.last !== "string")) return false;
 if (!b.reviewed || typeof b.reviewed !== "object" || Array.isArray(b.reviewed)) return false;
 return Object.entries(b.reviewed).length <= 100 && Object.entries(b.reviewed).every(([key, val]) => key.length <= 140 && (val === "self_confirmed" || val === "viewport_dwell"));
}
