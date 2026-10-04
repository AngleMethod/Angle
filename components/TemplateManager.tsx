'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Button from '@/components/ui/Button';
import ProgramEditor from '@/components/ProgramEditor';
import { supabase } from '@/lib/supabase';
import { moveProgramExercise } from '@/lib/programReorder';
import type { BeginnerTemplate, TemplateItem } from '@/lib/programTemplates';
import s from '@/app/admin/templates/TemplateEditor.module.css';

type Video = { id: string; title: string; description: string | null; mux_playback_id: string; category: string | null };
export default function TemplateManager({ templateId }: { templateId: 'beginner' | 'intermediate' | 'advanced' }) {
  const label = ({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' })[templateId];
  const [template, setTemplate] = useState<BeginnerTemplate | null>(null);
  const [steps, setSteps] = useState<TemplateItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editorVersion, setEditorVersion] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);
  const dirty = !!template && JSON.stringify(steps) !== JSON.stringify(template.steps);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in with your coach account to edit templates.');
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [program, library] = await Promise.all([
        fetch(`/api/admin/program-templates?id=${templateId}`, { headers, cache: 'no-store' }),
        fetch('/api/admin/videos', { headers }),
      ]);
      const data = await program.json();
      if (!program.ok) throw new Error(data.error || 'Could not load template.');
      if (!library.ok) throw new Error('Could not load your video library. Please retry.');
      const videoData = await library.json();
      setTemplate(data.template); setSteps(data.template.steps); setVideos(videoData.videos ?? []);
      setEditorVersion(v => v + 1);
      if (data.missingVideoIds?.length) setError('A video in this template was removed from the library. Remove or replace the missing exercise before saving.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load template.'); }
    finally { setLoading(false); }
  }, [templateId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (!template || saveLock.current) return;
    saveLock.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/program-templates?id=${templateId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ steps, version: template.version }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save template. Your draft is still here.');
      setTemplate(data.template); setSteps(data.template.steps); setMessage(`${label} template saved. Ready to use in the Program Builder.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save template.'); }
    finally { saveLock.current = false; setSaving(false); }
  }
  function move(from: number, to: number) {
    setSteps(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
    });
  }
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = videos.filter(v => words.every(word => `${v.title} ${v.category ?? ''}`.toLowerCase().includes(word)));
  const count = steps.filter(item => item.type !== 'banner').length;
  const missing = steps.some(item => item.type !== 'banner' && !videos.some(v => v.id === item.videoId));
  return <>
    <Nav variant="minimal" isLoggedIn={!!template} authReady={!loading} />
    <main className={s.page}><div className={s.wrap}>
      <header className={s.header}>
        <div><p className={s.eyebrow}>— Program templates</p><h1>{label} <em>{templateId === 'beginner' ? 'foundations.' : 'training.'}</em></h1><p className={s.intro}>Build your starting program once. Load a fresh copy for any student, then tailor it to their level and goals.</p></div>
        <Link className={s.link} href="/admin" onClick={e => { if (dirty && !window.confirm('Leave without saving your template changes?')) e.preventDefault(); }}>Back to Program Builder</Link>
      </header>
      <div className={s.panel}>
        <div className={s.toolbar}>
          <div><h2 className={s.title}>{label} program template</h2><p className={s.muted}>{loading ? 'Loading template…' : `${count} exercises · ${dirty ? 'Unsaved changes' : template?.updated_at ? 'Saved template' : 'Ready for your videos'}`}</p><p className={s.muted}>Template edits affect future copies only. Students receive nothing until you save their workout.</p></div>
          <Button onClick={save} disabled={!template || loading || saving || missing || !dirty}>{saving ? 'Saving…' : 'Save template'}</Button>
        </div>
        {message && <p role="status" className={s.status}>{message}</p>}
        {error && <div role="alert" className={s.error}>{error} <button className={s.link} disabled={saving || loading} onClick={() => { if (!dirty || window.confirm('Discard template edits and reload the saved version?')) void load(); }}>Reload</button></div>}
      </div>
      {template && !loading && <fieldset className={s.fieldset} disabled={saving}>
        <legend className="sr-only">Edit program template</legend>
        <ProgramEditor template key={editorVersion} workout={steps} videos={videos}
          onUpdate={(index, patch) => setSteps(prev => prev.map((item, i) => i === index && item.type !== 'banner' ? { ...item, ...patch } : item))}
          onBannerText={(index, text) => setSteps(prev => prev.map((item, i) => i === index && item.type === 'banner' ? { ...item, text } : item))}
          onBanner={(index, patch) => setSteps(prev => prev.map((item, i) => i === index && item.type === 'banner' ? { ...item, ...patch } : item))}
          onUp={index => move(index, index - 1)} onDown={index => move(index, index + 1)}
          onEdge={(index, edge) => move(index, edge === 'top' ? 0 : steps.length - 1)}
          onMove={(from, boundary) => setSteps(prev => moveProgramExercise(prev, from, boundary))}
          onRemove={index => setSteps(prev => prev.filter((_, i) => index !== i))}
          onAdd={() => searchRef.current?.focus()} />
        <section className={s.panel} aria-labelledby="template-library">
          <h2 id="template-library" className={s.title}>Add your program videos</h2>
          <p className={s.muted}>Choose from your library. Your video instructions are copied with each exercise; edit sets and reps in the program above.</p>
          <div className={s.actions}>
            <button className={s.outline} onClick={() => setSteps(prev => [...prev, { type: 'banner', text: 'Training day', separateDay: true, dayId: crypto.randomUUID(), dayFrequency: '' }])}>Add training day</button>
            <button className={s.outline} onClick={() => setSteps(prev => [...prev, { type: 'banner', text: 'Section divider' }])}>Add section divider</button>
          </div>
          <label className={s.search}>Search videos<input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or category in any word order" /></label>
          <div className={s.list}>
            {!matches.length && <p className={s.muted}>No matching videos.</p>}
            {matches.map(v => <div key={v.id} className={s.row}>
              {/* Library thumbnails are external Mux assets. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" alt="" src={`https://image.mux.com/${encodeURIComponent(v.mux_playback_id)}/thumbnail.jpg?time=1&width=176`} />
              <div className={s.rowTitle}>{v.title}<small>{v.category}{steps.some(item => item.type !== 'banner' && item.videoId === v.id) ? ' · In template' : ''}</small></div>
              <Button size="sm" aria-label={`Add ${v.title}`} onClick={() => { setSteps(prev => [...prev, { type: 'video', videoId: v.id, title: v.title, description: v.description ?? '', sets: '', repsOrHoldTime: '' }]); setMessage(`${v.title} added to your draft.`); }}>Add</Button>
            </div>)}
          </div>
        </section>
      </fieldset>}
    </div></main>
  </>;
}
