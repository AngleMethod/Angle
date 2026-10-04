'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { splitTrainingDays, type TrainingBanner } from '@/lib/trainingDays';
import { supabase } from '@/lib/supabase';
import { UUID } from '@/lib/workoutHistory';
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
  const program = JSON.stringify(props.workout);
  const grouped = props.workout.some(item => isBanner(item) && item.separateDay === true);
  if (!grouped) return <SessionView key={`${props.userId ?? 'preview'}:${program}`} {...props} program={program} />;
  return <div className={styles.days}>
    <p className={styles.guidance}>Choose your training day. Each day has its own session progress; section dividers stay within that day.</p>
    {splitTrainingDays(props.workout).map(day => <details className={styles.day} key={`${props.userId ?? 'preview'}:${day.key}:${program}`}>
      <summary className={styles.dayHeader}><span><span className={styles.dayTitle}>{day.title}</span><span className={styles.dose}>{[day.frequency, `${day.items.filter(item => !isBanner(item)).length} exercises`].filter(Boolean).join(' · ')}</span></span><svg className={styles.dayChevron} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg></summary>
      <div className={styles.dayBody}><SessionView {...props} workout={day.items} program={JSON.stringify(day.items)} storageScope={day.key} dayTitle={day.title} /></div>
    </details>)}
  </div>;
}

