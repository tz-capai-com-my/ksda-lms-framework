"use client";
import { brand } from "@/config/brand";
import { useEffect, useState, type FormEvent } from "react";
import Link from "../SiteLink";
import { useLocale } from "./LearnExperience";
import { learnerBrowserClient } from "./supabase/browser";
import type { SupabaseConfig } from "./supabase/config";

export function PasswordRecovery({ config }: { config: SupabaseConfig }) {
  const t = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSent(false); setWait(60);
    try {
      // The existing callback exchanges the PKCE code and checks the account.
      // Passwords and bearer tokens never travel in this URL.
      const result = await learnerBrowserClient(config).auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/learn/auth/callback", location.origin).href,
      });
      if (result.error) throw result.error;
      // Identical response whether or not the email belongs to an account.
      setSent(true);
    } catch {
      setError(t("We could not request a reset link. Please wait and try again, or sign in with an email code.", "Pautan tetapan semula tidak dapat diminta. Sila tunggu dan cuba lagi, atau log masuk menggunakan kod e-mel."));
    } finally { setBusy(false); }
  }
  return <main className="ksda-container ksda-access" data-no-translate>
    <p className="ksda-kicker">{brand.name}</p>
    <h1>{t("Forgot your password?", "Terlupa kata laluan?")}</h1>
    <p>{t("Request a link to reset your learning password. This does not change your Google password.", "Minta pautan untuk menetapkan semula kata laluan pembelajaran anda. Ini tidak menukar kata laluan Google anda.")}</p>
    <form className="ksda-form" onSubmit={send}>
      <label htmlFor="recovery-email">{t("Email address", "Alamat e-mel")}</label>
      <input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} />
      <button className="ksda-button" disabled={busy || wait > 0}>{busy ? t("Please wait…", "Sila tunggu…") : wait ? t(`Try again in ${wait}s`, `Cuba lagi dalam ${wait}s`) : t("Send password-reset link", "Hantar pautan tetapan semula kata laluan")}</button>
    </form>
    {sent && <p role="status">{t("If this email has a learning account, a reset link will arrive shortly. Check your inbox and spam folder.", "Jika e-mel ini mempunyai akaun pembelajaran, pautan tetapan semula akan dihantar sebentar lagi. Semak peti masuk dan folder spam anda.")}</p>}
    {error && <p role="alert" className="ksda-error">{error}</p>}
    <p className="ksda-fine">{t("Open the newest reset email in this same browser on this device. If your email app opens a different browser, return here in that browser and request a new link.", "Buka e-mel tetapan semula terkini dalam pelayar dan peranti yang sama ini. Jika aplikasi e-mel membuka pelayar lain, buka halaman ini dalam pelayar tersebut dan minta pautan baharu.")}</p>
    <Link className="ksda-text-link" href="/learn/sign-in">{t("Back to sign in or use an email code", "Kembali untuk log masuk atau gunakan kod e-mel")}</Link>
  </main>;
}
