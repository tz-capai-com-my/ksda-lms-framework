"use client";
import Link from "./SiteLink";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand";
import { useLocale } from "./learn/LearnExperience";

export default function GlobalLegalFooter() {
  const pathname = usePathname();
  const t = useLocale();
  if (pathname?.startsWith("/admin")) return null;
  return <footer className="global-legal-footer" data-no-translate>
    <p>{brand.name} · {t("Operated by", "Dikendalikan oleh")} {brand.legalName}</p>
    <nav aria-label={t("Learning, support and privacy links", "Pautan pembelajaran, bantuan dan privasi")}>
      <Link href="/learn">{t("Learning hub", "Hab pembelajaran")}</Link>
      <Link href="/learn/free">{t("Free programmes", "Program percuma")}</Link>
      <Link href="/help">{t("Help", "Bantuan")}</Link>
      <Link href="/privacy">{t("Privacy policy", "Dasar privasi")}</Link>
      {brand.shopUrl && <a href={brand.shopUrl} target="_blank" rel="noopener noreferrer">{t("Shop", "Kedai")} ↗</a>}
    </nav>
  </footer>;
}
