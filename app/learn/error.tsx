"use client";
import { brand } from "@/config/brand";
import Link from "../SiteLink";
import { useLocale } from "./LearnExperience";
export default function ErrorPage({reset}: {reset:()=>void}) {
 const t=useLocale();
 return <main className="ksda-container ksda-access" data-no-translate><p className="ksda-kicker">{brand.name}</p><h1>{t("Please try again.","Sila cuba lagi.")}</h1><p role="alert">{t("We could not load your learning account. Your saved records have not been changed.","Akaun pembelajaran anda tidak dapat dimuatkan. Rekod yang disimpan tidak diubah.")}</p><div className="ksda-actions"><button className="ksda-button" onClick={reset}>{t("Try again","Cuba lagi")}</button><Link href="/learn/sign-in" className="ksda-text-link">{t("Continue with email","Teruskan dengan e-mel")}</Link><Link href="/learn/free" className="ksda-text-link">{t("Explore free learning","Teroka pembelajaran percuma")}</Link></div></main>;
}
