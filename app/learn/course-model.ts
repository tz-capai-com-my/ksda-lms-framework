import { programmes } from "./catalogue";
export type Course = { id: string; slug: string; title: string; short_description: string; experience_style: string; access_type: string; status: string; sort_order: number };
export type Profile = { user_id: string; display_name: string; preferred_language: string; onboarding_completed: boolean; account_status: string };
export type Progress = { course_id: string; current_mission: string | number; progress_percentage: number; last_activity_at: string; completed_at: string | null };
export const courseColumns = "id,slug,title,short_description,experience_style,access_type,status,sort_order";
export const profileColumns = "user_id,display_name,preferred_language,onboarding_completed,account_status";
export const progressColumns = "course_id,current_mission,progress_percentage,last_activity_at,completed_at";
const slugMap: Record<string, string> = Object.fromEntries(programmes.map(course => [course.databaseSlug, course.slug]));
export function siteSlug(slug: string) { return slugMap[slug] || slug; }
export function databaseSlug(slug: string) { return Object.entries(slugMap).find(([, local]) => local === slug)?.[0] || slug; }
export function presentation(course: Course) { return programmes.find(p => p.slug === siteSlug(course.slug)); }

export function safeCourseDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > 240) return "";
  if (value === "/admin" || value === "/admin/learners") return value;
  const match = /^\/learn\/courses\/([a-z0-9-]+)(?:\/missions\/([a-zA-Z0-9_.-]+))?$/.exec(value);
  return match && programmes.some(course => course.slug === match[1]) ? value : "";
}
