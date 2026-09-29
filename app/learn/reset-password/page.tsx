import { brand } from "@/config/brand";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLearner } from "../data";
import { PasswordSettings } from "../PasswordSettings";
import { supabaseConfig } from "../supabase/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Choose a new password | ${brand.name}`, robots: { index: false, follow: false } };
export default async function Page() {
  const { user } = await requireLearner(false);
  if (!user.email_confirmed_at) redirect("/learn/sign-in?auth_error=account");
  return <main><PasswordSettings config={supabaseConfig()} email={user.email || ""} userId={user.id} mode="recovery" /></main>;
}
