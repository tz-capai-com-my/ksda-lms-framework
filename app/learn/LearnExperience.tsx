"use client";
import Image from "@/app/SiteImage";
import { brand } from "@/config/brand";

import Link from "../SiteLink";
import { useEffect, useState } from "react";
import { programmes } from "./catalogue";
import { siteSlug, presentation, type Course } from "./course-model";

type Locale = "en" | "ms";
export function useLocale() {
  const [locale, setLocale] = useState<Locale>(brand.locale.startsWith("ms") ? "ms" : "en");
  useEffect(() => {
    const read = () => setLocale(document.documentElement.lang.startsWith("ms") ? "ms" : "en");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return (en: string, ms: string) => locale === "ms" ? ms : en;
}

const stages = [
  { letter: "K", en: "Knowledge", ms: "Pengetahuan", heading: "Understand what matters.", headingMs: "Fahami perkara yang penting.", copy: "Recognise the situation. Make sense of the information. Know what you need to distinguish.", copyMs: "Kenali situasi. Fahami maklumat. Ketahui perkara yang perlu dibezakan." },
  { letter: "S", en: "Skill", ms: "Kemahiran", heading: "Practise a useful response.", headingMs: "Latih respons yang berguna.", copy: "Try a decision, a conversation or a sequence. Use a scenario before you need the skill in real life.", copyMs: "Cuba membuat keputusan, berbual atau menyusun langkah. Berlatih melalui senario sebelum kemahiran itu diperlukan dalam kehidupan sebenar." },
  { letter: "D", en: "Desire", ms: "Kemahuan", heading: "Find your reason to act.", headingMs: "Cari sebab untuk bertindak.", copy: "Connect the learning to your life. Work through doubts, practical barriers and the choice you want to make.", copyMs: "Hubungkan pembelajaran dengan kehidupan anda. Teliti keraguan, halangan praktikal dan pilihan yang ingin anda buat." },
  { letter: "A", en: "Action", ms: "Tindakan", heading: "Put it into practice.", headingMs: "Amalkan apa yang dipelajari.", copy: "Carry out a safe practical task or a meaningful simulation. A click on Complete is not the task.", copyMs: "Lakukan tugasan praktikal yang selamat atau simulasi yang bermakna. Menekan butang Selesai bukanlah tugasan itu sendiri." },
];

const examples = [
  ["Knowledge", "Pengetahuan", "Assumed—or confirmed?", "Andaian—atau sudah disahkan?", "An arrangement can sound clear while different people understand it differently. Distinguish an assumption from something that has been confirmed.", "Sesuatu aturan mungkin kedengaran jelas, tetapi difahami secara berbeza oleh orang lain. Bezakan andaian daripada perkara yang sudah disahkan."],
  ["Skill", "Kemahiran", "Rehearse the question.", "Latih soalan anda.", "Use a fictional everyday arrangement. Practise asking another person to explain what they understand, then compare your two versions.", "Gunakan aturan harian yang direka. Latih cara meminta seseorang menerangkan pemahamannya, kemudian bandingkan kedua-dua versi."],
  ["Desire", "Kemahuan", "Make it relevant.", "Kaitkan dengan kehidupan anda.", "Where could an unchecked assumption cause confusion in your life? Consider what makes clarification awkward—and what might make it easier.", "Di manakah andaian yang tidak disemak boleh menyebabkan kekeliruan dalam kehidupan anda? Fikirkan perkara yang menyukarkan penjelasan, dan cara memudahkannya."],
  ["Action", "Tindakan", "Clarify one arrangement.", "Jelaskan satu aturan.", "When appropriate, clarify one ordinary arrangement, or rehearse the equivalent using fictional details. Keep personal information private.", "Jika sesuai, jelaskan satu aturan harian, atau latih situasi yang setara menggunakan maklumat rekaan. Pastikan maklumat peribadi kekal sulit."],
];

function ProgrammeCards({ courses, unavailable = false, compact = false }: { courses: Course[]; unavailable?: boolean; compact?: boolean }) {
  const t = useLocale();
  if (unavailable) return <p role="status" className="ksda-notice">{t("The programme catalogue is temporarily unavailable. Please try again shortly.", "Katalog program tidak tersedia buat sementara waktu. Sila cuba sebentar lagi.")}</p>;
  if (!courses.length) return <p role="status" className="ksda-notice">{t("No programmes are published yet. Please check back later.", "Belum ada program diterbitkan. Sila semak semula kemudian.")}</p>;
  return <div className={compact ? "ksda-course-grid ksda-compact" : "ksda-course-grid"}>
    {courses.map((course, index) => { const local = presentation(course); const p = { ...local, slug: siteSlug(course.slug), number: String(index + 1).padStart(2, "0"), title: course.title, titleMs: local?.titleMs || course.title, outcome: course.short_description, outcomeMs: local?.outcomeMs || course.short_description, style: "Notes · Questions · Reflection", styleMs: "Nota · Soalan · Refleksi", duration: "Self-paced", durationMs: "Mengikut kadar sendiri", missions: local?.missions, image: local?.image, alt: local?.alt }; return <article id={p.slug} className="ksda-course-card" key={p.slug}>
      {p.image && <figure><Image src={p.image} alt={p.alt || t("Programme illustration", "Ilustrasi program")} width="900" height="600" loading="lazy" sizes="(max-width: 700px) 100vw, 50vw" /><figcaption>{t("Programme illustration", "Ilustrasi program")}</figcaption></figure>}
      <div className="ksda-course-body">
        <div className="ksda-course-meta"><span>{p.number}</span><b>{course.access_type === "free" ? t("Free · Start learning", "Percuma · Mula belajar") : t("Access in preparation", "Akses dalam persediaan")}</b></div>
        <h3>{t(p.title, p.titleMs)}</h3><p>{t(p.outcome, p.outcomeMs)}</p>
        <dl><div><dt>{t("Experience", "Pengalaman")}</dt><dd>{t(p.style, p.styleMs)}</dd></div><div><dt>{t("Estimated time", "Anggaran masa")}</dt><dd>{t(p.duration, p.durationMs)}</dd></div><div><dt>{t("Programme design", "Reka bentuk program")}</dt><dd>{p.missions ? `${p.missions} ${t("topics", "topik")}` : t("In preparation", "Dalam persediaan")}</dd></div></dl>
        {!compact && <p className="ksda-fine">{t("Short notes, reflection questions and saved topic completion. Awareness learning; not an accredited qualification.", "Nota ringkas, soalan refleksi dan kemajuan topik yang disimpan. Pembelajaran kesedaran; bukan kelayakan bertauliah.")}</p>}
        <Link className="ksda-card-link" href={`/learn/courses/${p.slug}`}>{t("Start / continue", "Mula / sambung")} <span aria-hidden="true">↗</span></Link>
      </div>
    </article>; })}
  </div>;
}

export default function LearnExperience({ courses, unavailable }: { courses: Course[]; unavailable: boolean }) {
  const t = useLocale();
  const freeCourses = courses.filter(course => course.access_type === "free");
  const [step, setStep] = useState(0);
  const example = examples[step];
  const faqs = [
    ["Are the programmes free?", "Adakah program ini percuma?", "Programmes in the free catalogue are free to access. Sign in with your email, read the notes, consider the questions and mark each topic complete.", "Program dalam katalog percuma boleh diakses secara percuma. Log masuk dengan e-mel, baca nota, fikirkan soalan dan tandakan setiap topik selesai."],
    ["How do I sign in?", "Bagaimanakah saya log masuk?", "Continue with your email and a six-digit code, then start or resume a free programme.", "Teruskan dengan e-mel dan kod enam digit, kemudian mula atau sambung program percuma."],
    ["Is this accredited or professional training?", "Adakah ini latihan profesional atau bertauliah?", "These programmes are for awareness and practical learning within stated limits. They do not establish professional competence or replace appropriate instructor-led training.", "Program ini bertujuan membina kesedaran dan pembelajaran praktikal dalam skop yang dinyatakan. Ia tidak membuktikan kecekapan profesional atau menggantikan latihan yang sesuai bersama pengajar."],
    ["What if I cannot do a practical task?", "Bagaimana jika saya tidak dapat melakukan tugasan praktikal?", "The programme design includes safe equivalent simulations where appropriate. You should never experiment with a hazard to complete an activity.", "Reka bentuk program menyediakan simulasi setara yang selamat apabila sesuai. Jangan mencuba sesuatu yang berbahaya semata-mata untuk melengkapkan aktiviti."],
    ["Are my reflections saved?", "Adakah refleksi saya disimpan?", "Your reflection choices and personal notes stay on the current page. They are not sent to the server and disappear when you leave or refresh. Your account, enrolment and topic completion are saved.", "Pilihan refleksi dan nota peribadi anda kekal pada halaman semasa. Maklumat ini tidak dihantar ke pelayan dan hilang apabila anda keluar atau memuat semula. Akaun, pendaftaran dan penyelesaian topik anda disimpan."],
    ["Can I use Bahasa Malaysia?", "Bolehkah saya menggunakan Bahasa Malaysia?", "Yes. Use EN / BM in the menu. Changing language keeps your account and saved progress.", "Ya. Gunakan EN / BM dalam menu. Pertukaran bahasa mengekalkan akaun dan kemajuan yang disimpan."],
  ];
  return <main className="ksda-main" data-no-translate>
    <section className="ksda-hero ksda-container">
      <div><p className="ksda-kicker">{brand.name}</p><h1>{t("Learn it.", "Pelajari.")}<br /><em>{t("Apply it.", "Amalkan.")}</em></h1><p className="ksda-lead">{t("Build knowledge. Practise a useful skill. Find a reason to use it. Put it into action—and learn from what happens.", "Bina pengetahuan. Latih kemahiran yang berguna. Cari sebab untuk menggunakannya. Bertindak—dan belajar daripada hasilnya.")}</p><div className="ksda-actions"><Link className="ksda-button" href="/learn/free">{t("Explore free programmes", "Teroka program percuma")} <span aria-hidden="true">↗</span></Link><a className="ksda-text-link" href="#how-ksda-works">{t("How KSDA works", "Cara KSDA berfungsi")}</a></div><p className="ksda-fine">{t("Knowledge · Skill · Desire · Action", "Pengetahuan · Kemahiran · Kemahuan · Tindakan")}</p></div>
      <div className="ksda-cycle" aria-label={t("Knowledge, Skill, Desire and Action, followed by review", "Pengetahuan, Kemahiran, Kemahuan dan Tindakan, diikuti ulasan")}>
        {stages.map((s, i) => <div className="ksda-cycle-row" key={s.letter}><span>{String(i + 1).padStart(2, "0")}</span><strong>{s.letter}</strong><div><b>{t(s.en, s.ms)}</b><p>{t(s.heading, s.headingMs)}</p></div></div>)}
        <div className="ksda-cycle-close"><span aria-hidden="true">↺</span><p>{t("Review what happened. Improve the next attempt.", "Semak apa yang berlaku. Perbaik percubaan seterusnya.")}</p></div>
      </div>
    </section>

    <section id="how-ksda-works" className="ksda-section ksda-surface"><div className="ksda-container">
      <div className="ksda-section-heading"><div><p className="ksda-kicker">{t("From information to application", "Daripada maklumat kepada amalan")}</p><h2>{t("Knowing an answer is", "Mengetahui jawapan hanyalah")} <em>{t("only the beginning.", "permulaan.")}</em></h2></div><p>{t("Information matters. People also need a chance to practise, make a choice and apply what they learn. KSDA connects those steps in one learning cycle.", "Maklumat itu penting. Namun, kita juga memerlukan peluang untuk berlatih, membuat pilihan dan mengamalkan apa yang dipelajari. KSDA menghubungkan langkah-langkah ini dalam satu kitaran pembelajaran.")}</p></div>
      <div className="ksda-dimensions">{stages.map((s, i) => <article key={s.letter}><span className="ksda-number">{String(i + 1).padStart(2,"0")}</span><p className="ksda-kicker">{t(s.en, s.ms)}</p><h3>{t(s.heading, s.headingMs)}</h3><p>{t(s.copy, s.copyMs)}</p></article>)}</div>
      <div className="ksda-review-line"><b>{t("After Action Review", "Ulasan Selepas Tindakan")}</b><p>{t("What did you do? What happened? What will you change next time? Reflection closes the Action cycle and informs the next mission.", "Apakah yang anda lakukan? Apakah yang berlaku? Apakah yang akan anda ubah pada masa hadapan? Refleksi melengkapkan kitaran Tindakan dan membantu misi seterusnya.")}</p></div>
    </div></section>

    <section className="ksda-section ksda-container" id="example"><div className="ksda-section-heading"><div><p className="ksda-kicker">{t("Example from the programme design", "Contoh daripada reka bentuk program")}</p><h2>{t("One ordinary assumption.", "Satu andaian biasa.")}<br /><em>{t("A more useful next step.", "Langkah seterusnya yang lebih berguna.")}</em></h2></div><p>{t("See how an everyday communication example moves one idea through KSDA. This illustrates the method; it is not a recorded learner outcome.", "Lihat bagaimana contoh komunikasi harian mengembangkan satu idea melalui KSDA. Ini ialah contoh kaedah, bukan hasil pelajar yang telah direkodkan.")}</p></div>
      <div className="ksda-demo"><div className="ksda-demo-steps" aria-label={t("Explore the KSDA stages", "Teroka peringkat KSDA")}>{examples.map((e, i) => <button key={e[0]} type="button" aria-pressed={step === i} onClick={() => setStep(i)}><span>{stages[i].letter}</span>{t(e[0], e[1])}</button>)}</div><div className="ksda-demo-content" aria-live="polite"><span className="ksda-kicker">{String(step + 1).padStart(2,"0")} / 04</span><h3>{t(example[2], example[3])}</h3><p>{t(example[4], example[5])}</p><div className="ksda-demo-review"><b>{t("Then review privately", "Kemudian, buat ulasan secara peribadi")}</b><p>{t("What became clearer? What would you ask differently next time?", "Apakah yang menjadi lebih jelas? Bagaimanakah anda akan bertanya dengan cara berbeza pada masa hadapan?")}</p></div></div></div>
    </section>

    <section className="ksda-section ksda-surface"><div className="ksda-container"><div className="ksda-section-heading"><div><p className="ksda-kicker">{unavailable ? t("Free programmes", "Program percuma") : t(`${freeCourses.length} free ${freeCourses.length === 1 ? "programme" : "programmes"}`, `${freeCourses.length} program percuma`)}</p><h2>{t("Different subjects.", "Subjek yang berbeza.")} <em>{t("One method.", "Satu kaedah.")}</em></h2></div><p>{t("Start with topic notes, reflection questions and a useful next step. Mark topics complete as you go and resume from your saved progress.", "Mulakan dengan nota topik, soalan refleksi dan langkah seterusnya yang berguna. Tandakan topik selesai sepanjang pembelajaran dan sambung berdasarkan kemajuan yang disimpan.")}</p></div><ProgrammeCards courses={freeCourses} unavailable={unavailable} compact /></div></section>

    <section className="ksda-section ksda-container"><div className="ksda-section-heading"><div><p className="ksda-kicker">{t("Your learning journey", "Perjalanan pembelajaran anda")}</p><h2>{t("Small missions.", "Misi yang ringkas.")} <em>{t("Useful practice.", "Latihan yang berguna.")}</em></h2></div><p>{t("Choose a programme, verify your email and work through the topics. Completion saves your self-study progress. Your choices and notes stay on the page and are not sent to the server.", "Pilih program, sahkan e-mel dan ikuti topik. Penyelesaian menyimpan kemajuan pembelajaran kendiri anda. Pilihan dan nota kekal pada halaman dan tidak dihantar ke pelayan.")}</p></div><ol className="ksda-workflow"><li><b>01</b><h3>{t("Choose", "Pilih")}</h3><p>{t("Start with an outcome relevant to your life.", "Mulakan dengan hasil yang berkaitan dengan kehidupan anda.")}</p></li><li><b>02</b><h3>{t("Practise", "Berlatih")}</h3><p>{t("Work through knowledge, decisions and barriers.", "Teliti pengetahuan, keputusan dan halangan.")}</p></li><li><b>03</b><h3>{t("Apply", "Amalkan")}</h3><p>{t("Complete a safe task or equivalent simulation.", "Lengkapkan tugasan selamat atau simulasi setara.")}</p></li><li><b>04</b><h3>{t("Review", "Semak")}</h3><p>{t("Reflect privately and prepare your next attempt.", "Buat refleksi peribadi dan sediakan percubaan seterusnya.")}</p></li></ol></section>


    <section className="ksda-section ksda-container ksda-faq"><p className="ksda-kicker">{t("Before you begin", "Sebelum anda bermula")}</p><h2>{t("Plain answers.", "Jawapan yang jelas.")}</h2>{faqs.map(([q, qm, a, am]) => <details key={q}><summary>{t(q, qm)}<span aria-hidden="true">+</span></summary><p>{t(a, am)}</p></details>)}</section>
    <section className="ksda-final ksda-container"><h2>{t("Choose one programme.", "Pilih satu program.")}<br /><em>{t("Make the next step useful.", "Jadikan langkah seterusnya berguna.")}</em></h2><Link className="ksda-button" href="/learn/free">{t("Explore free programmes", "Teroka program percuma")} <span aria-hidden="true">↗</span></Link></section>
  </main>;
}

export function Catalogue({ courses, unavailable }: { courses: Course[]; unavailable: boolean }) {
  const t = useLocale();
  const freeCourses = courses.filter(course => course.access_type === "free");
  return <main className="ksda-main ksda-container ksda-catalogue" data-no-translate><p className="ksda-kicker">{brand.name} · {t("Free awareness learning", "Pembelajaran kesedaran percuma")}</p><h1>{t("Choose what matters", "Pilih perkara yang penting")}<br /><em>{t("to you.", "kepada anda.")}</em></h1><p className="ksda-lead">{t("Explore programmes built around knowledge, practice, personal relevance and action. Start with the outcome you want to work towards.", "Teroka program yang direka berasaskan pengetahuan, latihan, kaitan peribadi dan tindakan. Mulakan dengan hasil yang ingin anda usahakan.")}</p><div className="ksda-notice" role="note"><b>{t("How to begin", "Cara bermula")}</b><p>{t("Sign in with a six-digit email code. Read the short notes, consider the reflection questions and mark each topic complete to save your progress.", "Log masuk dengan kod e-mel enam digit. Baca nota ringkas, fikirkan soalan refleksi dan tandakan setiap topik selesai untuk menyimpan kemajuan anda.")}</p></div><ProgrammeCards courses={freeCourses} unavailable={unavailable} /><div className="ksda-catalogue-close"><p>{t("These are self-paced awareness programmes, not accredited qualifications. Completion is self-reported.", "Ini ialah program kesedaran mengikut kadar sendiri, bukan kelayakan bertauliah. Penyelesaian disahkan sendiri oleh pelajar.")}</p><Link href="/learn">{t("Explore the KSDA method", "Teroka kaedah KSDA")} →</Link></div></main>;
}

export function AccessUnavailable({ slug }: { slug?: string }) {
  const t = useLocale();
  const p = programmes.find((p) => p.slug === slug);
  return <main className="ksda-main ksda-container ksda-access" data-no-translate><p className="ksda-kicker">{brand.name}</p><h1>{t("Learning access", "Akses pembelajaran")}<br /><em>{t("is being prepared.", "sedang disediakan.")}</em></h1>{p && <h2>{t(p.title, p.titleMs)}</h2>}<p className="ksda-lead">{t("You can explore the programme catalogue now. Lessons will open after content review and secure email sign-in are ready.", "Anda boleh meneroka katalog program sekarang. Pelajaran akan dibuka selepas semakan kandungan dan log masuk e-mel yang selamat tersedia.")}</p><p>{t("No learner account is created on this page.", "Tiada akaun pelajar diwujudkan pada halaman ini.")}</p><div className="ksda-actions"><Link className="ksda-button" href="/learn/free">{t("Back to free programmes", "Kembali ke program percuma")}</Link>{brand.supportEmail && <a className="ksda-text-link" href={`mailto:${brand.supportEmail}`}>{t("Contact support", "Hubungi bantuan")}</a>}</div></main>;
}
