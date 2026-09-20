"use client";
import { useState } from "react";
import { useLocale } from "./LearnExperience";
import { brand } from "@/config/brand";
import ShopNotice from "./ShopNotice";
export type DetailedSection = {
  id: string; title: string; titleMs: string; body: string[]; bodyMs: string[]; sourcePages: number[];
  kind: "knowledge" | "practice" | "action" | "review" | "safety";
  reviewState?: string; primaryReferences?: string[];
};
export function TopicDetails({ sections }: { sections: DetailedSection[] }) {
  const t = useLocale();
  const [considered, setConsidered] = useState<Record<string, boolean>>({});
  const labels = {
    knowledge: t("K · Knowledge", "K · Pengetahuan"), practice: t("S · Practice", "S · Latihan"),
    action: t("A · Action", "A · Tindakan"), review: t("Reflect & review", "Refleksi & ulasan"), safety: t("Practice boundary", "Batas latihan"),
  };
  return <section className="ksda-topic-section ksda-workbook-reading" aria-label={t("Detailed topic learning", "Pembelajaran topik terperinci")}>
    <h2>{t("Work through the topic", "Teliti topik ini")}</h2>
    <p className="ksda-fine">{t("Read the full topic in English or Bahasa Malaysia using EN / BM in the menu.", "Baca keseluruhan topik dalam bahasa Inggeris atau Bahasa Malaysia melalui EN / BM dalam menu.")}</p>
    {sections.map(section => {
      const locale = t("en", "ms") as "en" | "ms";
      const paragraphs = locale === "ms" ? section.bodyMs : section.body;
      return <article key={section.id} className={`ksda-reading-block ksda-reading-${section.kind}`} lang={locale}>
        <p className="ksda-kicker">{labels[section.kind]}</p>
        <h3>{t(section.title, section.titleMs)}</h3>
        <ul className="ksda-teaching-points">{paragraphs.map((point, i) => <li key={i}>{point}</li>)}</ul>
        {["practice", "action", "review"].includes(section.kind) && <label className="ksda-topic-confirm"><input type="checkbox" checked={!!considered[section.id]} onChange={e => setConsidered(v => ({ ...v, [section.id]: e.target.checked }))} /><span>{t("I have considered this activity and my next step.", "Saya telah mempertimbangkan aktiviti ini dan langkah seterusnya.")}</span></label>}
        <div className="ksda-source-note">{brand.shopUrl && <a href={brand.shopUrl} target="_blank" rel="noopener noreferrer">{t("Explore optional supporting materials", "Teroka bahan sokongan pilihan")} ↗</a>}{section.primaryReferences?.map(url => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{t("Read primary guidance", "Baca panduan sumber utama")} ↗</a></p>)}</div>
      </article>;
    })}
    <ShopNotice />
  </section>;
}
