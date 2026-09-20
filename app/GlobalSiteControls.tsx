"use client";

import Link from "./SiteLink";
import { brand } from "@/config/brand";
import { useEffect, useMemo, useRef, useState } from "react";

type Locale = "en" | "ms";
type LearningTheme = "dark" | "light";

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const translatedAttributes = ["aria-label", "title", "placeholder"] as const;
const siteTranslations: Record<string, string> = { "Free programmes": "Program percuma", "Learning navigation": "Navigasi pembelajaran", "Home": "Laman utama", "Privacy policy": "Dasar privasi", "Help": "Bantuan" };

const publicPages = [
  { href: "/", en: "Home", ms: "Laman utama", keywords: "home main utama" },
  { href: "/learn", en: "Learning hub", ms: "Hab pembelajaran", keywords: "ksda method kaedah" },
  { href: "/learn/free", en: "Free programmes", ms: "Program percuma", keywords: "learning modules courses pembelajaran modul kursus" },
  { href: "/learn/dashboard", en: "My learning", ms: "Pembelajaran saya", keywords: "dashboard progress kemajuan" },
  { href: "/learn/profile", en: "My profile", ms: "Profil saya", keywords: "account language akaun bahasa" },
  { href: "/help", en: "Help", ms: "Bantuan", keywords: "support contact bantuan hubungi" },
  { href: "/privacy", en: "Privacy policy", ms: "Dasar privasi", keywords: "privacy data privasi" },
  ...(brand.shopUrl ? [{ href: brand.shopUrl, en: "Shop", ms: "Kedai", keywords: "resources tools shop sumber alat kedai" }] : []),
];

function translatedCopy(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  return core && siteTranslations[core] ? `${leading}${siteTranslations[core]}${trailing}` : value;
}

function translateDocument(locale: Locale) {
  document.documentElement.lang = locale === "ms" ? "ms-MY" : "en";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest("script, style, noscript, code, pre, textarea, [data-no-translate]")) {
      const source = originalText.get(textNode) ?? textNode.nodeValue ?? "";
      if (!originalText.has(textNode)) originalText.set(textNode, source);
      const next = locale === "ms" ? translatedCopy(source) : source;
      if (textNode.nodeValue !== next) textNode.nodeValue = next;
    }
    node = walker.nextNode();
  }

  document.querySelectorAll<HTMLElement>("[aria-label], [title], [placeholder]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    const saved = originalAttributes.get(element) ?? {};
    for (const attribute of translatedAttributes) {
      const current = element.getAttribute(attribute);
      if (current !== null && saved[attribute] === undefined) saved[attribute] = current;
      const source = saved[attribute];
      if (source !== undefined) element.setAttribute(attribute, locale === "ms" ? siteTranslations[source] ?? source : source);
    }
    originalAttributes.set(element, saved);
  });
}

function storedLocale(): Locale {
  const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("ksda_locale="));
  const value = cookie?.split("=")[1] ?? window.localStorage.getItem("ksda-locale");
  return value === "ms" || value === "en" ? value : brand.locale.startsWith("ms") ? "ms" : "en";
}

function storedTheme(): LearningTheme {
  const value = window.localStorage.getItem("ksda-learning-theme");
  if (value === "light" || value === "dark") return value;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function GlobalSiteControls() {
  const [locale, setLocale] = useState<Locale>(brand.locale.startsWith("ms") ? "ms" : "en");
  const [theme, setTheme] = useState<LearningTheme>("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLocale(storedLocale());
      const nextTheme = storedTheme();
      setTheme(nextTheme);
      document.documentElement.dataset.capaiTheme = nextTheme;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    translateDocument(locale);
    const observer = new MutationObserver(() => translateDocument(locale));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    if (menuOpen) window.requestAnimationFrame(() => searchRef.current?.focus());
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [menuOpen]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return publicPages;
    return publicPages.filter((page) => `${page.en} ${page.ms} ${page.keywords}`.toLowerCase().includes(needle));
  }, [query]);

  function chooseLocale(next: Locale) {
    document.cookie = `ksda_locale=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
    window.localStorage.setItem("ksda-locale", next);
    setLocale(next);
  }

  function chooseTheme(next: LearningTheme) {
    window.localStorage.setItem("ksda-learning-theme", next);
    document.documentElement.dataset.capaiTheme = next;
    window.dispatchEvent(new CustomEvent("ksda-theme-change", { detail: next }));
    setTheme(next);
  }

  return (
    <div className="global-site-controls" data-no-translate>
      <button className="global-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="global-follow-menu">
        <span aria-hidden="true">☰</span><b>Menu</b>
      </button>

      {menuOpen && <>
        <button className="global-menu-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label={locale === "ms" ? "Tutup menu" : "Close menu"} />
        <aside className="global-follow-menu" id="global-follow-menu" aria-label={locale === "ms" ? "Navigasi laman" : "Site navigation"}>
          <header>
            <div><span>{brand.name}</span><small>{locale === "ms" ? "Navigasi pembelajaran" : "Learning navigation"}</small></div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={locale === "ms" ? "Tutup menu" : "Close menu"}>×</button>
          </header>

          <label className="global-menu-search">
            <span>{locale === "ms" ? "Cari laman" : "Search the site"}</span>
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "ms" ? "Program, profil, bantuan…" : "Programmes, profile, help…"} />
          </label>


          <nav aria-label={locale === "ms" ? "Pautan pembelajaran" : "Learning links"}>
            {results.map((page, index) => (
              <Link href={page.href} onClick={() => setMenuOpen(false)} key={page.href}>
                <span>{String(index + 1).padStart(2, "0")}</span>{locale === "ms" ? page.ms : page.en}
              </Link>
            ))}
            {results.length === 0 && <p>{locale === "ms" ? "Tiada padanan. Cuba istilah lain." : "No matching page. Try another term."}</p>}
          </nav>

          <section className="global-menu-preferences" aria-label={locale === "ms" ? "Tetapan paparan" : "Display preferences"}>
            <div><span>{locale === "ms" ? "Bahasa" : "Language"}</span><div><button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => chooseLocale("en")} aria-pressed={locale === "en"}>EN</button><button type="button" className={locale === "ms" ? "is-active" : ""} onClick={() => chooseLocale("ms")} aria-pressed={locale === "ms"}>BM</button></div></div>
            <div><span>{locale === "ms" ? "Tema pembelajaran" : "Learning theme"}</span><div><button type="button" className={theme === "light" ? "is-active" : ""} onClick={() => chooseTheme("light")} aria-pressed={theme === "light"}>☀ {locale === "ms" ? "Cerah" : "Light"}</button><button type="button" className={theme === "dark" ? "is-active" : ""} onClick={() => chooseTheme("dark")} aria-pressed={theme === "dark"}>◐ {locale === "ms" ? "Gelap" : "Dark"}</button></div></div>
          </section>

        </aside>
      </>}
    </div>
  );
}
