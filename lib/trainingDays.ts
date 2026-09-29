export type TrainingBanner = { type: 'banner'; text: string; separateDay?: boolean; dayId?: string; dayFrequency?: string };
type TrainingItem = { type?: string };
export function splitTrainingDays<T extends TrainingItem>(workout: T[]) {
  const groups: { key: string; title: string; frequency: string; items: T[] }[] = [];
  let current = { key: 'general', title: 'General training', frequency: '', items: [] as T[] };
  workout.forEach((item, index) => {
    const banner = item as unknown as TrainingBanner;
    if (item.type === 'banner' && banner.separateDay === true) {
      if (current.items.length || current.key !== 'general') groups.push(current);
      current = { key: `day:${banner.dayId || index}`, title: banner.text || 'Training day', frequency: banner.dayFrequency || '', items: [] };
    } else current.items.push(item);
  });
  groups.push(current);
  return groups;
}
