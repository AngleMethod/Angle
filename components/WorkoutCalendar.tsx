'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dateInZone, type WorkoutCompletion } from '@/lib/workoutHistory';
import styles from './WorkoutCalendar.module.css';

export default function WorkoutCalendar({ userId, coach = false }: {userId: string; coach?: boolean}) {
  return <Calendar key={userId} userId={userId} coach={coach} />;
}
function Calendar({userId,coach}:{userId:string;coach:boolean}) {
  const [month,setMonth] = useState('');
  const [today,setToday] = useState('');
  const [selected,setSelected] = useState('');
  const [rows,setRows] = useState<WorkoutCompletion[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v=>v+1),[]);
  useEffect(()=>{
    const date = dateInZone(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(date); setMonth(date.slice(0,7)); setSelected(date);
    window.addEventListener('angle:workout-completed',refresh);
    window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('angle:workout-completed',refresh);window.removeEventListener('focus',refresh);};
  },[refresh]);
  useEffect(()=>{
    if (!month) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(''); setRows([]);
      try {
        const {data:{session}} = await supabase.auth.getSession();
        if (!session) throw new Error('Please sign in again to view workout history.');
        const res = await fetch(`/api/workout-history?month=${month}&userId=${encodeURIComponent(userId)}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store',signal:controller.signal});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load workout history.');
        if (!controller.signal.aborted) setRows(data.completions);
      } catch(e) {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load workout history.');}
      finally {if (!controller.signal.aborted) setLoading(false);}
    }
    void load(); return ()=>controller.abort();
  },[month,userId,revision]);
  const [year,m] = (month || '2026-01').split('-').map(Number);
  const monthDate = new Date(year,m-1,1);
  const days = new Date(year,m,0).getDate();
  const offset = (monthDate.getDay()+6)%7;
  const selectedRows = rows.filter(r=>r.completed_date===selected);
  function changeMonth(delta:number) {
    const date = new Date(year,m-1+delta,1);
    const value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    setMonth(value);setSelected(value===today.slice(0,7)?today:`${value}-01`);
  }
  return <section className={styles.calendar} aria-label="Workout completion calendar">
    <details className={styles.disclosure}>
    <summary className={styles.header}><div><p className={styles.eyebrow}>Consistency, one session at a time</p><h2>Workout tracker</h2><p>{coach ? 'Your student’s completed sessions.' : 'Finish a session to add a checkmark to your calendar.'}</p></div><svg className={styles.chevron} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg></summary>
    <div className={styles.navigation}><button onClick={()=>changeMonth(-1)} disabled={!month || year<=2020 && m===1} aria-label="Previous month"><Arrow back /></button><h3>{month ? monthDate.toLocaleDateString(undefined,{month:'long',year:'numeric'}) : 'Loading calendar…'}</h3><button onClick={()=>changeMonth(1)} disabled={!month || month>=today.slice(0,7)} aria-label="Next month"><Arrow /></button></div>
    {error ? <div role="alert" className={styles.message}>{error} <button onClick={refresh}>Retry</button></div> : loading ? <p role="status" className={styles.message}>Loading workout history…</p> : <>
      <div className={styles.stats}><span><strong>{rows.length}</strong> sessions this month</span><span><strong>{new Set(rows.map(r=>r.completed_date)).size}</strong> days trained</span></div>
      <div className={styles.grid}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span className={styles.weekday} key={d}>{d}</span>)}
        {Array.from({length:offset},(_,i)=><span key={`blank-${i}`} />)}
        {Array.from({length:days},(_,i)=>{
          const date=`${month}-${String(i+1).padStart(2,'0')}`;
          const count=rows.filter(r=>r.completed_date===date).length;
          return <button key={date} className={`${styles.day} ${count ? styles.done : ''} ${selected===date ? styles.selected : ''}`} onClick={()=>setSelected(date)} aria-pressed={selected===date} aria-current={date===today?'date':undefined} aria-label={`${date}: ${count} completed sessions`}>
            <span>{i+1}</span>{count>0 && <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>}{count>1 && <small>{count}</small>}
          </button>;
        })}
      </div>
      <div className={styles.details} aria-live="polite"><h3>{selected ? new Date(`${selected}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : ''}</h3>
        {selectedRows.length ? <ul>{selectedRows.map(row=><li key={row.session_id}><strong>{row.workout_name}</strong><span>{row.completed_exercises} of {row.total_exercises} exercises · {row.completed_exercises===row.total_exercises ? 'Completed' : 'Finished with some exercises unchecked'}</span></li>)}</ul> : <p>No completed sessions recorded for this date.</p>}
      </div>
    </>}
    </details>
  </section>;
}
function Arrow({back=false}:{back?:boolean}) {return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{transform:back?'rotate(180deg)':undefined}}><path d="m9 5 7 7-7 7" /></svg>;}
