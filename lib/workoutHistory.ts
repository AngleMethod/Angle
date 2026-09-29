export type WorkoutCompletion = {
  session_id: string; completed_at: string; completed_date: string;
  workout_name: string; day_key: string; completed_exercises: number; total_exercises: number;
};
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function dateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  if (year < 2020 || year > 2200) return null;
  return {start: `${month}-01`, end: `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2,'0')}-01`};
}
export function validCompletion(value: unknown): value is {sessionId: string; timeZone: string; workoutName: string; dayKey: string; completedExercises: number; totalExercises: number} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.sessionId !== 'string' || !UUID.test(v.sessionId) || typeof v.timeZone !== 'string' || v.timeZone.length > 100) return false;
  try { dateInZone(new Date(), v.timeZone); } catch { return false; }
  return typeof v.workoutName === 'string' && v.workoutName.trim().length > 0 && v.workoutName.length <= 200
    && typeof v.dayKey === 'string' && v.dayKey.length > 0 && v.dayKey.length <= 200
    && Number.isInteger(v.completedExercises) && Number.isInteger(v.totalExercises)
    && Number(v.completedExercises) > 0 && Number(v.totalExercises) >= Number(v.completedExercises) && Number(v.totalExercises) <= 1000;
}
