import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authenticatedLearnerWithClient, learnerDestination, LearningError } from "../../data";
import { safeCourseDestination } from "../../course-model";
import { supabaseConfig } from "../../supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeCourseDestination(url.searchParams.get("next"));
  const pending = new Map<string, { value: string; options: CookieOptions }>();
  const finish = (destination: string) => {
    // Never use forwarded host headers or an arbitrary return URL.
    const response = NextResponse.redirect(new URL(destination, url.origin), 303);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex");
    pending.forEach(({ value, options }, name) => response.cookies.set(name, value, options));
    return response;
  };
  const failure = (reason = "callback") => finish(`/learn/sign-in?auth_error=${reason}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  const codes = url.searchParams.getAll("code");
  if (url.searchParams.has("error") || codes.length !== 1 || !codes[0] || codes[0].length > 2048) return failure();
  try {
    const config = supabaseConfig();
    const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
    const client = createServerClient(config.url, config.publishableKey, {
      cookieOptions: { path: "/", sameSite: "lax", secure: url.protocol === "https:" },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            jar.set(name, value);
            pending.set(name, { value, options });
          });
        },
      },
    });
    const { data, error } = await client.auth.exchangeCodeForSession(codes[0]);
    if (error || !data.session || !data.user) return failure();
    const { user, profile } = await authenticatedLearnerWithClient(client);
    const locale = profile?.preferred_language;
    if (locale === "en" || locale === "ms") pending.set("ksda_locale", { value: locale, options: { path: "/", sameSite: "lax", secure: url.protocol === "https:", maxAge: 31536000 } });
    // Supabase marks its PKCE verifier as recovery when resetPasswordForEmail
    // starts the flow. This selects the UI only; getUser/account checks above
    // and Supabase's own updateUser authorization remain authoritative.
    if ("redirectType" in data && data.redirectType === "recovery") return finish("/learn/reset-password");
    const destination = learnerDestination(user, profile);
    return finish(destination === "/learn/dashboard" ? next || destination : `${destination}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  } catch (error) {
    // No authorization codes, cookies, provider errors or identifiers in logs/URLs.
    return failure(error instanceof LearningError && error.code === "ACCOUNT_UNAVAILABLE" ? "account" : "callback");
  }
}
