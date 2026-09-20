import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./app/learn/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Authenticated HTML and API responses must never be shared by a CDN.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Robots-Tag", "noindex");
  // Admin routes use the same verified Supabase session as learner routes.
  try {
    const config = supabaseConfig();
    const client = createServerClient(config.url, config.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          response.headers.set("Cache-Control", "private, no-store, max-age=0");
          response.headers.set("Referrer-Policy", "same-origin");
          response.headers.set("X-Robots-Tag", "noindex");
        },
      },
    });
    await client.auth.getUser();
  } catch { /* Page/API authorization remains fail closed when Auth is unavailable. */ }
  return response;
}

export const config = { matcher: ["/admin", "/admin/:path*", "/learn/sign-in", "/learn/onboarding", "/learn/dashboard", "/learn/profile", "/learn/courses/:path*", "/learn/api/:path*"] };
