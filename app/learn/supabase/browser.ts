"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseConfig } from "./config";

export function learnerBrowserClient(config: SupabaseConfig) {
  return createBrowserClient(config.url, config.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: location.protocol === "https:" },
  });
}
