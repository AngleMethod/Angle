/** Insert an exercise at a boundary in the original list, keeping all banners in place. */
export function moveProgramExercise<T extends { type?: string }>(items: T[], from: number, boundary: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(boundary) || from < 0 || from >= items.length || boundary < 0 || boundary > items.length || items[from].type === 'banner') return items;
  const destination = boundary > from ? boundary - 1 : boundary;
  if (destination === from) return items;
  const updated = [...items];
  const [exercise] = updated.splice(from, 1);
  updated.splice(destination, 0, exercise);
  return updated;
}
