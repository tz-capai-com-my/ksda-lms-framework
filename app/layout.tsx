import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { brand } from "@/config/brand";
import "./globals.css";
import GlobalSiteControls from "./GlobalSiteControls";
import GlobalLegalFooter from "./GlobalLegalFooter";

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: brand.name,
  description: brand.description,
  openGraph: { title: brand.name, description: brand.description, type: "website" },
  twitter: { card: "summary", title: brand.name, description: brand.description },
  icons: { icon: brand.logoPath, shortcut: brand.logoPath, apple: brand.logoPath },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const colors = { "--brand-accent": brand.accentColor, "--brand-accent-dark": brand.accentColorDark, "--gold": brand.accentColorDark, "--gold-bright": brand.accentColorDark } as CSSProperties;
  return <html lang={brand.locale}><body style={colors}>{children}<GlobalLegalFooter /><GlobalSiteControls /></body></html>;
}
