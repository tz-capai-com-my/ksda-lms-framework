import { brand } from "@/config/brand";
import { publishedCourses } from "./data";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import LearnExperience from "./LearnExperience";
export const metadata: Metadata = {
  title: `Learn it. Apply it. | ${brand.name}`,
  description: "Explore Knowledge, Skill, Desire and Action through self-paced programmes, reflection and practical learning.",
  alternates: { canonical: "/learn" },
  openGraph: { title: `Learn it. Apply it. | ${brand.name}`, description: "From knowing to doing, one useful mission at a time.", images: [] },
  twitter: { title: `Learn it. Apply it. | ${brand.name}`, description: "From knowing to doing, one useful mission at a time.", images: [] },
};
export default async function Page() { const catalogue = await publishedCourses(); return <LearnExperience {...catalogue} />; }
