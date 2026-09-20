import Image from "@/app/SiteImage";
import { brand } from "@/config/brand";
import { supabaseConfig } from "./supabase/config";
import { LearnerNav } from "./LearnerExperience";
import Link from "../SiteLink";
import "./learn.css";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  let config; try { config = supabaseConfig(); } catch { /* Account routes fail closed without configuration. */ }
  return <div className="ksda-site">
    <header className="ksda-header">
      <Link href="/" aria-label={brand.name}><Image priority src={brand.logoPath} width="170" height="63" alt={brand.name} /></Link>
      <nav aria-label="Learning navigation"><Link href="/learn">KSDA</Link><Link href="/learn/free">Free programmes</Link>{config && <LearnerNav config={config} />}</nav>
    </header>
    {children}
  </div>;
}
