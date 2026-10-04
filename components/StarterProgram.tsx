'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import styles from './StarterProgram.module.css';

const levels = [
  { id: 'beginner', label: 'Beginner', description: 'Building confidence upside down and learning to balance away from the wall.' },
  { id: 'intermediate', label: 'Intermediate', description: 'Comfortable balancing a freestanding handstand; working on shapes, control, and one-arm preparation.' },
  { id: 'advanced', label: 'Advanced', description: 'Training one-arm handstands, presses, and flags.' },
] as const;

export default function StarterProgram({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [level, setLevel] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function startProgram() {
    if (!level || submitting.current) return;
    submitting.current = true;
    setSaving(true); setError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in again to start your program.');
      const response = await fetch('/api/dashboard/starter-program', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      const data = await response.json();
      if (response.ok || (response.status === 409 && data.code === 'existing_program')) {
        window.location.reload();
        return;
      }
      throw new Error(data.error || 'Unable to start your program. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start your program. Please try again.');
      setSaving(false); submitting.current = false;
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="starter-heading" aria-busy={saving}>
      <h2 id="starter-heading" className={styles.heading}>Your training starts now.</h2>
      <p className={styles.intro}>While you wait for your assessment call, choose the level that best describes your current handstand level. Josh will personalize your program after your assessment.</p>
      <fieldset className={styles.choices} disabled={saving}>
        <legend className="sr-only">Choose your handstand level</legend>
        {levels.map((option, index) => (
          <label key={option.id} className={`${styles.card} ${level === option.id ? styles.selected : ''}`}>
            <input type="radio" name="handstand-level" value={option.id} checked={level === option.id} onChange={() => { setLevel(option.id); setError(''); }} aria-label={option.label} aria-describedby={`starter-${option.id}`} />
            <span className={styles.cardTop}><span className={styles.number}>0{index + 1}</span><span className={styles.indicator} aria-hidden="true" /></span>
            <span className={styles.label}>{option.label}</span>
            <span id={`starter-${option.id}`} className={styles.description}>{option.description}</span>
          </label>
        ))}
      </fieldset>
      <Button onClick={startProgram} disabled={!level || saving} className={styles.start}>{saving ? 'Starting your program…' : 'Start my program'}</Button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
