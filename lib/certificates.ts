export type Certificate = {
  id: string; recipient_name: string; skill: string; awarded_at: string; award_date: string;
  seen_at: string | null; email_status: 'pending' | 'sending' | 'sent' | 'failed'; email_sent_at: string | null;
};
export const certificateColumns = 'id,recipient_name,skill,awarded_at,award_date,seen_at,email_status,email_sent_at';
export const certificateSkills = ['Freestanding Handstand', 'Press Handstand', 'Straddle One-Arm Handstand', 'Straight One-Arm Handstand', 'Candle One-Arm Handstand', 'Flag Handstand'];
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function certificateText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().normalize('NFC');
  return text.length > 0 && text.length <= max && !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/.test(text) ? text : null;
}
export function certificateDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
}
export function certificateNumber(id: string) { return `ANG-${id.replace(/-/g,'').slice(0,12).toUpperCase()}`; }

export function certificateSkillLines(skill: string): string[] {
  if (skill.length <= 22 || !skill.includes(' ')) return [skill];
  const breaks = [...skill.matchAll(/ /g)].map(match => match.index!);
  const middle = breaks.reduce((best, next) => Math.abs(next - skill.length / 2) < Math.abs(best - skill.length / 2) ? next : best);
  return [skill.slice(0, middle), skill.slice(middle + 1)];
}
