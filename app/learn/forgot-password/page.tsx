import { brand } from "@/config/brand";
import type { Metadata } from "next";
import { PasswordRecovery } from "../PasswordRecovery";
import { supabaseConfig } from "../supabase/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Reset your password | ${brand.name}`, robots: { index: false, follow: false } };
export default function Page() { return <PasswordRecovery config={supabaseConfig()} />; }
