import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function learnerServerClient() {
  const config = supabaseConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        // Proxy refreshes page sessions; route handlers can also persist cookies.
        try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Server component cookie writes are handled by proxy. */ }
      },
    },
  });
}
