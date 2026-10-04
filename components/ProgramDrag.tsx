"use client";

import { useDraggable, useDroppable, type CollisionDetection, type KeyboardCoordinateGetter, pointerWithin, closestCenter } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import s from './ProgramEditor.module.css';

export const programCollision: CollisionDetection = args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

// One arrow press advances to the next visible insertion target, including collapsed days.
export const programKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.code)) return;
  event.preventDefault();
  const current = context.collisionRect;
  if (!current) return;
  const currentY = context.over ? context.over.rect.top + context.over.rect.height / 2 : current.top + current.height / 2;
  const down = event.code === 'ArrowDown';
  const targets = context.droppableContainers.getEnabled().map(container => ({ container, rect: context.droppableRects.get(container.id) }))
    .filter(entry => entry.rect && (down ? entry.rect.top + entry.rect.height / 2 > currentY + 1 : entry.rect.top + entry.rect.height / 2 < currentY - 1))
    .sort((a, b) => down ? a.rect!.top - b.rect!.top : b.rect!.top - a.rect!.top);
  const target = targets[0]?.rect;
  if (!target) return;
  return { x: currentCoordinates.x + target.left + target.width / 2 - (current.left + current.width / 2), y: currentCoordinates.y + target.top + target.height / 2 - (current.top + current.height / 2) };
};

export function ExerciseDragHandle({ index, title }: { index: number; title: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `exercise-${index}`, data: { index, title } });
  return <button ref={setNodeRef} data-drag-index={index} type="button" className={s.dragHandle} {...attributes} {...listeners} aria-label={`Move ${title}`} title="Drag to reorder or move to another day">
    <svg aria-hidden="true" width="18" height="24" viewBox="0 0 18 24" fill="currentColor">{[6,12,18].flatMap(y => [6,12].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}</svg>
  </button>;
}

export function ProgramDropTarget({ id, boundary, label, children, end = false }: { id: string; boundary: number; label: string; children?: ReactNode; end?: boolean }) {
  const { setNodeRef, isOver, active } = useDroppable({ id, data: { boundary, label } });
  return <div ref={setNodeRef} className={`${s.dropTarget} ${end ? s.dropEnd : ''} ${active ? s.dropEnabled : ''} ${isOver ? s.dropOver : ''}`}>
    {children}
    {end && active && <span>Drop here · {label}</span>}
  </div>;
}
