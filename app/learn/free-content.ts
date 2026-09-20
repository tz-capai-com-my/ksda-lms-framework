import details from "../../content/ksda/course-details.json";
import type { DetailedSection } from "./TopicDetails";
import source from "../../content/ksda/free-topics.json";
import { programmes } from "./catalogue";
import { siteSlug } from "./course-model";
import { teachingPoints } from "./teaching-points";

export type TopicQuestion = {
  id: string; prompt: string; promptMs: string; options: string[]; optionsMs: string[];
  feedback: string; feedbackMs: string;
};
export type FreeTopic = {
  id: string; title: string; titleMs: string; notes: string[]; notesMs: string[];
  sections?: DetailedSection[]; workbookTitle?: string;
  questions: TopicQuestion[]; notesPrompt: string; notesPromptMs: string; videoUrl: string | null;
};
export type FreeCourse = { slug: string; title: string; titleMs: string; topics: FreeTopic[]; image?: string };
// Owner-requested awareness pilot: self-reported topic completion, not a graded
// clinical assessment. Advanced KSDA drafts and their approval gates stay intact.
export function getFreeCourse(slug: string): FreeCourse | undefined {
  const index = (source as FreeCourse[]).findIndex(course => course.slug === siteSlug(slug));
  if (index < 0) return undefined;
  const course = (source as FreeCourse[])[index];
  const detailed = details.find(item => item.slug === course.slug);
  return { ...course, image: programmes.find(item => item.slug === course.slug)?.image, topics: course.topics.map(topic => {
    const reading = detailed?.topics.find(item => item.id === topic.id);
    // Segment on the server so older browsers hydrate the same bullet arrays.
    return { ...topic, notes: teachingPoints(topic.notes, "en"), notesMs: teachingPoints(topic.notesMs, "ms"), workbookTitle: reading?.workbookTitle,
      sections: ((reading?.sections as DetailedSection[] | undefined)?.filter(section => section.reviewState !== "REVIEW") || []).map(section => ({ ...section, body: teachingPoints(section.body, "en"), bodyMs: teachingPoints(section.bodyMs, "ms") })) };
  }) };
}
