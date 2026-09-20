"use client";
import Image from "@/app/SiteImage";
import Link from "../SiteLink";
import { TopicDetails } from "./TopicDetails";
import { brand } from "@/config/brand";
import { useEffect, useState } from "react";
import { useLocale } from "./LearnExperience";
import { learningRequest } from "./LearnerExperience";
import { parseLearningProgress } from "./learning-response";
import type { FreeCourse } from "./free-content";

export function TopicExperience({ course, index, initialCurrent, initialPercentage, initialReady }: {
  course: FreeCourse; index: number; initialCurrent: number; initialPercentage: number; initialReady: boolean;
}) {
  const t = useLocale();
  const topic = course.topics[index];
  const locale = t("en", "ms") as "en" | "ms";
  const summaryPoints = locale === "ms" ? topic.notesMs : topic.notes;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [current, setCurrent] = useState(initialCurrent);
  const [percentage, setPercentage] = useState(initialPercentage);
  const [enrolled, setEnrolled] = useState(initialReady);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const completed = index + 1 < current;
  const ready = topic.questions.every(q => answers[q.id] !== undefined) && confirmation;
  useEffect(() => {
    if (initialReady) return;
    let active = true;
    // Opening the authenticated course starts its durable enrolment at 0%.
    // The endpoint is idempotent, including concurrent tabs and retries.
    learningRequest("enrol", { slug: course.slug }).then(() => {
      if (active) setEnrolled(true);
    }).catch(() => {
      // Completion retries this same enrolment before attempting to save.
    });
    return () => { active = false; };
  }, [course.slug, initialReady]);
  async function complete() {
    if (!ready || completed || busy) return;
    setBusy(true); setError("");
    try {
      if (!enrolled) { await learningRequest("enrol", { slug: course.slug }); setEnrolled(true); }
      // Reflection choices and personal notes never leave this component.
      const result = parseLearningProgress(await learningRequest("progress", { slug: course.slug, missionId: topic.id, completionConfirmed: true }), course.topics.length);
      setCurrent(result.progress.current_mission); setPercentage(result.progress.progress_percentage);
    } catch (e) {
      const code = (e as Error).message;
      setError(code === "SIGN_IN_REQUIRED"
        ? t("Please sign in again to save your progress.", "Sila log masuk semula untuk menyimpan kemajuan anda.")
        : ["PROGRESS_CHANGED_RELOAD", "MISSION_LOCKED", "PROGRESS_REVIEW_REQUIRED"].includes(code)
          ? t("Please reload this topic to check your saved progress. Your records have not been reset.", "Sila muat semula topik ini untuk menyemak kemajuan yang disimpan. Rekod anda tidak ditetapkan semula.")
          : t("Your progress could not be saved. Please try again.", "Kemajuan anda tidak dapat disimpan. Sila cuba lagi."));
    } finally { setBusy(false); }
  }
  return <main className="ksda-container ksda-topic-page" data-no-translate>
    <nav className="ksda-topic-breadcrumb" aria-label={t("Learning navigation", "Navigasi pembelajaran")}><Link href="/learn/free">{t("Free programmes", "Program percuma")}</Link><span aria-hidden="true">/</span><Link href="/learn/dashboard">{t("My learning", "Pembelajaran saya")}</Link><span aria-hidden="true">/</span>{brand.shopUrl && <><a href={brand.shopUrl} target="_blank" rel="noopener noreferrer">{t("Shop", "Kedai")}</a><span aria-hidden="true">/</span></>}<Link href="/help">{t("Help", "Bantuan")}</Link></nav>
    <header className="ksda-topic-heading"><p className="ksda-kicker">{t(course.title, course.titleMs)}</p><p className="ksda-fine">{t(`Topic ${index + 1} of ${course.topics.length}`, `Topik ${index + 1} daripada ${course.topics.length}`)} · {t("Free awareness learning", "Pembelajaran kesedaran percuma")}</p><h1>{t(topic.title, topic.titleMs)}</h1></header>
    <div className="ksda-topic-layout"><div className="ksda-topic-content">
      <section aria-label={t("Topic video", "Video topik")} className="ksda-topic-video">
        {topic.videoUrl ? <video controls preload="metadata" aria-label={t(topic.title, topic.titleMs)} src={topic.videoUrl} /> : <div className="ksda-video-placeholder"><span className="ksda-video-icon" aria-hidden="true">▤</span><strong>{t("Learn from the notes below", "Belajar melalui nota di bawah")}</strong><p>{t("You can begin with the notes and questions below. A video is not required to complete this topic.", "Anda boleh bermula dengan nota dan soalan di bawah. Video tidak diperlukan untuk melengkapkan topik ini.")}</p></div>}
      </section>
      <section className="ksda-topic-section"><h2>{t("Notes to begin", "Nota permulaan")}</h2><ul className="ksda-teaching-points" lang={locale}>{summaryPoints.map((point, i) => <li key={i}>{point}</li>)}</ul><p className="ksda-fine">{t("Awareness and reflection only. This does not assess practical competence or replace appropriate instructor-led training. Do not create a hazard or practise treatment on a person for this activity.", "Untuk kesedaran dan refleksi sahaja. Ini tidak menilai kecekapan praktikal atau menggantikan latihan yang sesuai bersama pengajar. Jangan wujudkan bahaya atau mencuba rawatan pada seseorang untuk aktiviti ini.")}</p></section>
      {!!topic.sections?.length && <TopicDetails sections={topic.sections} />}
      <section className="ksda-topic-section"><h2>{t("Pause and consider", "Berhenti seketika dan fikirkan")}</h2><p>{t("Choose what fits your situation. These questions have no score; your choices are not saved.", "Pilih jawapan yang sesuai dengan keadaan anda. Soalan ini tidak diberi markah; pilihan anda tidak disimpan.")}</p>{topic.questions.map((q, n) => <fieldset key={q.id} className="ksda-topic-question"><legend>{n + 1}. {t(q.prompt, q.promptMs)}</legend>{q.options.map((option, i) => <label key={i}><input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers(a => ({ ...a, [q.id]: i }))} /> <span>{t(option, q.optionsMs[i] || option)}</span></label>)}{answers[q.id] !== undefined && <p className="ksda-topic-feedback" role="status">{t(q.feedback, q.feedbackMs)}</p>}</fieldset>)}</section>
      <section className="ksda-topic-section"><h2>{t("Your private notes", "Nota peribadi anda")}</h2><label htmlFor="topic-notes">{t(topic.notesPrompt, topic.notesPromptMs)}</label><textarea id="topic-notes" rows={5} maxLength={3000} value={notes} onChange={e => setNotes(e.target.value)} aria-describedby="notes-privacy" /><p id="notes-privacy" className="ksda-fine">{t("Optional. Notes stay on this page only and disappear when you leave or refresh. Keep anything you want to retain in your own private notes file. Do not enter medical details, addresses, passwords or other sensitive information.", "Pilihan. Nota kekal pada halaman ini sahaja dan hilang apabila anda keluar atau memuat semula. Simpan nota yang ingin dikekalkan dalam fail nota peribadi sendiri. Jangan masukkan butiran perubatan, alamat, kata laluan atau maklumat sensitif lain.")}</p></section>
      <section className="ksda-topic-section ksda-topic-completion"><h2>{t("Finish this topic", "Selesaikan topik ini")}</h2>{completed ? <><p role="status">{t("Topic complete. Your progress is saved.", "Topik selesai. Kemajuan anda telah disimpan.")}</p><a className="ksda-button" href={index + 1 < course.topics.length ? `/learn/courses/${course.slug}/missions/${course.topics[index + 1].id}` : "/learn/dashboard"}>{t(index + 1 < course.topics.length ? "Next topic" : "Return to my learning", index + 1 < course.topics.length ? "Topik seterusnya" : "Kembali ke pembelajaran saya")}</a></> : <><label className="ksda-topic-confirm"><input type="checkbox" checked={confirmation} onChange={e => setConfirmation(e.target.checked)} /><span>{t("I have read the notes and considered the questions and one useful next step.", "Saya telah membaca nota, mempertimbangkan soalan dan satu langkah seterusnya yang berguna.")}</span></label><button type="button" className="ksda-button" disabled={!ready || busy} onClick={complete}>{busy ? t("Saving…", "Menyimpan…") : t("Mark complete", "Tandakan selesai")}</button><p className="ksda-fine">{t("Answer the reflection questions and tick the confirmation to continue. Completion records your self-study, not a professional qualification.", "Jawab soalan refleksi dan tandakan pengesahan untuk meneruskan. Penyelesaian merekodkan pembelajaran kendiri anda, bukan kelayakan profesional.")}</p></>}{error && <p role="alert" className="ksda-error">{error} <Link href="/learn/sign-in">{t("Sign in", "Log masuk")}</Link></p>}</section>
    </div><aside className="ksda-topic-sidebar">{course.image && <figure><Image className="ksda-topic-illustration" src={course.image} alt={t("Learning illustration", "Ilustrasi pembelajaran")} width="1000" height="650" /><figcaption className="ksda-fine">{t("Learning illustration · not a technique demonstration", "Ilustrasi pembelajaran · bukan demonstrasi teknik")}</figcaption></figure>}<h2>{t("Your progress", "Kemajuan anda")}</h2><p aria-live="polite">{percentage}% {t("complete", "selesai")}</p><progress value={percentage} max={100} aria-label={t("Programme progress", "Kemajuan program")} /><ol>{course.topics.map((item, n) => <li key={item.id}>{n + 1 <= current ? <a aria-current={n === index ? "step" : undefined} href={`/learn/courses/${course.slug}/missions/${item.id}`}><span>{String(n + 1).padStart(2, "0")}</span><span>{t(item.title, item.titleMs)}{n + 1 < current && <small>{t("Complete", "Selesai")}</small>}</span></a> : <span className="ksda-topic-locked"><span>{String(n + 1).padStart(2, "0")}</span><span>{t(item.title, item.titleMs)}<small>{t("Complete the previous topic first", "Selesaikan topik sebelumnya dahulu")}</small></span></span>}</li>)}</ol>{brand.shopUrl && <div className="ksda-topic-tools"><h3>{t("Optional learning materials", "Bahan pembelajaran pilihan")}</h3><p>{t("Explore additional resources in the shop. Your free learning progress does not depend on a purchase.", "Teroka sumber tambahan di kedai. Kemajuan pembelajaran percuma anda tidak bergantung pada pembelian.")}</p><a href={brand.shopUrl} target="_blank" rel="noopener noreferrer">{t("Visit the shop", "Lawati kedai")} ↗</a></div>}</aside></div>
  </main>;
}
