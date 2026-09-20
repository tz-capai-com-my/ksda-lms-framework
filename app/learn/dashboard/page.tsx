import { brand } from "@/config/brand";
import type { Metadata } from "next";
import { requireLearner, LearningError } from "../data";
import { courseColumns, progressColumns, type Course, type Progress } from "../course-model";
import { supabaseConfig } from "../supabase/config";
import { Dashboard } from "../LearnerExperience";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `My learning | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page() {
 const {client,user,profile} = await requireLearner();
 const [enrolments, progress] = await Promise.all([
  client.from("module_enrolments").select("course_id,status").eq("user_id",user.id),
  client.from("module_progress").select(progressColumns).eq("user_id",user.id),
 ]);
 if(enrolments.error || progress.error) throw new LearningError("DASHBOARD_UNAVAILABLE");
 const ids = (enrolments.data || []).map(e => e.course_id);
 const courses = ids.length ? await client.from("courses").select(courseColumns).in("id",ids).order("sort_order") : {data:[],error:null};
 if(courses.error) throw new LearningError("DASHBOARD_UNAVAILABLE");
 const entries = (enrolments.data || []).map(e=>({status:e.status,course:(courses.data as Course[]).find(c=>c.id===e.course_id)||null,progress:(progress.data as Progress[]).find(p=>p.course_id===e.course_id)||null}));
 entries.sort((a,b)=>(a.course?.sort_order || 0)-(b.course?.sort_order || 0));
 return <Dashboard entries={entries} profile={profile!} config={supabaseConfig()} />;
}
