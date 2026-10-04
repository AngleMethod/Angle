'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { copyTemplateSteps, type TemplateItem } from '@/lib/programTemplates';

export default function BeginnerTemplateButton({ hasDraft, disabled, onApply }: {
  hasDraft: boolean; disabled: boolean; onApply: (steps: TemplateItem[]) => void;
}) {
  const [templateId, setTemplateId] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const label = ({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' })[templateId];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function apply() {
    if (inFlight.current) return;
    if (hasDraft && !window.confirm(`Replace the current builder draft with the ${templateId} template? Your saved student program stays unchanged until you click Save Workout.`)) return;
    inFlight.current = true;
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/program-templates?id=${templateId}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load template.');
      if (data.missingVideoIds?.length) throw new Error('A template video is missing. Edit the selected template to replace it first.');
      const steps: TemplateItem[] = data.template.steps;
      if (!steps.some(s => s.type !== 'banner')) throw new Error('Add your videos and save the template first.');
      if (!alive.current) return;
      onApply(copyTemplateSteps(steps));
      setMessage(`${label} template loaded. Customize it, then Save Workout to assign it.`);
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : 'Could not load template.');
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-4">
      <label className="text-xs text-[#b6beaa]">Template
        <select value={templateId} disabled={busy || disabled} onChange={e => { setTemplateId(e.target.value as 'beginner' | 'intermediate' | 'advanced'); setMessage(''); }} className="ml-3 border border-[#4b543c] bg-[#111310] px-3 py-3 text-sm text-[#f0eee8]">
          <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select>
      </label>
      <Button size="sm" onClick={apply} disabled={busy || disabled}>{busy ? 'Loading template…' : `Use ${templateId} template`}</Button>
      <Link href={templateId === 'beginner' ? '/admin/templates' : '/admin/templates/' + templateId} target="_blank" rel="noreferrer" className="text-xs text-[#b6beaa] underline underline-offset-4 hover:text-[#d6ed9b]">Edit template</Link>
    </div>
    {message && <p role="status" className="mt-3 max-w-xl text-sm text-[#d6ed9b]">{message}</p>}
  </div>;
}
