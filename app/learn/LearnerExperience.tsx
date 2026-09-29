"use client";
import { brand } from "@/config/brand";
import Link from "../SiteLink";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "./LearnExperience";
import { learnerBrowserClient } from "./supabase/browser";
import type { SupabaseConfig } from "./supabase/config";
import { learningErrorCode, parseLearningSession } from "./learning-response";
import { siteSlug, safeCourseDestination, type Course, type Profile, type Progress } from "./course-model";

export async function learningRequest(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`/learn/api/${path}`, { method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(learningErrorCode(data));
  return data;
}
export function useMessage() {
  const t = useLocale();
  return (code: string, operation: "otp" | "password" | "google" = "otp") => {
    if (operation === "password" && ["invalid_credentials", "email_not_confirmed", "validation_failed"].includes(code)) return t("The email or password is incorrect. You can also sign in with an email code.", "E-mel atau kata laluan tidak betul. Anda juga boleh log masuk menggunakan kod e-mel.");
    if (code === "ACCOUNT_UNAVAILABLE") return t("This learning account is unavailable. Please contact support.", "Akaun pembelajaran ini tidak tersedia. Sila hubungi bantuan.");
    if (operation === "google") return t("Google sign-in could not be completed. Try again, or use an email code.", "Log masuk Google tidak dapat diselesaikan. Cuba lagi atau gunakan kod e-mel.");
    if (["otp_expired", "otp_disabled", "invalid_credentials", "validation_failed"].includes(code)) return t("That code is invalid or has expired. Request a new code and try again.", "Kod itu tidak sah atau telah tamat tempoh. Minta kod baharu dan cuba lagi.");
    if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(code)) return t("Please wait before requesting another code.", "Sila tunggu sebelum meminta kod lain.");
    if (code === "SIGN_IN_REQUIRED") return t("Your session has ended. Please sign in again.", "Sesi anda telah tamat. Sila log masuk semula.");
    if (code === "AUTH_UNAVAILABLE") return t("We could not reach the sign-in service. Please try Continue again shortly.", "Perkhidmatan log masuk tidak dapat dihubungi. Sila cuba Teruskan sekali lagi sebentar lagi.");
    if (code === "SESSION_NOT_ESTABLISHED") return t("We could not confirm your session on this website. Try again. If this repeats, check that cookies are allowed for this site.", "Sesi anda pada laman ini belum dapat dipastikan. Cuba lagi. Jika masalah berulang, pastikan kuki dibenarkan untuk laman ini.");
    if (code === "OTP_SESSION_MISSING") return t("We could not start a session with that code. Please request a new code.", "Sesi tidak dapat dimulakan menggunakan kod itu. Sila minta kod baharu.");
    if (code === "CONTENT_REVIEW_REQUIRED") return t("These missions are awaiting content review. Your enrolment is saved.", "Misi ini sedang menunggu semakan kandungan. Pendaftaran anda telah disimpan.");
    if (code === "PROFILE_ALREADY_EXISTS") return t("Your profile already exists. Reload this page to continue.", "Profil anda sudah wujud. Muat semula halaman ini untuk meneruskan.");
    if (code === "CHECKPOINT_NOT_MET") return t("The checkpoint is not complete. Review the activity and try again.", "Semakan misi belum lengkap. Semak aktiviti dan cuba lagi.");
    if (code === "PROGRESS_CHANGED_RELOAD") return t("Your progress changed in another session. Reload to continue.", "Kemajuan anda berubah dalam sesi lain. Muat semula untuk meneruskan.");
    return t("We could not complete that request. Please try again. If it continues, contact support.", "Permintaan itu tidak dapat diselesaikan. Sila cuba lagi. Jika masalah berterusan, hubungi bantuan.");
  };
}
export function LearnerNav({ config }: { config: SupabaseConfig }) {
  const t = useLocale();
  useEffect(() => {
    const client = learnerBrowserClient(config);
    const { data } = client.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT" && !["/learn", "/learn/free", "/learn/sign-in"].includes(location.pathname)) location.replace("/learn/sign-in");
    });
    // Recheck with the server on back/forward restoration; no private stale dashboard.
    const restore = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); };
    window.addEventListener("pageshow", restore);
    return () => { data.subscription.unsubscribe(); window.removeEventListener("pageshow", restore); };
  }, [config]);
  return <Link href="/learn/dashboard">{t("My learning", "Pembelajaran saya")}</Link>;
}
async function finishLearnerSignIn(next: string) {
  // All login methods wait for the server to verify identity and account status.
  const session = parseLearningSession(await learningRequest("session"));
  const preferredLanguage = session.profile?.preferred_language;
  if (preferredLanguage === "en" || preferredLanguage === "ms") {
    document.cookie = `ksda_locale=${preferredLanguage}; Max-Age=31536000; Path=/; SameSite=Lax`;
    localStorage.setItem("ksda-locale", preferredLanguage);
  }
  const returnTo = safeCourseDestination(next);
  location.replace(session.destination === "/learn/dashboard" ? returnTo || session.destination : `${session.destination}${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
}
export function SignIn({ config, next = "", initialError = "" }: { config: SupabaseConfig; next?: string; initialError?: string }) {
  const t = useLocale(), message = useMessage();
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState(""), [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [wait, setWait] = useState(0);
  const [initialDismissed, setInitialDismissed] = useState(false);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  const clearError = () => { setError(""); setInitialDismissed(true); };
  async function send(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); clearError();
    try {
      const target = sentTo || email.trim();
      const result = await learnerBrowserClient(config).auth.signInWithOtp({ email: target, options: { shouldCreateUser: true } });
      if (result.error) { setWait(60); throw result.error; }
      setSentTo(target); setCode(""); setVerified(false); setWait(60);
    } catch (e) { setError(message((e as { code?: string }).code || "SEND_FAILED")); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); clearError();
    try {
      if (!verified) {
        const result = await learnerBrowserClient(config).auth.verifyOtp({ email: sentTo, token: code, type: "email" });
        if (result.error) throw result.error;
        if (!result.data.session?.access_token || !result.data.user) throw new Error("OTP_SESSION_MISSING");
        setVerified(true); setCode("");
      }
      await finishLearnerSignIn(next);
    } catch (e) {
      const reason = (e as { code?: string }).code || (e as Error).message;
      setError(message(reason === "SIGN_IN_REQUIRED" ? "SESSION_NOT_ESTABLISHED" : reason)); setBusy(false);
    }
  }
  async function signInWithPassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); clearError();
    try {
      if (!passwordVerified) {
        const result = await learnerBrowserClient(config).auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (!result.data.session || !result.data.user) throw new Error("SESSION_NOT_ESTABLISHED");
        setPasswordVerified(true); setPassword("");
      }
      await finishLearnerSignIn(next);
    } catch (e) {
      const reason = (e as { code?: string }).code || (e as Error).message;
      setError(message(reason === "SIGN_IN_REQUIRED" ? "SESSION_NOT_ESTABLISHED" : reason, "password")); setBusy(false);
    }
  }
  async function google() {
    setBusy(true); clearError();
    try {
      const callback = new URL("/learn/auth/callback", location.origin);
      const returnTo = safeCourseDestination(next);
      if (returnTo) callback.searchParams.set("next", returnTo);
      const result = await learnerBrowserClient(config).auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.href, queryParams: { prompt: "select_account" } } });
      if (result.error) throw result.error;
    } catch { setError(message("OAUTH_FAILED", "google")); setBusy(false); }
  }
  const shownError = error || (!initialDismissed && initialError ? initialError === "callback"
    ? t("That sign-in or password-reset link could not be used. Start again, or sign in with an email code.", "Pautan log masuk atau tetapan semula kata laluan itu tidak dapat digunakan. Cuba semula atau log masuk menggunakan kod e-mel.")
    : message(initialError === "account" ? "ACCOUNT_UNAVAILABLE" : "OAUTH_FAILED", initialError === "account" ? "otp" : "google") : "");
  return <main className="ksda-signin" data-no-translate>
    <section className="ksda-signin-card" aria-labelledby="signin-heading">
      <header className="ksda-signin-heading">
        <p className="ksda-kicker">{brand.name}</p>
        <h1 id="signin-heading">{sentTo ? t("Check your email", "Semak e-mel anda") : t(`Welcome to ${brand.name}`, `Selamat datang ke ${brand.name}`)}</h1>
        <p>{sentTo ? t("Enter your code to continue.", "Masukkan kod untuk meneruskan.") : t("Sign in or start your learning journey.", "Log masuk atau mulakan pembelajaran anda.")}</p>
      </header>
      {shownError && <p className="ksda-error" role="alert">{shownError}</p>}
      {!sentTo ? <>
        {brand.features.googleLogin && <button type="button" className="ksda-signin-google" disabled={busy} onClick={google}>
          <span>{t("Continue with Google", "Teruskan dengan Google")}</span>
        </button>}
        {brand.features.googleLogin && <div className="ksda-signin-divider"><span>{t("or use your email", "atau gunakan e-mel")}</span></div>}
        <div className="ksda-signin-methods" role="group" aria-label={t("Email sign-in method", "Cara log masuk e-mel")}>
          <button type="button" aria-pressed={method === "otp"} disabled={busy} onClick={() => { setMethod("otp"); setPassword(""); setShowPassword(false); setPasswordVerified(false); clearError(); }}>
            <span>{t("New here? Start here", "Baharu? Mula di sini")}</span>
            <strong>{t("Email code (OTP)", "Kod e-mel (OTP)")}</strong>
          </button>
          {brand.features.passwordLogin && <button type="button" aria-pressed={method === "password"} disabled={busy} onClick={() => { setMethod("password"); clearError(); }}>
            <span>{t("Already have a password?", "Sudah ada kata laluan?")}</span>
            <strong>{t("Password", "Kata laluan")}</strong>
          </button>}
        </div>
        <p className="ksda-signin-hint" id="signin-method-hint">{method === "otp" ? t("New and returning learners can use an email code.", "Pelajar baharu dan sedia ada boleh menggunakan kod e-mel.") : t("Welcome back. Use your existing learning password.", "Selamat kembali. Gunakan kata laluan pembelajaran anda.")}</p>
        <form className="ksda-form ksda-signin-form" aria-describedby="signin-method-hint" onSubmit={method === "otp" ? send : signInWithPassword}>
          <div className="ksda-signin-field">
            <label htmlFor="learner-email">{t("Email address", "Alamat e-mel")}</label>
            <input id="learner-email" name="email" type="email" placeholder={t("you@example.com", "anda@contoh.com")} autoComplete={method === "password" ? "username" : "email"} autoCapitalize="none" spellCheck={false} required maxLength={254} readOnly={passwordVerified} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {method === "password" && !passwordVerified && <div className="ksda-signin-field">
            <div className="ksda-signin-label"><label htmlFor="learner-password">{t("learning password", "Kata laluan pembelajaran")}</label><Link href="/learn/forgot-password">{t("Forgot password?", "Terlupa kata laluan?")}</Link></div>
            <div className="ksda-signin-password"><input id="learner-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-controls="learner-password" aria-label={showPassword ? t("Hide password", "Sembunyikan kata laluan") : t("Show password", "Tunjukkan kata laluan")} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? t("Hide", "Sorok") : t("Show", "Lihat")}</button></div>
          </div>}
          {passwordVerified && <p role="status">{t("Password verified. Continue to confirm your session.", "Kata laluan disahkan. Teruskan untuk mengesahkan sesi anda.")}</p>}
          <button className="ksda-button ksda-signin-submit" disabled={busy || (method === "otp" && wait > 0)}>{busy ? t("Please wait…", "Sila tunggu…") : method === "password" ? passwordVerified ? t("Continue to my learning", "Teruskan ke pembelajaran saya") : t("Sign in", "Log masuk") : wait ? t(`Try again in ${wait}s`, `Cuba lagi dalam ${wait}s`) : t("Send email code", "Hantar kod e-mel")}</button>
        </form>
        {method === "otp" && brand.features.passwordLogin && brand.features.passwordSetup && <div className="ksda-signin-next"><p>{t("First time? Your next steps", "Kali pertama? Langkah seterusnya")}</p><ol><li><span aria-hidden="true">1</span>{t("Verify email", "Sahkan e-mel")}</li><li><span aria-hidden="true">2</span>{t("Set password", "Tetapkan kata laluan")}</li><li><span aria-hidden="true">3</span>{t("Complete profile", "Lengkapkan profil")}</li></ol></div>}
      </> : <form className="ksda-form ksda-signin-form ksda-signin-code" onSubmit={verify}>
        {!verified && <><p role="status">{t("Enter the code sent to", "Masukkan kod yang dihantar ke")} <strong>{sentTo}</strong>. {t("Check your spam folder too.", "Semak juga folder spam anda.")}</p><div className="ksda-signin-field"><label htmlFor="learner-code">{t("Six-digit code", "Kod enam digit")}</label><input id="learner-code" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} autoFocus /></div></>}
        {verified && <p role="status">{t("Code verified. Continue to confirm your session.", "Kod disahkan. Teruskan untuk mengesahkan sesi anda.")}</p>}
        <button className="ksda-button ksda-signin-submit" disabled={busy || (!verified && code.length !== 6)}>{busy ? t("Checking…", "Menyemak…") : verified ? t("Continue to my learning", "Teruskan ke pembelajaran saya") : t("Verify and continue", "Sahkan dan teruskan")}</button>
        <div className="ksda-actions"><button type="button" className="ksda-text-link" disabled={busy || wait > 0} onClick={() => send()}>{wait ? t(`Resend in ${wait}s`, `Hantar semula dalam ${wait}s`) : t("Resend code", "Hantar semula kod")}</button><button type="button" className="ksda-text-link" disabled={busy} onClick={() => { setSentTo(""); setCode(""); setVerified(false); clearError(); }}>{t("Change email", "Tukar e-mel")}</button></div>
      </form>}
      <footer className="ksda-signin-footer"><p>{t("Use the same email each time to keep your learning progress.", "Gunakan e-mel yang sama untuk mengekalkan kemajuan pembelajaran.")}</p><Link href="/privacy">{t("Privacy policy", "Dasar privasi")}</Link></footer>
    </section>
    <Link className="ksda-signin-catalogue" href="/learn/free">{t("Just exploring? Browse free programmes", "Ingin melihat dahulu? Teroka program percuma")}</Link>
  </main>;
}
export function ProfileForm({ profile, email, onboarding = false, saved = false, next = "" }: { profile: Profile | null; email: string; onboarding?: boolean; saved?: boolean; next?: string }) {
  const t = useLocale(), message = useMessage();
  const [name, setName] = useState(profile?.display_name || ""), [language, setLanguage] = useState(profile?.preferred_language || "en");
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await learningRequest("profile", { display_name: name, preferred_language: language, acknowledged: ack });
      document.cookie = `ksda_locale=${language}; Max-Age=31536000; Path=/; SameSite=Lax`;
      localStorage.setItem("ksda-locale", language);
      if (onboarding) location.replace(safeCourseDestination(next) || "/learn/dashboard");
      else location.replace("/learn/profile?saved=1");
    } catch (e) { setError(message((e as Error).message)); setBusy(false); }
  }
  return <main className="ksda-container ksda-access" data-no-translate><p className="ksda-kicker">{brand.name} Learning Hub</p><h1>{onboarding ? t("Make it yours.", "Lengkapkan profil anda.") : t("Your profile.", "Profil anda.")}</h1><p>{t("Verified email", "E-mel disahkan")}: <strong>{email}</strong></p><form className="ksda-form" onSubmit={save}><label htmlFor="display-name">{t("Display name", "Nama paparan")}</label><input id="display-name" autoComplete="name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} /><label htmlFor="preferred-language">{t("Preferred language", "Bahasa pilihan")}</label><select id="preferred-language" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="ms">Bahasa Malaysia</option></select>{onboarding && <label className="ksda-checkbox"><input type="checkbox" required checked={ack} onChange={e => setAck(e.target.checked)} /><span>{t("I have read the", "Saya telah membaca")} <Link href="/privacy" target="_blank">{t("privacy policy", "dasar privasi")}</Link>{t(" and understand that this site stores my identity, enrolment and progress. These programmes provide awareness learning, not accredited professional competence.", " dan memahami bahawa laman ini menyimpan identiti, pendaftaran dan kemajuan saya. Program ini menyediakan pembelajaran kesedaran, bukan kecekapan profesional bertauliah.")}</span></label>}<button className="ksda-button" disabled={busy}>{busy ? t("Saving…", "Menyimpan…") : onboarding ? t("Continue to my learning", "Teruskan ke pembelajaran saya") : t("Save profile", "Simpan profil")}</button></form>{error && <p role="alert" className="ksda-error">{error}</p>}{saved && <p role="status">{t("Profile saved.", "Profil disimpan.")}</p>}<Link className="ksda-text-link" href="/learn/dashboard">{t("My learning", "Pembelajaran saya")}</Link></main>;
}
export function SignOut({ config }: { config: SupabaseConfig }) {
  const t = useLocale(), message = useMessage();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <div><button className="ksda-text-link" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const result = await learnerBrowserClient(config).auth.signOut({ scope: "local" }); if (result.error) throw result.error; location.replace("/learn/sign-in"); } catch { setError(message("SIGN_OUT_FAILED")); setBusy(false); } }}>{t("Sign out", "Log keluar")}</button>{error && <p role="alert">{error}</p>}</div>;
}
export type EnrolledCourse = { course: Course | null; status: string; progress: Progress | null };
export function Dashboard({ entries, profile, config }: { entries: EnrolledCourse[]; profile: Profile; config: SupabaseConfig }) {
  const t = useLocale();
  const groups = [entries.filter(e => e.progress?.progress_percentage !== 100), entries.filter(e => e.progress?.progress_percentage === 100)];
  return <main className="ksda-container ksda-catalogue" data-no-translate><p className="ksda-kicker">{profile.display_name}</p><h1>{t("My learning.", "Pembelajaran saya.")}</h1><div className="ksda-actions"><Link className="ksda-button" href="/learn/free">{t("Explore free learning", "Teroka pembelajaran percuma")}</Link><Link className="ksda-text-link" href="/learn/profile">{t("Profile & language", "Profil & bahasa")}</Link><SignOut config={config} /></div>{groups.map((group, i) => <section className="ksda-dashboard-section" key={i}><h2>{i ? t("Completed programmes", "Program selesai") : t("Enrolled programmes", "Program didaftarkan")}</h2>{!group.length && <p>{i ? t("No completed programmes yet.", "Belum ada program yang selesai.") : t("Choose a programme from the free catalogue to begin.", "Pilih program daripada katalog percuma untuk bermula.")}</p>}<div className="ksda-course-grid">{group.map((e, n) => <article className="ksda-course-card ksda-course-body" key={e.course?.id || n}><h3>{e.course?.title || t("Programme unavailable", "Program tidak tersedia")}</h3>{e.progress ? <><p>{e.progress.progress_percentage}% {t("complete", "selesai")}</p><progress max={100} value={e.progress.progress_percentage} aria-label={t("Course progress", "Kemajuan program")} /></> : <p>{t("Progress has not been started. Continue to initialise it.", "Kemajuan belum dimulakan. Teruskan untuk memulakannya.")}</p>}{e.course && e.status === "active" ? <Link className="ksda-card-link" href={`/learn/courses/${siteSlug(e.course.slug)}`}>{i ? t("Review programme", "Semak program") : t("Continue learning", "Sambung pembelajaran")}</Link> : <p>{t("This enrolment is not currently available.", "Pendaftaran ini tidak tersedia buat masa ini.")}</p>}</article>)}</div></section>)}</main>;
}
export function CourseAccess({ course, progress, enrolled, released }: { course: Course; progress: Progress | null; enrolled: boolean; released: boolean }) {
  const t = useLocale(), message = useMessage();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <main className="ksda-container ksda-access" data-no-translate><p className="ksda-kicker">{brand.name} KSDA · {course.access_type === "free" ? t("Free programme", "Program percuma") : t("Programme", "Program")}</p><h1>{course.title}</h1><p className="ksda-lead">{course.short_description}</p>{progress && <p>{progress.progress_percentage}% {t("complete", "selesai")}</p>}{!released && <div className="ksda-notice"><b>{t("Missions awaiting review", "Misi menunggu semakan")}</b><p>{t("You can enrol now. Mission activities will open after their content and checkpoints have been reviewed. Enrolment does not mark any mission complete.", "Anda boleh mendaftar sekarang. Aktiviti misi akan dibuka selepas kandungan dan semakannya diluluskan. Pendaftaran tidak menandakan mana-mana misi telah selesai.")}</p></div>}{course.access_type === "free" && (!enrolled || !progress || released) && <button className="ksda-button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await learningRequest("enrol", { slug: siteSlug(course.slug) }); location.reload(); } catch (e) { setError(message((e as Error).message)); setBusy(false); } }}>{busy ? t("Saving…", "Menyimpan…") : enrolled ? t("Continue learning", "Sambung pembelajaran") : released ? t("Start learning", "Mula belajar") : t("Enrol in this programme", "Daftar program ini")}</button>}{enrolled && !released && progress && <p role="status">{t("Your enrolment is saved.", "Pendaftaran anda telah disimpan.")}</p>}{error && <p role="alert" className="ksda-error">{error}</p>}<div className="ksda-actions"><Link className="ksda-text-link" href="/learn/dashboard">{t("My learning", "Pembelajaran saya")}</Link><Link className="ksda-text-link" href="/learn/free">{t("Explore free learning", "Teroka pembelajaran percuma")}</Link></div><p className="ksda-fine">{t("Awareness learning. No accredited qualification or certificate is awarded.", "Pembelajaran kesedaran. Tiada kelayakan bertauliah atau sijil diberikan.")}</p></main>;
}
