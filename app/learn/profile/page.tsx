import { brand } from "@/config/brand";
import type { Metadata } from "next";
import { requireLearner } from "../data";
import { ProfileForm } from "../LearnerExperience";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Your profile | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page({searchParams}: {searchParams: Promise<{saved?:string}>}) {
  const { user, profile } = await requireLearner(true);

  return <ProfileForm email={user.email || ""} profile={profile} saved={(await searchParams).saved === "1"} />;
}
