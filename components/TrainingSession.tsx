'use client';

import headingStyles from './DashboardSectionHeading.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { splitTrainingDays, type TrainingBanner } from '@/lib/trainingDays';
import { supabase } from '@/lib/supabase';
import { UUID } from '@/lib/workoutHistory';
import { localTrainingDate, nextTrainingDayDelay } from '@/lib/dailyTraining';
import VideoPlayer from '@/components/VideoPlayer';
import styles from './TrainingSession.module.css';

type Step = { type?: 'video'; title: string; description: string; videoId?: string; sets?: string; repsOrHoldTime?: string; frequency?: string; section?: string; sectionTitle?: string; sectionDescription?: string };
type Item = Step | TrainingBanner;
type Video = { mux_playback_id: string; description: string | null };
type Session = { done: number[]; active: number | null; started: boolean; finished: boolean; id?: string };
type Props = { workout: Item[]; videos: Record<string, Video>; userId?: string; preview?: boolean };
const empty = (): Session => ({ done: [], active: null, started: false, finished: false });
const isBanner = (item: Item): item is TrainingBanner => item.type === 'banner' || ('text' in item && !('title' in item));
function frequency(step: Step) {
  const value = step.frequency?.trim() || step.sectionDescription?.trim() || step.sectionTitle?.trim() || (step.section === 'flexibility' ? 'Flexibility - 3x/week' : 'Handbalancing - 6x/week');
  return value === 'Handstand Practice - 6x/week' ? 'Handbalancing - 6x/week' : value;
}

// Remount on account or prescription changes so old checkmarks never attach to a new program.
export default function TrainingSession(props: Props) {
  const [sessionDate, setSessionDate] = useState('');
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;
    function refreshDay() {
      setSessionDate(localTrainingDate());
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(refreshDay, nextTrainingDayDelay());
    }
    function onVisibility() { if (document.visibilityState === 'visible') refreshDay(); }
    refreshDay();
    // Also catches clock/time-zone changes and devices waking after midnight.
    const clockTimer = setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    window.addEventListener('pageshow', refreshDay);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(midnightTimer);
      clearInterval(clockTimer);
      window.removeEventListener('focus', refreshDay);
      window.removeEventListener('pageshow', refreshDay);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const program = JSON.stringify(props.workout);
  const grouped = props.workout.some(item => isBanner(item) && item.separateDay === true);
  if (!grouped) return <SessionView key={`${props.userId ?? 'preview'}:${program}:${sessionDate}`} {...props} program={program} sessionDate={sessionDate} />;
  const days = splitTrainingDays(props.workout);
  return <div className={styles.days}>
    {days.length > 1 && <p className={styles.guidance}>Choose your training day.</p>}
    {days.map(day => <details className={styles.day} key={`${props.userId ?? 'preview'}:${day.key}:${program}`}>
      <summary className={styles.dayHeader}><span><span className={`${styles.dayTitle} ${headingStyles.heading}`}>{day.title}</span><span className={styles.dose}>{[day.frequency, `${day.items.filter(item => !isBanner(item)).length} exercises`].filter(Boolean).join(' · ')}</span></span><svg className={styles.dayChevron} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg></summary>
      <div className={styles.dayBody}><SessionView key={sessionDate} sessionDate={sessionDate} {...props} workout={day.items} program={JSON.stringify(day.items)} storageScope={day.key} dayTitle={day.title} /></div>
    </details>)}
  </div>;
}

