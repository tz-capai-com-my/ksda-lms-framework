import { env } from "cloudflare:workers";

export type SupabaseConfig = { url: string; publishableKey: string };
// Server-only environment lookup. Only supabaseConfig's two public values may
// cross into browser props; admin allowlists and signing secrets must not.
export function serverSetting(name: string): string {
  const binding = (env as unknown as Record<string, unknown>)[name];
  return typeof binding === "string" ? binding : process.env[name] || "";
}
export function supabaseConfig(): SupabaseConfig {
  const rawUrl = serverSetting("SUPABASE_URL").trim();
  const publishableKey = serverSetting("SUPABASE_PUBLISHABLE_KEY").trim();
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("LEARNING_CONFIGURATION_UNAVAILABLE"); }
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !publishableKey.startsWith("sb_publishable_")) {
    throw new Error("LEARNING_CONFIGURATION_UNAVAILABLE");
  }
  return { url: url.origin, publishableKey };
}
