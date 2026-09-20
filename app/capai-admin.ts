import { redirect } from "next/navigation";
import { learnerServerClient } from "./learn/supabase/server";
import { serverSetting } from "./learn/supabase/config";

export type LmsAdmin = { id: string; email: string; displayName: string };
function allowedAdminEmails() {
  return serverSetting("LMS_ADMIN_EMAILS").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
}
async function verifiedUser(): Promise<LmsAdmin | null> {
  try {
    const client = await learnerServerClient();
    // getUser verifies with Supabase Auth; cookie claims and request headers never grant access.
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at) return null;
    return { id: user.id, email: user.email, displayName: user.email };
  } catch { return null; }
}
export async function isLmsAdmin(): Promise<LmsAdmin | null> {
  const allowed = allowedAdminEmails();
  if (!allowed.length) return null;
  const user = await verifiedUser();
  return user && allowed.includes(user.email.toLowerCase()) ? user : null;
}
export async function requireLmsAdmin(returnTo: string): Promise<LmsAdmin> {
  const user = await verifiedUser();
  // Restrict return paths here as well as in the sign-in flow.
  const next = returnTo === "/admin" ? "/admin" : "/admin/learners";
  if (!user) redirect(`/learn/sign-in?next=${encodeURIComponent(next)}`);
  if (!allowedAdminEmails().includes(user.email.toLowerCase())) redirect("/learn/dashboard");
  return user;
}