function SessionView({ workout, videos, userId, preview = false, program, sessionDate, storageScope, dayTitle }: Props & { program: string; sessionDate: string; storageScope?: string; dayTitle?: string }) {
  const detailId = useId();
  const indices = workout.flatMap((item, index) => isBanner(item) ? [] : [index]);
  const [session, setSession] = useState<Session>(empty);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const rowRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const storageKey = !preview && userId ? `angle:training:v1:${userId}${storageScope ? `:${storageScope}` : ''}` : null;

  useEffect(() => {
    if (!sessionDate) return;
    let restored = empty();
    try {
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === sessionDate && data.program === program && Array.isArray(data.session?.done)) {
          restored = {
            done: [...new Set<number>(data.session.done.filter((i: unknown) => typeof i === 'number' && indices.includes(i)))],
            active: null,
            started: data.session.started === true,
            finished: data.session.finished === true,
            id: typeof data.session.id === 'string' && UUID.test(data.session.id) ? data.session.id : undefined,
          };
        }
      }
    } catch { setStorageAvailable(false); }
    // Hydrate browser-only progress after SSR; program/account changes remount this view.
    setSession(restored);
    setReady(true);
    // indices are entirely derived from program, the serialized workout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, storageKey, sessionDate]);

  function update(next: Session) {
    if (localTrainingDate() !== sessionDate) return;
    next = { ...next, id: next.id || session.id || crypto.randomUUID() };
    setSession(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify({ program, date: sessionDate, session: next })); }
      catch { setStorageAvailable(false); }
    }
  }
  function focusRow(index: number | null) {
    if (index === null) return;
    requestAnimationFrame(() => rowRefs.current[index]?.focus({ preventScroll: false }));
  }
  function toggle(index: number, advance = false) {
    const removing = session.done.includes(index);
    const done = removing ? session.done.filter(i => i !== index) : [...session.done, index];
    if (session.finished) {
      void correctCompletedSession({ ...session, done });
      return;
    }
    const nextIndex = !removing && advance ? indices.find(i => i > index && !done.includes(i)) ?? indices.find(i => !done.includes(i)) ?? index : session.active;
    update({ ...session, done, active: nextIndex, started: advance ? true : session.started, finished: false });
    if (advance) focusRow(nextIndex);
  }
  async function correctCompletedSession(next: Session) {
    if (savingRef.current || localTrainingDate() !== sessionDate) return;
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      if (!preview) {
        const {data:{session:auth}} = await supabase.auth.getSession();
        if (!auth || auth.user.id !== userId) throw new Error('Please sign in again to update your workout.');
        const res = await fetch('/api/workout-history', {
          method:'PATCH', signal:AbortSignal.timeout(20000),
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},
          body:JSON.stringify({sessionId:next.id,completedExercises:next.done.length}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update your checkmarks. Please try again.');
        window.dispatchEvent(new Event('angle:workout-completed'));
      }
      update(next);
    } catch(e) { setSaveError(e instanceof Error ? e.message : 'Could not update your checkmarks. Please try again.'); }
    finally {savingRef.current=false;setSaving(false);}
  }
  async function finish() {
    if (savingRef.current || !session.done.length || localTrainingDate() !== sessionDate) return;
    savingRef.current = true; setSaving(true); setSaveError('');
    const current = { ...session, id: session.id || crypto.randomUUID() };
    update(current);
    try {
      if (!preview) {
        const {data:{session:auth}} = await supabase.auth.getSession();
        if (!auth || auth.user.id !== userId) throw new Error('Please sign in again to save your workout.');
        const res = await fetch('/api/workout-history', {method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:JSON.stringify({
          sessionId:current.id, timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
          workoutName:(dayTitle || 'Full program').slice(0,200),dayKey:(storageScope || 'full-program').slice(0,200),
          completedExercises:current.done.length,totalExercises:indices.length,
        })});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Your workout could not be saved. Please retry.');
        window.dispatchEvent(new Event('angle:workout-completed'));
      }
      update({ ...current, active: null, started: false, finished: true });
      setConfirmFinish(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } catch(e) { setSaveError(e instanceof Error ? e.message : 'Your workout could not be saved. Please retry.'); }
    finally {savingRef.current=false;setSaving(false);}
  }
  if (!indices.length) return <p>No exercises have been assigned yet.</p>;

  return <section className={styles.training} aria-label={dayTitle || "Today's training"}>
    <fieldset disabled={saving} style={{border:0,padding:0,margin:0,minWidth:0}}>
    {!session.started && !session.finished && <div className={styles.top}>
      <button className={styles.primary} disabled={!ready} onClick={() => {
        const active = session.active ?? indices.find(i => !session.done.includes(i)) ?? indices[0];
        update({ ...session, started: true, active }); focusRow(active);
      }}>{session.done.length || session.active !== null ? 'Resume session' : dayTitle ? 'Start this day' : 'Start session'} <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
    </div>}
    {(session.started || session.finished || session.done.length > 0) && <>
    <div className={styles.progressText} tabIndex={-1} ref={summaryRef}><span className={session.finished ? styles.completedHeading : undefined}>{session.finished ? 'Session complete' : 'In progress'}</span><span aria-live="polite">{session.done.length} of {indices.length} complete</span></div>
    <div className={styles.track} role="progressbar" aria-label="Exercise completion" aria-valuemin={0} aria-valuemax={indices.length} aria-valuenow={session.done.length}><div style={{ width: `${session.done.length / indices.length * 100}%` }} /></div>
    </>}
      <ol className={styles.list}>{workout.map((item, index) => {
        if (isBanner(item)) return <li className={styles.banner} key={index}><h2>{item.text || 'Flexibility - 3x/week'}</h2></li>;
        const open = (session.started || session.finished) && session.active === index;
        const done = session.done.includes(index);
        const video = item.videoId ? videos[item.videoId] : undefined;
        const note = item.description || video?.description || '';
        const sets = item.sets ? `${item.sets}${/^\d+(?:\s*[-–]\s*\d+)?$/.test(item.sets.trim()) ? ' sets' : ''}` : '';
        return <li className={`${styles.item} ${open ? styles.active : ''}`} key={index}>
          <div className={styles.row}>
            <input type="checkbox" className={styles.check} aria-label={`Complete ${item.title}`} checked={done} disabled={!ready} onChange={() => toggle(index)} />
            <button ref={node => { rowRefs.current[index] = node; }} className={styles.exercise} aria-expanded={open} aria-controls={`${detailId}-exercise-detail-${index}`} disabled={!ready} onClick={() => update({ ...session, started: !session.finished, active: open ? null : index })}>
              <span className={styles.number}>{String(indices.indexOf(index) + 1).padStart(2, '0')}</span><span className={styles.text}><span className={styles.name}>{item.title}</span><span className={styles.dose}>{[sets, item.repsOrHoldTime].filter(Boolean).join(' · ')}</span>{!dayTitle && <span className={styles.dose}>{frequency(item)}</span>}</span>
              <span className={styles.status}>{done ? 'Complete' : open ? 'Now' : ''}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          <div id={`${detailId}-exercise-detail-${index}`} hidden={!open}>{open && <div className={styles.detail}>
            <div>{video?.mux_playback_id ? <VideoPlayer key={video.mux_playback_id} playbackId={video.mux_playback_id} /> : <div className={styles.noVideo}>{item.videoId ? 'Video unavailable. Your exercise instructions are below.' : 'Follow your coaching instructions for this exercise.'}</div>}</div>
            <div><p className={styles.note}>{note || 'Follow the prescribed sets and reps above.'}</p>{!dayTitle && <p className={styles.muted}>{frequency(item)}</p>}{!session.finished && <button className={styles.primary} onClick={() => toggle(index, true)}>{done ? 'Mark incomplete' : 'Complete exercise'}</button>}</div>
          </div>}</div>
        </li>;
      })}</ol>
      {!session.finished && <div className={styles.footer}><div className={styles.actions}>
        {session.started && <button className={styles.secondary} onClick={() => update({ ...session, started: false })}>Pause session</button>}
        {session.done.length > 0 && <button className={styles.primary} onClick={() => session.done.length === indices.length ? finish() : setConfirmFinish(true)}>Finish session</button>}
      </div></div>}
      {confirmFinish && <div className={styles.confirm} role="group" aria-label="Finish this session">
        <p>Finish today’s session?</p><div className={styles.actions}><button className={styles.primary} onClick={finish}>Yes, finish session</button><button className={styles.secondary} onClick={() => setConfirmFinish(false)}>Keep training</button></div>
      </div>}
    </fieldset>
    {saving && <p role="status" className={styles.muted}>Saving your workout to the calendar…</p>}
    {saveError && <div role="alert"><p>{saveError} Your checkmarks are still here.</p>{!session.finished && <button className={styles.primary} onClick={finish} disabled={saving}>Retry saving workout</button>}</div>}
    {preview && <p className={styles.storage}>Preview only.</p>}
    {!storageAvailable && <p role="status" className={styles.storage}>Progress can’t be saved on this browser.</p>}
  </section>;
}
