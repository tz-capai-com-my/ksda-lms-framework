"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "./LearnExperience";
import { learningRequest, useMessage } from "./LearnerExperience";
import { parseLearningSession } from "./learning-response";
import { learnerBrowserClient } from "./supabase/browser";
import type { SupabaseConfig } from "./supabase/config";
import Link from "../SiteLink";
import { safeCourseDestination } from "./course-model";
import { SignOut } from "./LearnerExperience";

export function PasswordSettings({ config, email, userId, mode = "settings", next = "" }: { config: SupabaseConfig; email: string; userId: string; mode?: "settings" | "setup" | "recovery"; next?: string }) {
  const t = useLocale(), message = useMessage();
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState(""), [needsCode, setNeedsCode] = useState(false), [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [wait, setWait] = useState(0);
  const Heading = mode === "settings" ? "h2" : "h1";
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  useEffect(() => {
    const { data } = learnerBrowserClient(config).auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.user.id !== userId) {
        setPassword(""); setConfirmation(""); setNonce(""); location.reload();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [config, userId]);
  async function currentClient() {
    parseLearningSession(await learningRequest("session"));
    const client = learnerBrowserClient(config);
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user || data.user.id !== userId || !data.user.email_confirmed_at) {
      setPassword(""); setConfirmation(""); setNonce(""); location.reload();
      throw new Error("SIGN_IN_REQUIRED");
    }
    return client;
  }
  function passwordError(error: unknown) {
    const code = (error as { code?: string }).code || (error as Error).message;
    if (code === "reauthentication_needed") {
      setNeedsCode(true);
      return t("Please verify your email before changing your password.", "Sila sahkan e-mel anda sebelum menukar kata laluan.");
    }
    if (code === "reauthentication_not_valid") {
      setCodeSent(false);
      return t("That verification code is invalid or expired. Request a new code.", "Kod pengesahan itu tidak sah atau telah tamat tempoh. Minta kod baharu.");
    }
    if (code === "weak_password" || code === "validation_failed") return t("Use at least 8 characters, including an uppercase letter, a lowercase letter, a number and a symbol.", "Gunakan sekurang-kurangnya 8 aksara, termasuk huruf besar, huruf kecil, nombor dan simbol.");
    if (code === "same_password") return t("Choose a password different from your current password.", "Pilih kata laluan yang berbeza daripada kata laluan semasa.");
    return message(code, "password");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setSaved(false);
    if (password !== confirmation) { setError(t("The passwords do not match.", "Kata laluan tidak sepadan.")); return; }
    setBusy(true);
    try {
      // Verify current learner authorization before changing this user's Auth password.
      const client = await currentClient();
      const result = await client.auth.updateUser({ password, ...(needsCode ? { nonce } : {}), data: { ksda_password_set: true } });
      if (result.error) throw result.error;
      if (result.data.user?.id !== userId) throw new Error("SIGN_IN_REQUIRED");
      setPassword(""); setConfirmation(""); setNonce(""); setNeedsCode(false); setCodeSent(false); setSaved(true);
      if (mode === "setup") {
        const session = parseLearningSession(await learningRequest("session"));
        const returnTo = safeCourseDestination(next);
        location.replace(session.destination === "/learn/dashboard" ? returnTo || "/learn/dashboard" : `/learn/onboarding${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
      }
    } catch (e) { setError(passwordError(e)); }
    finally { setBusy(false); }
  }
  async function sendVerification() {
    setBusy(true); setError("");
    try {
      const client = await currentClient();
      const result = await client.auth.reauthenticate();
      if (result.error) throw result.error;
      setCodeSent(true); setNonce(""); setWait(60);
    } catch (e) { setError(passwordError(e)); }
    finally { setBusy(false); }
  }
  return <section id="password" className="ksda-container ksda-password-settings" data-no-translate aria-labelledby="password-heading">
    <Heading id="password-heading">{mode === "setup" ? t("Set your learning password", "Tetapkan kata laluan pembelajaran anda") : mode === "recovery" ? t("Reset your learning password", "Tetapkan semula kata laluan pembelajaran anda") : t("Add or change your password", "Tambah atau tukar kata laluan")}</Heading>
    <p>{mode === "setup" ? t("Your email is verified. Set a password, then complete your profile. Email-code login remains available.", "E-mel anda telah disahkan. Tetapkan kata laluan, kemudian lengkapkan profil. Log masuk melalui kod e-mel masih tersedia.") : t("Set a learning password to sign in with your email next time. This does not change your Google password. Email codes remain available.", "Tetapkan kata laluan pembelajaran untuk log masuk menggunakan e-mel pada masa hadapan. Ini tidak menukar kata laluan Google anda. Kod e-mel masih boleh digunakan.")}</p>
    {!saved && <form className="ksda-form" onSubmit={save}>
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <label htmlFor="new-password">{t("New learning password", "Kata laluan pembelajaran baharu")}</label><input id="new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-help" />
      <p id="password-help" className="ksda-fine">{t("Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol. Choose a password you do not use elsewhere.", "Gunakan sekurang-kurangnya 8 aksara dengan huruf besar, huruf kecil, nombor dan simbol. Pilih kata laluan yang tidak digunakan di tempat lain.")}</p>
      <label htmlFor="confirm-password">{t("Confirm new password", "Sahkan kata laluan baharu")}</label><input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      {needsCode && <>{codeSent && <p role="status">{t("Verification code sent. Check your inbox and spam folder.", "Kod pengesahan dihantar. Semak peti masuk dan folder spam anda.")}</p>}<button type="button" className="ksda-text-link" disabled={busy || wait > 0} onClick={sendVerification}>{wait ? t(`Resend in ${wait}s`, `Hantar semula dalam ${wait}s`) : codeSent ? t("Resend verification code", "Hantar semula kod pengesahan") : t("Send verification code", "Hantar kod pengesahan")}</button><label htmlFor="password-nonce">{t("Email verification code", "Kod pengesahan e-mel")}</label><input id="password-nonce" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={nonce} onChange={e => setNonce(e.target.value.replace(/\D/g, ""))} /></>}
      <button className="ksda-button" disabled={busy || (needsCode && !nonce)}>{busy ? t("Please wait…", "Sila tunggu…") : t("Save password", "Simpan kata laluan")}</button>
    </form>}
    {error && <p role="alert" className="ksda-error">{error}</p>}
    {saved && <><p role="status">{t("Password saved. You can now sign in with your email and learning password. Email-code login remains available.", "Kata laluan disimpan. Anda kini boleh log masuk menggunakan e-mel dan kata laluan pembelajaran. Log masuk melalui kod e-mel masih tersedia.")}</p>{mode === "recovery" ? <><p>{t("Sign out, then sign in with your new password to check it.", "Log keluar, kemudian log masuk menggunakan kata laluan baharu untuk menyemaknya.")}</p><SignOut config={config} /></> : <Link className="ksda-text-link" href={mode === "setup" ? `/learn/onboarding${safeCourseDestination(next) ? `?next=${encodeURIComponent(safeCourseDestination(next))}` : ""}` : "/learn/dashboard"}>{t("Continue to my learning", "Teruskan ke pembelajaran saya")}</Link>}</>}
  </section>;
}
