"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { certificateDate, certificateNumber, certificateSkills, certificateSkillLines, type Certificate } from '@/lib/certificates';
import s from './CertificateCollection.module.css';

export default function CertificateCollection({userId,coach=false,memberEmail='',readOnly=false}:{userId:string;coach?:boolean;memberEmail?:string;readOnly?:boolean}) {
  return <Collection key={userId} userId={userId} coach={coach} memberEmail={memberEmail} readOnly={readOnly} />;
}
async function request(url:string,options:RequestInit={}) {
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) throw new Error('Please sign in again.');
  const res=await fetch(url,{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...options.headers}});
  if(!res.ok) {const body=await res.json().catch(()=>({}));throw new Error(body.error||'Please try again.');}
  return res;
}
function CaneIcon({small=false}:{small?:boolean}) {
  return <svg className={small?s.smallMedal:s.medal} viewBox="0 0 100 100" fill="none" aria-hidden="true"><g strokeLinejoin="round" strokeLinecap="round"><path d="M32 23 43 17H69L58 23H32v7h26l11-6v-7M58 23v7"/><path d="M48 30v48h4V30"/><path d="M24 82 39 76h9m4 0h24l-15 6H24v5h37l15-6v-5M61 82v5"/></g></svg>;
}
export function CertificateFace({name,skill,date,id}:{name:string;skill:string;date:string;id:string}) {
  return <div className={s.face} role="img" aria-label={`${name}, ${skill}, awarded ${certificateDate(date)}`}>
    {/* The preserved original artwork includes Josh's signature, logo, and outline cane. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/certificates/v1/master.svg" alt="" />
    <span className={s.faceName} style={{fontSize:`${Math.min(5,115/Math.max(name.length,1))}cqw`}}>{name}</span>
    <span className={s.faceSkill} style={{fontSize:`${Math.min(4.17,115/Math.max(...certificateSkillLines(skill).map(line=>line.length),1))}cqw`}}>{certificateSkillLines(skill).map((line,index)=><span key={index}>{line}</span>)}</span>
    <span className={s.faceDate}>{certificateDate(date)}</span><span className={s.faceNumber}>CERTIFICATE NO. {certificateNumber(id)}</span>
  </div>;
}
function Modal({children,onClose,label}:{children:ReactNode;onClose:()=>void;label:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className={s.dialog} onCancel={onClose} onClose={onClose} aria-label={label}><button className={s.close} onClick={onClose} aria-label="Close certificate">×</button>{children}</dialog>;
}
function Collection({userId,coach,memberEmail,readOnly}:{userId:string;coach:boolean;memberEmail:string;readOnly:boolean}) {
  const [rows,setRows]=useState<Certificate[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [revision,setRevision]=useState(0),[adding,setAdding]=useState(false),[name,setName]=useState(''),[skill,setSkill]=useState('');
  const [busy,setBusy]=useState(''),[notice,setNotice]=useState('');
  const [view,setView]=useState<{cert:Certificate;url?:string;celebrate:boolean;preview?:boolean}|null>(null);
  const awardId=useRef(''),pending=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    const abort=new AbortController();
    setLoading(true);setError('');
    request(`/api/certificates?userId=${encodeURIComponent(userId)}`,{signal:abort.signal}).then(res=>res.json()).then(data=>{if(!abort.signal.aborted)setRows(data.certificates);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[userId,revision]);
  useEffect(()=>{const url=view?.url;return()=>{if(url)URL.revokeObjectURL(url);};},[view?.url]);
  function updateRow(cert:Certificate) {setRows(prev=>[cert,...prev.filter(row=>row.id!==cert.id)].sort((a,b)=>b.awarded_at.localeCompare(a.awarded_at)));}
  async function openCertificate(cert:Certificate) {
    setView({cert,celebrate:!coach&&!cert.seen_at});
    if(!coach&&!readOnly&&!cert.seen_at) {
      try {await request('/api/certificates',{method:'PATCH',body:JSON.stringify({id:cert.id})});if(mounted.current)updateRow({...cert,seen_at:new Date().toISOString()});} catch { /* Retain the new badge if acknowledging fails. */ }
    }
  }
  async function download(cert:Certificate) {
    if(pending.current)return;pending.current=true;setBusy(cert.id);setError('');
    try {
      const response=await request(`/api/certificates/${cert.id}/pdf`);
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement('a');link.href=url;link.download=`Angle-${certificateNumber(cert.id)}.pdf`;document.body.append(link);link.click();link.remove();
      // Give the browser time to start saving before releasing the object URL.
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(e) {setError(e instanceof Error?e.message:'Could not download certificate.');}
    finally {pending.current=false;if(mounted.current)setBusy('');}
  }
  async function preview() {
    if(pending.current)return;pending.current=true;setBusy('preview');setError('');
    try {
      const res=await request('/api/admin/certificates/preview',{method:'POST',body:JSON.stringify({name,skill})});
      const url=URL.createObjectURL(await res.blob());
      const now=new Date();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
      if(mounted.current)setView({url,preview:true,celebrate:false,cert:{id:'00000000-0000-4000-8000-000000000000',recipient_name:name.trim(),skill:skill.trim(),award_date:date,awarded_at:now.toISOString(),seen_at:null,email_status:'pending',email_sent_at:null}});
      else URL.revokeObjectURL(url);
    } catch(e) {setError(e instanceof Error?e.message:'Could not preview certificate.');}
    finally {pending.current=false;if(mounted.current)setBusy('');}
  }
  async function award() {
    if(pending.current)return;pending.current=true;setBusy('award');setError('');setNotice('');
    awardId.current ||= crypto.randomUUID();
    try {
      const res=await request('/api/admin/certificates',{method:'POST',body:JSON.stringify({id:awardId.current,userId,name,skill})});
      const {certificate}=await res.json();
      if(mounted.current){updateRow(certificate);setAdding(false);setSkill('');awardId.current='';setNotice(certificate.email_status==='sent'?'Certificate awarded. The PDF email has been sent.':'Certificate awarded and saved. Email needs attention below.');setView({cert:certificate,celebrate:true});}
    } catch(e) {setError(e instanceof Error?e.message:'Could not award certificate.');}
    finally {pending.current=false;if(mounted.current)setBusy('');}
  }
  async function retry(cert:Certificate) {
    if(pending.current)return;pending.current=true;setBusy(cert.id);setError('');
    try {const res=await request('/api/admin/certificates',{method:'PATCH',body:JSON.stringify({id:cert.id})});const {certificate}=await res.json();if(mounted.current){updateRow(certificate);setNotice(certificate.email_status==='sent'?'The PDF email has been sent.':'Email is not confirmed yet. You can retry shortly.');}}
    catch(e){setError(e instanceof Error?e.message:'Could not retry email.');}
    finally{pending.current=false;if(mounted.current)setBusy('');}
  }
  return <section id="certificates" className={s.collection} aria-labelledby="mastery-title">
    <details className={s.disclosure} open={coach || undefined}>
    <summary className={s.header}><div><p className={s.eyebrow}>Collect them all!</p><h2 id="mastery-title">Certificates of<br/><em>Handstand Mastery</em></h2><p>{coach?'Celebrate a breakthrough. Award a skill they have earned.':'Keep grinding hard to earn more.'}</p></div><div className={s.counter}><CaneIcon small/><strong>{loading?'—':rows.length}</strong><span>{rows.length===1?'milestone unlocked':'milestones unlocked'}</span></div><svg className={s.chevron} aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6"/></svg></summary>
    {coach&&<div className={s.adminBar}><p>Awarded by you. Personalized for {memberEmail||'this member'}.</p><button className={s.primary} onClick={()=>{setAdding(!adding);setError('');}} disabled={!!busy}>{adding?'Close form':'+ Add certificate'}</button></div>}
    {adding&&<form className={s.form} onSubmit={e=>{e.preventDefault();void award();}}>
      <div className={s.formHeading}><h3>A moment worth recognizing</h3><p>Review the name and skill. Awarding adds it to this member’s dashboard and emails their PDF.</p></div>
      <label>Name on certificate<input required maxLength={80} value={name} onChange={e=>{setName(e.target.value);awardId.current='';}} placeholder="Member’s full name" disabled={!!busy}/></label>
      <label>Handstand skill unlocked<input required maxLength={100} list="mastery-skills" value={skill} onChange={e=>{setSkill(e.target.value);awardId.current='';}} placeholder="e.g. Candle One-Arm Handstand" disabled={!!busy}/><datalist id="mastery-skills">{certificateSkills.map(value=><option key={value} value={value}/>)}</datalist></label>
      <p className={s.dateNote}>Achievement date: the day you award it, set automatically in your Chicago time zone.</p>
      <div className={s.actions}><button type="button" className={s.secondary} disabled={!!busy||!name.trim()||!skill.trim()} onClick={()=>void preview()}>{busy==='preview'?'Preparing…':'Preview printable PDF'}</button><button className={s.primary} type="submit" disabled={!!busy||!name.trim()||!skill.trim()}>{busy==='award'?'Awarding & emailing…':'Award & email certificate'}</button></div>
    </form>}
    {error&&<p role="alert" className={s.error}>{error} <button onClick={()=>setRevision(v=>v+1)}>Refresh collection</button></p>}
    {notice&&<p role="status" className={s.notice}>{notice}</p>}
    {loading?<p role="status" className={s.loading}>Opening the collection…</p>:!error||rows.length>0?<>
      {rows.length>0?<div className={s.grid}>{rows.map((cert,index)=><article key={cert.id} className={s.card}>
        <div className={s.cardTop}><span>MASTERY / {String(rows.length-index).padStart(2,'0')}</span>{!cert.seen_at&&!coach?<span className={s.newBadge}>NEW UNLOCK</span>:<span>COACH VERIFIED</span>}</div>
        <button className={s.cardVisual} onClick={()=>void openCertificate(cert)} aria-label={`View ${cert.skill} certificate`}><CertificateFace name={cert.recipient_name} skill={cert.skill} date={cert.award_date} id={cert.id}/><span className={s.viewHint}>View your achievement <span aria-hidden="true">+</span></span></button>
        <div className={s.cardInfo}><h3>{cert.skill}</h3><p>{certificateDate(cert.award_date)}</p><div className={s.actions}><button className={s.secondary} onClick={()=>void openCertificate(cert)}>View certificate</button><button className={s.textButton} disabled={!!busy} onClick={()=>void download(cert)}>{busy===cert.id?'Preparing…':'Download PDF'}</button></div>
        {coach&&<div className={s.emailStatus}><span>{cert.email_status==='sent'?'PDF email sent':cert.email_status==='sending'?'Email sending / awaiting confirmation':'PDF email not sent'}</span>{cert.email_status!=='sent'&&<button disabled={!!busy} onClick={()=>void retry(cert)}>Retry email</button>}</div>}</div>
      </article>)}</div>:null}
    </>:null}
    <footer className={s.footer}><span>STRENGTH / BALANCE / CONTROL</span><span>Recognized by Josh Lee · Angle</span></footer>
    </details>
    {view&&<Modal onClose={()=>setView(null)} label={view.preview?'Certificate preview':`${view.cert.skill} certificate`}>
      <div className={view.celebrate?s.celebration:s.dialogHeading}>{view.celebrate&&<div className={s.confetti} aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{left:`${5+i*5}%`,animationDelay:`${i%6*.1}s`,transform:`rotate(${i*37}deg)`}}/>)}</div>}<CaneIcon small/><p className={s.eyebrow}>{view.preview?'Preview · not yet awarded':view.celebrate?'A new chapter, unlocked':'Your earned achievement'}</p><h3>{view.preview?'Ready to make it official?':'You earned this'}</h3><p>{view.cert.skill}</p></div>
      <CertificateFace name={view.cert.recipient_name} skill={view.cert.skill} date={view.cert.award_date} id={view.cert.id}/>
      <div className={s.dialogActions}>{view.preview?<><a href={view.url} target="_blank" rel="noopener noreferrer" className={s.secondary}>Open printable PDF</a><button className={s.primary} onClick={()=>setView(null)}>Back to award form</button></>:<><button className={s.primary} disabled={!!busy} onClick={()=>void download(view.cert)}>Download printable PDF</button><button className={s.secondary} onClick={()=>setView(null)}>Back to collection</button></>}</div>
      <p className={s.printNote}>{view.preview?'The final certificate gets its own number and the date you award it.':'A personal milestone. Print it, keep it, and celebrate how far you have come.'}</p>
      {error&&<p role="alert" className={s.error}>{error}</p>}
    </Modal>}
  </section>;
}
