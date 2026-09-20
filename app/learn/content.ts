// Server-only source access. Draft blocks and answer keys never enter public bundles.
import first from "../../content/ksda/courses-12.json";
import second from "../../content/ksda/courses-34.json";
import { approvedRules } from "./learning-rules";
export function reviewedCourse(slug: string) {
 const course=[...first.courses,...second.courses].find(c=>c.slug===slug);
 const rules=approvedRules[slug];
 if(!course || course.reviewState!=="APPROVED" || !rules?.reviewed || rules.missions.length!==course.missions.length) return null;
 if(course.missions.some((m,i)=>m.reviewState!=="APPROVED" || m.id!==rules.missions[i]?.id || !rules.missions[i].requiredCheckpoints.length || m.blocks.some(b=>b.reviewState!=="APPROVED"))) return null;
 return {course,rules};
}
