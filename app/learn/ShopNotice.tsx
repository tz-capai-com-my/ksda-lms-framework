"use client";
import { brand } from "@/config/brand";
import { useLocale } from "./LearnExperience";

export default function ShopNotice() {
  const t = useLocale();
  if (!brand.shopUrl) return null;
  return <aside className="ksda-shop-notice" aria-label={t("Optional learning materials", "Bahan pembelajaran pilihan")} data-no-translate>
    <div className="ksda-shop-banner"><div>
      <p className="ksda-kicker">{t("Optional resources", "Sumber pilihan")}</p>
      <h3>{t("Explore supporting materials", "Teroka bahan sokongan")}</h3>
      <p>{t("Browse the shop for additional resources. Purchases are optional and are not required to complete a free programme. Check each product's access and licence terms before buying.", "Layari kedai untuk mendapatkan sumber tambahan. Pembelian adalah pilihan dan tidak diperlukan untuk melengkapkan program percuma. Semak syarat akses dan lesen setiap produk sebelum membeli.")}</p>
    </div><a className="ksda-button" href={brand.shopUrl} target="_blank" rel="noopener noreferrer">{t("Visit the shop", "Lawati kedai")} ↗</a></div>
  </aside>;
}