function SessionView({ workout, videos, userId, preview = false, program, storageScope, dayTitle }: Props & { program: string; storageScope?: string; dayTitle?: string }) {
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
    let restored = empty();
    try {
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const data = JSON.parse(raw);
        if (data.program === program && Array.isArray(data.session?.done)) {
          restored = {
            done: [...new Set<number>(data.session.done.filter((i: unknown) => typeof i === 'number' && indices.includes(i)))],
            active: indices.includes(data.session.active) ? data.session.active : null,
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
  }, [program, storageKey]);

  function update(next: Session) {
    next = { ...next, id: next.id || session.id || crypto.randomUUID() };
    setSession(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify({ program, session: next })); }
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
    const nextIndex = !removing && advance ? indices.find(i => i > index && !done.includes(i)) ?? indices.find(i => !done.includes(i)) ?? index : index;
    update({ id: session.id, done, active: nextIndex, started: true, finished: false });
    if (advance) focusRow(nextIndex);
  }
  async function finish() {
    if (savingRef.current || !session.done.length) return;
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
    <div className={styles.top}>
      <div><p className={styles.eyebrow}>Your program, in order</p><p className={styles.muted}>{indices.length} exercises · {dayTitle ? 'Follow the schedule on your training-day banner.' : 'Follow the frequency shown on each exercise.'}</p></div>
      {!session.started && !session.finished && <button className={styles.primary} disabled={!ready} onClick={() => {
        const active = session.active ?? indices.find(i => !session.done.includes(i)) ?? indices[0];
        update({ ...session, started: true, active }); focusRow(active);
      }}>{session.done.length || session.active !== null ? 'Resume session' : dayTitle ? 'Start this day' : 'Start session'} <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>}
    </div>
    <p className={styles.guidance}>Train the sections scheduled for today. Optional work can be left unchecked.</p>
    <div className={styles.progressText}><span>{session.finished ? 'Session complete' : session.started ? 'In progress' : 'Your program'}</span><span aria-live="polite">{session.done.length} of {indices.length} complete</span></div>
    <div className={styles.track} role="progressbar" aria-label="Exercise completion" aria-valuemin={0} aria-valuemax={indices.length} aria-valuenow={session.done.length}><div style={{ width: `${session.done.length / indices.length * 100}%` }} /></div>
    {session.finished ? <div className={styles.summary} tabIndex={-1} ref={summaryRef}>
      <p className={styles.eyebrow}>Time well spent</p><h2>Practice complete.</h2><p>{session.done.length} of {indices.length} exercises completed this session.</p>
      <div className={styles.actions}><button className={styles.primary} onClick={() => update({ ...empty(), id: crypto.randomUUID() })}>Start a new session</button><button className={styles.secondary} onClick={() => update({ ...session, finished: false, started: true, active: indices.find(i => !session.done.includes(i)) ?? indices[0] })}>Review session</button></div>
    </div> : <>
      <ol className={styles.list}>{workout.map((item, index) => {
        if (isBanner(item)) return <li className={styles.banner} key={index}><h2>{item.text || 'Flexibility - 3x/week'}</h2></li>;
        const open = session.started && session.active === index;
        const done = session.done.includes(index);
        const video = item.videoId ? videos[item.videoId] : undefined;
        const note = item.description || video?.description || '';
        const sets = item.sets ? `${item.sets}${/^\d+(?:\s*[-–]\s*\d+)?$/.test(item.sets.trim()) ? ' sets' : ''}` : '';
        return <li className={`${styles.item} ${open ? styles.active : ''}`} key={index}>
          <div className={styles.row}>
            <input type="checkbox" className={styles.check} aria-label={`Complete ${item.title}`} checked={done} disabled={!ready} onChange={() => toggle(index)} />
            <button ref={node => { rowRefs.current[index] = node; }} className={styles.exercise} aria-expanded={open} aria-controls={`${detailId}-exercise-detail-${index}`} disabled={!ready} onClick={() => update({ ...session, started: true, active: open ? null : index })}>
              <span className={styles.number}>{String(indices.indexOf(index) + 1).padStart(2, '0')}</span><span className={styles.text}><span className={styles.name}>{item.title}</span><span className={styles.dose}>{[sets, item.repsOrHoldTime].filter(Boolean).join(' · ')}</span>{!dayTitle && <span className={styles.dose}>{frequency(item)}</span>}</span>
              <span className={styles.status}>{done ? 'Complete' : open ? 'Now' : ''}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          <div id={`${detailId}-exercise-detail-${index}`} hidden={!open}>{open && <div className={styles.detail}>
            <div>{video?.mux_playback_id ? <VideoPlayer key={video.mux_playback_id} playbackId={video.mux_playback_id} /> : <div className={styles.noVideo}>{item.videoId ? 'Video unavailable. Your exercise instructions are below.' : 'Follow your coaching instructions for this exercise.'}</div>}</div>
            <div><p className={styles.note}>{note || 'Follow the prescribed sets and reps above.'}</p>{!dayTitle && <p className={styles.muted}>{frequency(item)}</p>}<button className={styles.primary} onClick={() => toggle(index, true)}>{done ? 'Mark incomplete' : 'Complete exercise'}</button></div>
          </div>}</div>
        </li>;
      })}</ol>
      <div className={styles.footer}><p className={styles.muted}>Check off an exercise after completing its prescribed sets.</p><div className={styles.actions}>
        {session.started && <button className={styles.secondary} onClick={() => update({ ...session, started: false })}>Pause session</button>}
        {session.done.length > 0 && <button className={styles.primary} onClick={() => session.done.length === indices.length ? finish() : setConfirmFinish(true)}>Finish session</button>}
      </div></div>
      {confirmFinish && <div className={styles.confirm} role="group" aria-label="Finish this session">
        <p>You’ve completed {session.done.length} of {indices.length} exercises. Finished your scheduled training for today?</p><div className={styles.actions}><button className={styles.primary} onClick={finish}>Yes, finish session</button><button className={styles.secondary} onClick={() => setConfirmFinish(false)}>Keep training</button></div>
      </div>}
    </>}
    </fieldset>
    {saving && <p role="status" className={styles.muted}>Saving your workout to the calendar…</p>}
    {saveError && <div role="alert"><p>{saveError} Your checkmarks are still here.</p><button className={styles.primary} onClick={finish} disabled={saving}>Retry saving workout</button></div>}
    <p className={styles.storage}>{preview ? 'Preview only — checkmarks do not change the student’s progress.' : storageAvailable ? 'Session progress is saved on this browser. Start a new session when you next train.' : 'Browser storage is unavailable. Keep this page open to retain your progress.'}</p>
  </section>;
}
