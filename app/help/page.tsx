"use client";
import Link from "@/app/SiteLink";
import { brand } from "@/config/brand";
import { useLocale } from "@/app/learn/LearnExperience";
export default function HelpPage() {
  const t = useLocale();
  return <main className="framework-info" data-no-translate><Link href="/learn/free">← {t("Programmes", "Program")}</Link><h1>{t("Learning support", "Bantuan pembelajaran")}</h1><ul><li>{t("Sign in with your email and the six-digit code sent to you.", "Log masuk menggunakan e-mel dan kod enam digit yang dihantar kepada anda.")}</li><li>{t("Complete your profile, then choose a programme. Your saved topic progress is linked to your account.", "Lengkapkan profil, kemudian pilih program. Kemajuan topik yang disimpan dipautkan kepada akaun anda.")}</li><li>{t("Use EN / BM in the menu to change language. Keep any reflection notes you want to retain in your own private file.", "Gunakan EN / BM dalam menu untuk menukar bahasa. Simpan nota refleksi yang ingin dikekalkan dalam fail peribadi sendiri.")}</li></ul>{brand.supportEmail ? <a href={`mailto:${brand.supportEmail}`}>{t("Contact support", "Hubungi bantuan")}</a> : <p>{t("Contact the organisation that invited you to this learning hub for account help.", "Hubungi organisasi yang menjemput anda ke hab pembelajaran ini untuk bantuan akaun.")}</p>}</main>;
}
