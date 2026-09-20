import { publishedCourses } from "./learn/data";
import LearnExperience from "./learn/LearnExperience";
import LearnLayout from "./learn/layout";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const catalogue = await publishedCourses();
  return <LearnLayout><LearnExperience {...catalogue} /></LearnLayout>;
}
