"use client";

import { useId, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, MeasuringStrategy, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ExerciseDragHandle, ProgramDropTarget, programCollision, programKeyboardCoordinates } from './ProgramDrag';
import VideoPlayer from './VideoPlayer';
import { splitTrainingDays, type TrainingBanner } from '@/lib/trainingDays';
import s from './ProgramEditor.module.css';

type Step = { type?: 'video'; title: string; description: string; videoId?: string; sets?: string; repsOrHoldTime?: string; frequency?: string; section?: string; sectionTitle?: string; sectionDescription?: string };
type Item = Step | TrainingBanner;
type Video = { id: string; title: string; mux_playback_id: string; description: string | null };
type Props = {
  workout: Item[]; videos: Video[];
  frequency: (step: Step) => string;
  onUpdate: (index: number, patch: Partial<Step>) => void;
  onBannerText: (index: number, text: string) => void;
  onBanner: (index: number, patch: Partial<TrainingBanner>) => void;
  onUp: (index: number) => void; onDown: (index: number) => void;
  onEdge: (index: number, edge: 'top' | 'bottom') => void;
  onMove: (from: number, boundary: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
};
const isBanner = (item: Item): item is TrainingBanner => item.type === 'banner';
const Chevron = () => <svg className={s.chevron} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg>;

export default function ProgramEditor(p: Props) {
  const dragContextId = useId();
  const editorRef = useRef<HTMLElement>(null);
  const [dragged, setDragged] = useState<{ index: number; title: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: programKeyboardCoordinates }));
  function finishDrag(event: DragEndEvent) {
    const from = event.active.data.current?.index;
    const boundary = event.over?.data.current?.boundary;
    if (typeof from === 'number' && typeof boundary === 'number') {
      const destination = boundary > from ? boundary - 1 : boundary;
      move(from, destination, () => p.onMove(from, boundary));
      requestAnimationFrame(() => editorRef.current?.querySelector<HTMLButtonElement>(`[data-drag-index="${destination}"]`)?.focus({ preventScroll: true }));
    }
    setDragged(null);
  }
  const [active, setActive] = useState<number | null>(null);
  const [editingBanner, setEditingBanner] = useState<number | null>(null);
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const indexed = p.workout.map((item, originalIndex) => ({ ...item, originalIndex }));
  const grouped = indexed.some(item => isBanner(item) && item.separateDay === true);
  const days = grouped ? splitTrainingDays(indexed) : [{ key: 'full', title: 'Full program', frequency: '', items: indexed }];
  const videoMap = new Map(p.videos.map(v => [v.id, v]));
  const controls = (index: number, name: string) => <div className={s.controls} aria-label={`Reorder ${name}`}>
    <span>Position</span>
    <button type="button" disabled={index === 0} onClick={() => move(index, index - 1, () => p.onUp(index))}>Up</button>
    <button type="button" disabled={index === p.workout.length - 1} onClick={() => move(index, index + 1, () => p.onDown(index))}>Down</button>
    <button type="button" disabled={index === 0} onClick={() => move(index, 0, () => p.onEdge(index, 'top'))}>Move to top</button>
    <button type="button" disabled={index === p.workout.length - 1} onClick={() => move(index, p.workout.length - 1, () => p.onEdge(index, 'bottom'))}>Move to bottom</button>
    <button type="button" className={s.remove} onClick={() => { p.onRemove(index); setActive(null); setEditingBanner(null); }}>Remove</button>
  </div>;
  function move(from: number, to: number, apply: () => void) {
    if (from === to) return;
    apply();
    // Reordering can cross day boundaries; close editors rather than attach them to a different exercise.
    setActive(null); setEditingBanner(null); setClosedDays([]);
  }
  const bannerEditor = (banner: TrainingBanner, index: number) => editingBanner === index && <div className={s.bannerEditor}>
    <label>Banner text<input value={banner.text} onChange={e => p.onBannerText(index, e.target.value)} placeholder="Section or training day" /></label>
    <div className={s.fields}>
      <label>Banner behavior<select value={banner.separateDay ? 'day' : 'section'} onChange={e => { p.onBanner(index, { separateDay: e.target.value === 'day', dayId: banner.dayId || crypto.randomUUID() }); setClosedDays([]); }}><option value="section">Section divider (same session)</option><option value="day">Separate training day</option></select></label>
      {banner.separateDay && <label>Day frequency<input value={banner.dayFrequency || ''} placeholder="e.g. 2× per week" onChange={e => p.onBanner(index, { dayFrequency: e.target.value })} /></label>}
    </div>
    <p className={s.help}>{banner.separateDay ? 'Starts a separate session until the next training day. Moving this banner changes which exercises belong to the day.' : 'A visual section divider. Exercises remain in the same session.'}</p>
    {controls(index, banner.text || 'banner')}
  </div>;
  return <DndContext id={dragContextId} sensors={sensors} collisionDetection={programCollision} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    onDragStart={event => { const data = event.active.data.current; if (data) setDragged({ index: data.index, title: data.title }); }}
    onDragCancel={() => setDragged(null)} onDragEnd={finishDrag}
    accessibility={{ restoreFocus: false, screenReaderInstructions: { draggable: 'Press Space to pick up an exercise. Use the up and down arrow keys to choose a position or another day. Press Space to drop, or Escape to cancel.' }, announcements: {
      onDragStart: ({ active }) => `Picked up ${active.data.current?.title}.`,
      onDragOver: ({ over }) => over ? `Move ${over.data.current?.label}.` : 'Outside the program. Drop to cancel.',
      onDragEnd: ({ over }) => over ? `Exercise placed ${over.data.current?.label}. Save Workout to keep your changes.` : 'Move cancelled.',
      onDragCancel: () => 'Move cancelled.',
    } }}>
  <section ref={editorRef} className={s.editor} aria-label="Program workout editor">
    <div className={s.heading}><div><p className={s.eyebrow}>Your member’s training</p><h2>Program Builder</h2><p className={s.help}>{p.workout.filter(item => !isBanner(item)).length} exercises{grouped ? ` · ${days.length} training days` : ''} · Drag the grip to reorder or move between days. Open an exercise to edit.</p></div><button type="button" className={s.add} onClick={p.onAdd}>Add exercise or banner</button></div>
    {!p.workout.length && <p className={s.empty}>Your program is empty. Add an exercise or a banner to begin.</p>}
    {days.map(day => {
      const bannerIndex = grouped ? p.workout.findIndex((item, index) => isBanner(item) && item.separateDay === true && `day:${item.dayId || index}` === day.key) : -1;
      const banner = bannerIndex >= 0 ? p.workout[bannerIndex] as TrainingBanner : null;
      const closed = closedDays.includes(day.key);
      const endBoundary = day.items.length ? day.items[day.items.length - 1].originalIndex + 1 : bannerIndex + 1;
      let number = 0;
      return <div className={grouped ? s.day : s.full} key={day.key}>
        {grouped && <ProgramDropTarget id={`day-drop-${day.key}`} boundary={endBoundary} label={`to the end of ${day.title}`}><div className={s.dayHeader}><button type="button" className={s.dayToggle} aria-expanded={!closed} onClick={() => setClosedDays(prev => closed ? prev.filter(k => k !== day.key) : [...prev, day.key])}><span><strong>{day.title}</strong><small>{[day.frequency, `${day.items.filter(item => !isBanner(item)).length} exercises`].filter(Boolean).join(' · ')}</small></span><Chevron /></button>{banner && <button type="button" className={s.editButton} aria-expanded={editingBanner === bannerIndex} onClick={() => setEditingBanner(editingBanner === bannerIndex ? null : bannerIndex)}>Edit day</button>}</div></ProgramDropTarget>}
        {banner && bannerEditor(banner, bannerIndex)}
        {!closed && <div className={s.dayBody}>{day.items.map(item => {
          const i = item.originalIndex;
          if (isBanner(item)) return <ProgramDropTarget key={`section-${i}`} id={`before-${i}`} boundary={i} label={`before ${item.text || "section divider"}`}><div className={s.section}><div className={s.sectionHeader}><h3>{item.text || 'Section divider'}</h3><button type="button" className={s.editButton} aria-expanded={editingBanner === i} onClick={() => setEditingBanner(editingBanner === i ? null : i)}>Edit section</button></div>{bannerEditor(item,i)}</div></ProgramDropTarget>;
          number++;
          const video = item.videoId ? videoMap.get(item.videoId) : undefined;
          const open = active === i;
          const title = item.title || video?.title || `Exercise ${number}`;
          const sets = item.sets ? `${item.sets}${/^\d+(?:\s*[-–]\s*\d+)?$/.test(item.sets.trim()) ? ' sets' : ''}` : '';
          return <ProgramDropTarget key={`exercise-${i}`} id={`before-${i}`} boundary={i} label={`before ${title} in ${day.title}`}><article className={`${s.exercise} ${open ? s.open : ''} ${dragged?.index === i ? s.dragSource : ''}`}>
            <div className={s.exerciseHeader}><ExerciseDragHandle index={i} title={title} />
            <button type="button" className={s.row} aria-expanded={open} aria-controls={`program-exercise-${i}`} onClick={() => setActive(open ? null : i)}><span className={s.number}>{String(number).padStart(2,'0')}</span><span className={s.title}><strong>{title}</strong><small>{[sets, item.repsOrHoldTime].filter(Boolean).join(' · ') || 'No sets or reps set'}</small><small>{p.frequency(item)}</small></span><span className={s.editHint}>{open ? 'Editing' : 'Edit'}</span><Chevron /></button></div>
            {open && <div id={`program-exercise-${i}`}><div className={s.detail}>
              <div className={s.media}>{video ? <VideoPlayer playbackId={video.mux_playback_id} /> : <div className={s.empty}>{item.videoId ? 'Video not found in library.' : 'No video attached.'}</div>}<p className={s.help}>{video?.title || 'Instruction-only exercise'}</p></div>
              <div className={s.form}>
                <label>Exercise title<input value={item.title} placeholder={video?.title || 'Exercise title'} onChange={e => p.onUpdate(i,{title:e.target.value})} /></label>
                <div className={s.fields}><label>Sets<input value={item.sets || ''} placeholder="e.g. 3" onChange={e => p.onUpdate(i,{sets:e.target.value})} /></label><label>Reps / hold time<input value={item.repsOrHoldTime || ''} placeholder="e.g. 30–45 sec" onChange={e => p.onUpdate(i,{repsOrHoldTime:e.target.value})} /></label></div>
                <label>Frequency<input value={p.frequency(item)} onChange={e => p.onUpdate(i,{frequency:e.target.value})} /></label>
                <label>Exercise instructions<textarea rows={6} value={item.description} placeholder={video?.description || 'Optional'} onChange={e => p.onUpdate(i,{description:e.target.value})} /></label>
                {!item.description && video?.description && <p className={s.inherited}>{video.description}</p>}
              </div>
            </div>{controls(i,title)}</div>}
          </article></ProgramDropTarget>;
        })}{!day.items.length && <p className={s.empty}>No exercises in this training day yet.</p>}<ProgramDropTarget id={`end-${day.key}`} boundary={endBoundary} label={`to the end of ${day.title}`} end /></div>}
      </div>;
    })}
    <p className={s.help}>Edits stay in your draft until you select Save Workout.</p>
  </section>
  <DragOverlay dropAnimation={null}>{dragged && <div className={s.dragOverlay}><span>Moving exercise</span><strong>{dragged.title}</strong><small>Drop between exercises or onto a training day</small></div>}</DragOverlay>
  </DndContext>;
}
