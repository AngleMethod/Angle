import type { TrainingBanner } from '@/lib/trainingDays';

export type TemplateExercise = {
  type?: 'video'; title: string; description: string; videoId?: string;
  sets?: string; repsOrHoldTime?: string; frequency?: string;
  section?: string; sectionTitle?: string; sectionDescription?: string;
};
export type TemplateItem = TemplateExercise | TrainingBanner;
export type BeginnerTemplate = { steps: TemplateItem[]; version: number; updated_at: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reject malformed templates and keep only program fields, never member details. */
export function parseTemplateSteps(value: unknown): TemplateItem[] {
  if (!Array.isArray(value) || value.length > 300) throw new Error('Use at most 300 program items.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid program item.');
    const text = (key: string, max: number, required = false): string => {
      const v = item[key];
      if (v !== undefined && typeof v !== 'string') throw new Error(`Invalid ${key}.`);
      const result = (v ?? '').trim();
      if (result.length > max || (required && !result)) throw new Error(`Check ${key}.`);
      return result;
    };
    if (item.type === 'banner') {
      if (item.separateDay !== undefined && typeof item.separateDay !== 'boolean') throw new Error('Invalid training day.');
      const banner: TrainingBanner = { type: 'banner', text: text('text', 200, true) };
      if (item.separateDay === true) {
        const id = text('dayId', 36, true);
        if (!uuid.test(id)) throw new Error('Invalid training day ID.');
        Object.assign(banner, { separateDay: true, dayId: id, dayFrequency: text('dayFrequency', 120) });
      }
      return banner;
    }
    if (item.type !== undefined && item.type !== 'video') throw new Error('Invalid exercise type.');
    const id = text('videoId', 36, true);
    if (!uuid.test(id)) throw new Error('Choose a library video for every exercise.');
    return { type: 'video', videoId: id, title: text('title', 300, true), description: text('description', 10000), sets: text('sets', 100), repsOrHoldTime: text('repsOrHoldTime', 200), ...Object.fromEntries(['frequency', 'section', 'sectionTitle', 'sectionDescription'].filter(key => item[key] !== undefined).map(key => [key, text(key, 10000)])) };
  });
}

/** Each student receives an independent copy and fresh session/day identities. */
export function copyTemplateSteps(steps: TemplateItem[], newId = () => crypto.randomUUID()): TemplateItem[] {
  return steps.map(item => item.type === 'banner' && item.separateDay
    ? { ...item, dayId: newId() }
    : { ...item });
}
