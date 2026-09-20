import { brand } from "@/config/brand";
import { publishedCourses } from "../data";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Catalogue } from "../LearnExperience";
export const metadata: Metadata = {
  title: `Free Awareness Programmes | ${brand.name}`,
  description: "Explore free self-paced programmes. Sign in with your email to save and resume your topic progress.",
  alternates: { canonical: "/learn/free" },
  openGraph: { title: `Free Awareness Programmes | ${brand.name}`, description: "Explore subjects through the KSDA learning method.", images: [] },
  twitter: { title: `Free Awareness Programmes | ${brand.name}`, description: "Explore subjects through the KSDA learning method.", images: [] },
};
export default async function Page() { const catalogue = await publishedCourses(); return <Catalogue {...catalogue} />; }
