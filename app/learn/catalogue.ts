import catalogue from "../../config/course-catalogue.json";
export type Programme = {
  slug: string; databaseSlug: string; number: string; title: string; titleMs: string; outcome: string; outcomeMs: string;
  style: string; styleMs: string; duration: string; durationMs: string; missions: number; image: string; alt: string;
};
// Public metadata only. Course bodies are loaded on authenticated server routes.
export const programmes: Programme[] = catalogue;
