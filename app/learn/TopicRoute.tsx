import { notFound, redirect } from "next/navigation";
import { requireLearner, courseBySlug, LearningError } from "./data";
import { siteSlug, progressColumns } from "./course-model";
import { getFreeCourse } from "./free-content";
import { missionNumber, progressAfter } from "./learning-rules";
import { readingDeliveryEnabled } from "../reading-review/server";
import { loadReading } from "./reading-server";
import { TopicExperience } from "./TopicExperience";

export async function TopicRoute({ slug, missionId }: { slug: string; missionId?: string }) {
  const { client, user } = await requireLearner(true, `/learn/courses/${slug}${missionId ? `/missions/${missionId}` : ""}`);
  const catalogueCourse = await courseBySlug(client, slug);
  if (!catalogueCourse || catalogueCourse.access_type !== "free") notFound();
  if (siteSlug(catalogueCourse.slug) !== slug) redirect(`/learn/courses/${siteSlug(catalogueCourse.slug)}${missionId ? `/missions/${missionId}` : ""}`);
  const course = getFreeCourse(slug);
  if (!course) notFound();
  const [enrolment, progress] = await Promise.all([
    client.from("module_enrolments").select("status").eq("user_id", user.id).eq("course_id", catalogueCourse.id).maybeSingle(),
    client.from("module_progress").select(progressColumns).eq("user_id", user.id).eq("course_id", catalogueCourse.id).maybeSingle(),
  ]);
  if (enrolment.error || progress.error) throw new LearningError("COURSE_RECORD_UNAVAILABLE");
  if (enrolment.data && enrolment.data.status !== "active") throw new LearningError("ENROLMENT_INACTIVE", 403);
  let current = 1;
  if (progress.data) {
    try { current = missionNumber(progress.data.current_mission); }
    catch { throw new LearningError("PROGRESS_REVIEW_REQUIRED", 409); }
    if (current > course.topics.length + 1 || progress.data.progress_percentage !== progressAfter(current - 1, course.topics.length).progress_percentage) throw new LearningError("PROGRESS_REVIEW_REQUIRED", 409);
  }
  const index = missionId ? course.topics.findIndex(topic => topic.id === missionId) : Math.min(current - 1, course.topics.length - 1);
  if (index < 0) notFound();
  if (index + 1 > current) redirect(`/learn/courses/${slug}`);
  const reading = readingDeliveryEnabled() ? await loadReading(client, "learner", null, course.topics[index].id, course.slug) : null;
  return <TopicExperience reading={reading??undefined} key={`${slug}:${index}`} course={course} index={index} initialCurrent={current} initialPercentage={progress.data?.progress_percentage || 0} initialReady={enrolment.data?.status === "active" && !!progress.data} />;
}
