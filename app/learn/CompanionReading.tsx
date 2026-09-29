"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { videoLink, canvaVideoEmbed } from "./video-links";
import type { Copy, EditorialPhoto, ReadingMission, ReviewEnvelope, ReadingProgress, ReviewOrigin } from "../reading-review/model";
export function MissionReading({mission,envelope,locale,embedded=false,apiPath="/learn/api/reading?scope=learner",completion}:{mission:ReadingMission;envelope:ReviewEnvelope;locale:"en"|"ms";embedded?:boolean;apiPath?:string;completion?:{completed:boolean;busy:boolean;onComplete:()=>void;nextHref:string;error:string;preview:boolean}}) {
 const safeVideoLink=videoLink(mission.video_link), safeVideoEmbed=canvaVideoEmbed(safeVideoLink);
 const t=(a:string,b:string)=>locale==="ms"?b:a; const c=(copy:Copy)=>copy[locale];
 const initial=envelope.progress ?? {reviewed:{},last_block_id:null,updated_at:null};
 const [progress,setProgress]=useState<ReadingProgress>(initial),[saveState,setSaveState]=useState<"saved"|"saving"|"failed">("saved");
 const pending=useRef<Record<string,ReviewOrigin>>({}), last=useRef<string|null>(initial.last_block_id),saving=useRef(false), mounted=useRef(true),saved=useRef(initial.reviewed);
 const [dirty,setDirty]=useState(0),[answers,setAnswers]=useState<Record<string,number>>({}),[check,setCheck]=useState<string|null>(null),[notes,setNotes]=useState(""),[noteStatus,setNoteStatus]=useState("");
 const [considered,setConsidered]=useState<Record<string,boolean>>({}),[declaration,setDeclaration]=useState(false),[demoComplete,setDemoComplete]=useState(false);
 const blockIds=mission.sections.flatMap(s=>s.block_ids); const total=blockIds.length;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const mark=useCallback((ids:string[],origin:ReviewOrigin)=>{
  const updates:Record<string,ReviewOrigin>={};
  ids.forEach(id=>{if(!saved.current[id]&&!pending.current[id]) updates[id]=origin;});
  if(!Object.keys(updates).length)return;
  Object.assign(pending.current,updates);last.current=ids.at(-1)??null;
  setProgress(p=>({...p,reviewed:{...p.reviewed,...updates},last_block_id:last.current}));setSaveState("saving");setDirty(x=>x+1);
 },[]);
 const save=useCallback(async()=>{
  if(saving.current||!Object.keys(pending.current).length)return;
  const sent={...pending.current};saving.current=true;setSaveState("saving");
  try {
   const response=await fetch(apiPath,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({release:envelope.release_id,mission:mission.mission_id,revision:envelope.revision_hash,reviewed:sent,last:last.current})});
   if(!response.ok)throw new Error("SAVE_FAILED");
   const result=await response.json() as ReadingProgress;
   for(const [key,val]of Object.entries(sent))if(pending.current[key]===val)delete pending.current[key];
   saved.current={...saved.current,...result.reviewed};
   if(mounted.current){setProgress({...result,reviewed:{...saved.current,...pending.current}});setSaveState(Object.keys(pending.current).length?"saving":"saved");if(Object.keys(pending.current).length)setDirty(x=>x+1);}
  }catch{if(mounted.current)setSaveState("failed");}finally{saving.current=false;}
 },[apiPath,envelope.release_id,envelope.revision_hash,mission.mission_id]);
 useEffect(()=>{if(!dirty)return;const id=setTimeout(()=>void save(),Object.values(pending.current).includes("self_confirmed")?0:650);return()=>clearTimeout(id);},[dirty,save]);
 useEffect(()=>{
  const timers=new Map<Element,{timer:ReturnType<typeof setTimeout>;phase:string}>();
  const covered=new Map<Element,Set<string>>();
  const elements=[...document.querySelectorAll<HTMLElement>("[data-reading-block]")];
  function cancel(el:Element){const value=timers.get(el);if(value)clearTimeout(value.timer);timers.delete(el);}
  function region(el:HTMLElement){
   const r=el.getBoundingClientRect();
   const vertical=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
   const horizontal=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));
   if(document.visibilityState!=="visible"||r.height<=0||r.width<=0||vertical/Math.min(r.height,innerHeight)<.6||horizontal/Math.min(r.width,innerWidth)<.6)return null;
   if(r.height<=innerHeight)return "whole";
   // Tall/zoomed paragraphs require dwell at both ends, never a middle glimpse.
   if(r.top>=-16 && r.top<=innerHeight*.4)return "start";
   if(r.bottom<=innerHeight+16 && r.bottom>=innerHeight*.6)return "end";
   return null;
  }
  function checkVisibility(){elements.forEach(el=>{
   const id=el.dataset.readingBlock!;const phase=region(el);
   if(!phase||saved.current[id]||pending.current[id]){cancel(el);return;}
   if(timers.get(el)?.phase!==phase)cancel(el);
   if(!timers.has(el))timers.set(el,{phase,timer:setTimeout(()=>{
    timers.delete(el);if(region(el)!==phase)return;
    const seen=covered.get(el)??new Set<string>();seen.add(phase);covered.set(el,seen);
    if(phase==="whole"||(seen.has("start")&&seen.has("end")))mark([id],"viewport_dwell");
   },3000)});
  });}
  const changedLayout=()=>{timers.forEach((_,el)=>cancel(el));covered.clear();checkVisibility();};
  const observer=new ResizeObserver(changedLayout);elements.forEach(el=>observer.observe(el));
  const photos=[...document.querySelectorAll<HTMLImageElement>(".reading-photo img")];
  photos.forEach(img=>img.addEventListener("load",changedLayout));
  const onVisibility=()=>{timers.forEach((_,el)=>cancel(el));checkVisibility();};
  window.addEventListener("scroll",checkVisibility,{passive:true});window.addEventListener("resize",changedLayout);document.addEventListener("visibilitychange",onVisibility);checkVisibility();
  return()=>{photos.forEach(img=>img.removeEventListener("load",changedLayout));observer.disconnect();timers.forEach(v=>clearTimeout(v.timer));window.removeEventListener("scroll",checkVisibility);window.removeEventListener("resize",changedLayout);document.removeEventListener("visibilitychange",onVisibility);};
 },[mission.mission_id,locale,mark]);
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{if(saving.current||Object.keys(pending.current).length){event.preventDefault();event.returnValue="";}};
  window.addEventListener("beforeunload",warn);
  return()=>window.removeEventListener("beforeunload",warn);
 },[]);
 const asset=(id:string)=>`${apiPath}${apiPath.includes("?")?"&":"?"}${new URLSearchParams({release:envelope.release_id,asset:id,lang:locale})}`;
 const photo=(p:EditorialPhoto,lazy=false)=><figure className="reading-figure reading-photo"><img src={asset(p.asset_id)} alt={c(p.alt)} width={p.width} height={p.height} loading={lazy?"lazy":"eager"}/><figcaption>{c(p.caption)}</figcaption></figure>;
 const ready=mission.questions.every(q=>answers[q.id]!==undefined)&&declaration;
 const reviewed=Object.keys(progress.reviewed).filter(id=>blockIds.includes(id)).length;
 return <div className="reading-review-layout"><article className="reading-review-story">
  {!embedded&&<><header><p className="reading-eyebrow">{mission.course_key} · {mission.mission_id}</p><h1>{c(mission.title)}</h1></header>
  <section className="reading-video"><h2>{t("Mission video","Video misi")}</h2>{safeVideoEmbed?<><div className="reading-video-frame"><iframe src={safeVideoEmbed} title={c(mission.title)} loading="lazy" allow="fullscreen" allowFullScreen/></div><a href={safeVideoLink!} target="_blank" rel="noopener noreferrer">{t("Open on Canva ↗","Buka di Canva ↗")}</a></>:<p>{t("Video is not yet available. You can use the complete reading below.","Video belum tersedia. Anda boleh menggunakan bacaan lengkap di bawah.")}</p>}<p>{t("Watching is optional. Opening or playing the video is not recorded as proof that you watched it.","Tontonan adalah pilihan. Membuka atau memainkan video tidak direkodkan sebagai bukti bahawa anda telah menontonnya.")}</p></section></>}
  {mission.editorial_photos&&photo(mission.editorial_photos.opening)}<p className="reading-lead">{c(mission.bridge)}</p>{!mission.editorial_photos&&<figure className="reading-figure"><img src={asset(mission.opening_asset_id)} alt={c(mission.opening_alt)} width={mission.opening_width} height={mission.opening_height}/><figcaption><ol>{mission.opening_nodes.map((node,i)=><li key={i}>{c(node)}</li>)}</ol>{c(mission.opening_caption)}</figcaption></figure>}
  {mission.sections.map(s=><Fragment key={s.id}><section className="reading-section" id={s.id}><p className="reading-stage">{s.ksda_stage} · {locale==="en"?({knowledge:"Knowledge",practice:"Skill",review:"Desire",action:"Action"}[s.type]??s.type):({knowledge:"Pengetahuan",practice:"Kemahiran",review:"Keinginan",action:"Tindakan"}[s.type]??s.type)}</p><h2>{c(s.title)}</h2>{s.paragraphs.map((paragraph,i)=><div key={s.block_ids[i]} id={s.block_ids[i]} className="reading-block" data-reading-block={s.block_ids[i]}><p>{c(paragraph)}</p></div>)}{!mission.editorial_photos&&<figure className="reading-figure"><img src={asset(s.asset_id)} alt={c(s.diagram.alt)} width={s.asset_width} height={s.asset_height} loading="lazy"/><figcaption><ol>{s.diagram.nodes.map((node,i)=><li key={i}>{c(node)}</li>)}</ol>{c(s.diagram.caption)}</figcaption></figure>}<div className="reading-section-actions"><button type="button" disabled={s.block_ids.every(id=>Boolean(progress.reviewed[id]))} onClick={()=>mark(s.block_ids,"self_confirmed")}>{s.block_ids.every(id=>Boolean(progress.reviewed[id]))?t("Section reviewed","Bahagian telah disemak"):t("Mark this section reviewed","Tandakan bahagian ini telah disemak")}</button>{["practice","action","review"].includes(s.type)&&<label><input type="checkbox" checked={considered[s.id]??false} onChange={e=>setConsidered(v=>({...v,[s.id]:e.target.checked}))}/>{t("I have considered this example (optional)","Saya telah mempertimbangkan contoh ini (pilihan)")}</label>}</div></section>{mission.editorial_photos?.closer.after_section===s.id&&photo(mission.editorial_photos.closer,true)}</Fragment>)}
  {mission.pilot_spoken_prompt&&<aside className="reading-spoken"><h2>{t("Try the words, if you wish","Cuba sebut, jika anda mahu")}</h2><p>{c(mission.pilot_spoken_prompt)}</p><small>{t("You may say it aloud, read it silently or skip it. Nothing is recorded.","Anda boleh menyebutnya, membacanya dalam hati atau melangkaunya. Tiada rakaman dibuat.")}</small></aside>}
  <section className="reading-section"><h2>{t("Check your understanding","Semak kefahaman anda")}</h2><p>{t("Try an answer, read the explanation and try again if useful. This check has no pass mark and does not control completion.","Cuba pilih jawapan, baca penjelasan dan cuba lagi jika berguna. Semakan ini tidak mempunyai markah lulus dan tidak menentukan penyelesaian.")}</p><fieldset><legend>{c(mission.knowledge_check.prompt)}</legend>{mission.knowledge_check.options.map(o=><label className="reading-option" key={o.id}><input type="radio" name={mission.knowledge_check.id} checked={check===o.id} onChange={()=>setCheck(o.id)}/><span>{c(o.text)}</span></label>)}</fieldset>{check&&<p role="status" className="reading-feedback">{c(mission.knowledge_check.options.find(o=>o.id===check)!.rationale)}</p>}</section>
  <section className="reading-section"><h2>{t("Pause and consider","Berhenti seketika dan fikirkan")}</h2><p>{t("Choose what fits your situation. Reflection choices have no score and are not saved.","Pilih jawapan yang sesuai dengan keadaan anda. Pilihan refleksi tidak diberi markah dan tidak disimpan.")}</p>{mission.questions.map(q=><fieldset key={q.id}><legend>{locale==="ms"?q.promptMs:q.prompt}</legend>{q.options.map((option,i)=><label className="reading-option" key={i}><input type="radio" name={q.id} checked={answers[q.id]===i} onChange={()=>setAnswers(a=>({...a,[q.id]:i}))}/><span>{locale==="ms"?q.optionsMs[i]:option}</span></label>)}{answers[q.id]!==undefined&&<p className="reading-feedback" role="status">{c(mission.reflection_feedback.find(f=>f.question_id===q.id)!.options[answers[q.id]])}</p>}</fieldset>)}</section>
  <section className="reading-section"><h2>{t("Your temporary private notes","Nota peribadi sementara anda")}</h2><label htmlFor="reading-notes">{c(mission.notes_prompt)}</label><textarea id="reading-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={5} maxLength={3000} aria-describedby="reading-notes-privacy"/><p id="reading-notes-privacy">{t("Optional, up to 3,000 characters. Notes and answers stay on this page only; leaving or refreshing clears them. They are not sent to the site operator or saved in the database. Avoid names, addresses, health details, passwords or other sensitive information.","Pilihan, sehingga 3,000 aksara. Nota dan jawapan kekal pada halaman ini sahaja; ia hilang apabila anda keluar atau memuat semula. Ia tidak dihantar kepada pengendali laman atau disimpan dalam pangkalan data. Elakkan nama, alamat, butiran kesihatan, kata laluan atau maklumat sensitif lain.")}</p><div className="reading-buttons"><button onClick={async()=>{try{await navigator.clipboard.writeText(notes);setNoteStatus(t("Copied to your clipboard.","Disalin ke papan klip anda."));}catch{setNoteStatus(t("Copy was unavailable. Select and copy the notes manually.","Salinan tidak tersedia. Pilih dan salin nota secara manual."));}}}>{t("Copy notes","Salin nota")}</button><button onClick={()=>{setNotes("");setNoteStatus(t("Notes cleared.","Nota dikosongkan."));}}>{t("Clear notes","Kosongkan nota")}</button></div><p role="status">{noteStatus}</p></section>
  {completion?<section className="reading-section reading-completion"><h2>{t(completion.preview?"Test this mission’s completion":"Finish this topic",completion.preview?"Uji penyelesaian misi ini":"Selesaikan topik ini")}</h2>{completion.completed?<><p role="status">{t(completion.preview?"Test mission complete. Only the isolated acceptance record was saved.":"Topic complete. Your progress is saved.",completion.preview?"Misi ujian selesai. Hanya rekod penerimaan berasingan disimpan.":"Topik selesai. Kemajuan anda telah disimpan.")}</p><a href={completion.nextHref}>{t("Continue to the next topic","Teruskan ke topik seterusnya")}</a></>:<><label className="reading-option"><input type="checkbox" checked={declaration} onChange={e=>setDeclaration(e.target.checked)}/><span>{c(mission.declaration)}</span></label><button disabled={!ready||completion.busy} onClick={completion.onComplete}>{completion.busy?t("Saving…","Menyimpan…"):t(completion.preview?"Test completion":"Mark complete",completion.preview?"Uji penyelesaian":"Tandakan selesai")}</button></>}<p>{t("The required reflections and the declaration are required. Reading coverage, the optional knowledge check, video and ebook purchase do not add a completion requirement.","Refleksi yang diperlukan dan pengakuan diperlukan. Liputan bacaan, semakan kefahaman pilihan, video dan pembelian ebook tidak menambah syarat penyelesaian.")}</p>{completion.error&&<p role="alert">{completion.error}</p>}</section>:<>
  <section className="reading-section"><h2>{t("Completion interaction preview","Pratonton interaksi penyelesaian")}</h2><label className="reading-option"><input type="checkbox" checked={declaration} onChange={e=>setDeclaration(e.target.checked)}/><span>{c(mission.declaration)}</span></label><button disabled={!ready||demoComplete} onClick={()=>setDemoComplete(true)}>{t("Test completion interaction","Uji interaksi penyelesaian")}</button><p role="status">{demoComplete?t("Preview interaction complete. No course completion was written.","Interaksi pratonton selesai. Tiada penyelesaian kursus direkodkan."):t("The required reflections and the declaration are required. Reading percentage and the knowledge check do not add a new completion requirement.","Refleksi yang diperlukan dan pengakuan diperlukan. Peratus bacaan serta semakan kefahaman tidak menambah syarat penyelesaian baharu.")}</p></section>
  </>}
  {!embedded&&<aside className="reading-optional"><h2>{t("Optional extra reference","Rujukan tambahan secara pilihan")}</h2><p>{t("Additional learning resources, when offered by your provider, are optional. This mission’s reading and completion are available without buying them.","Sumber pembelajaran tambahan, apabila ditawarkan oleh penyedia anda, adalah pilihan. Bacaan dan penyelesaian misi ini tersedia tanpa membelinya.")}</p></aside>}
 </article><aside className="reading-progress-panel"><h2>{t("Reading reviewed","Bacaan disemak")}</h2><p className="reading-percentage">{Math.round(reviewed/total*100)}%</p><progress max={total} value={reviewed} aria-label={t("Reading reviewed estimate","Anggaran bacaan disemak")}/><p>{t(`${reviewed} of ${total} reading blocks reviewed.`,`${reviewed} daripada ${total} blok bacaan disemak.`)}</p><details><summary>{t("How this estimate works","Cara anggaran ini dibuat")}</summary><p>{t("This is an approximate coverage marker, not proof of understanding or course completion. A block is marked after at least 60% is visible for 3 continuous seconds. Taller blocks require the start and end to be reviewed. You can also use the manual review button.","Ini ialah anggaran liputan bacaan, bukan bukti kefahaman atau penyelesaian kursus. Blok ditandakan selepas sekurang-kurangnya 60% kelihatan selama 3 saat berterusan. Blok yang lebih panjang memerlukan semakan pada awal dan akhir. Anda juga boleh menggunakan butang semakan manual.")}</p></details><p role="status" className={`reading-save-${saveState}`}>{saveState==="saved"?(reviewed?t(envelope.progress_scope==="learner"?"Saved to your reading record.":"Saved to your isolated preview reading record.",envelope.progress_scope==="learner"?"Disimpan dalam rekod bacaan anda.":"Disimpan dalam rekod bacaan pratonton berasingan anda."):t("No reading markers saved yet.","Belum ada penanda bacaan disimpan.")):saveState==="saving"?t("Saving reading markers…","Menyimpan penanda bacaan…"):t("Not saved. Your changes are still on this page. Retry while you remain here.","Belum disimpan. Perubahan anda masih pada halaman ini. Cuba lagi sebelum keluar.")}</p>{saveState==="failed"&&<button onClick={()=>void save()}>{t("Retry save","Cuba simpan semula")}</button>}{progress.last_block_id&&<a href={`#${progress.last_block_id}`}>{t("Return to last reviewed block","Kembali ke blok terakhir yang disemak")}</a>}<nav aria-label={t("Reading sections","Bahagian bacaan")}><ol>{mission.sections.map(s=><li key={s.id}><a href={`#${s.id}`}>{c(s.title)}</a></li>)}</ol></nav></aside></div>;
}
