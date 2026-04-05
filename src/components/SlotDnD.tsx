/**
 * Shared drag-and-drop primitives for the slot grids.
 *
 * Uses @dnd-kit/core.  Both TripOverview and CompareView import from here
 * so the drag card look-and-feel stays consistent.
 */
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type { Place, Segment, TimeSlot } from '../types';

/* ─── Unique segment identity (stable across moves) ─────────────────────────── */

let _nextUid = 1;
export function uid(): number { return _nextUid++; }

export interface DndSegment {
  /** Auto-generated — survives moves between slots */
  uid: number;
  segment: Segment;
  slot: TimeSlot;
  place?: Place;
  /** Which itinerary this originally came from (compare view only) */
  sourceItineraryId?: string;
}

/* ─── Drag / drop payload types ─────────────────────────────────────────────── */

export interface DragPayload {
  seg: DndSegment;
  fromDayIndex: number;
  fromSlot: TimeSlot;
  fromLocation: 'grid' | 'bench';
}

export interface DropPayload {
  dayIndex: number;
  slot: TimeSlot;
  location: 'grid' | 'bench';
}

/* ─── Draggable card wrapper ─────────────────────────────────────────────────── */

interface DraggableCardProps {
  id: string;
  dragData: DragPayload;
  isDragOverlay?: boolean;
  onPlaceClick: (place: Place) => void;
  seg: DndSegment;
}

export function DraggableCard({ id, dragData, isDragOverlay, onPlaceClick, seg }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: dragData,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  if (isDragOverlay) {
    return (
      <div className="rounded bg-white px-2 py-1 shadow-lg ring-2 ring-amber-400 text-xs min-w-[140px]">
        <SegmentContent seg={seg} onPlaceClick={onPlaceClick} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded bg-white/70 px-2 py-1 shadow-sm hover:shadow-md hover:ring-1 hover:ring-stone-300 transition-shadow"
    >
      <SegmentContent seg={seg} onPlaceClick={onPlaceClick} />
    </div>
  );
}

/* ─── Segment inner content ─────────────────────────────────────────────────── */

function SegmentContent({ seg, onPlaceClick }: { seg: DndSegment; onPlaceClick: (p: Place) => void }) {
  return (
    <>
      {seg.segment.time !== '—' && (
        <div className="text-[10px] text-stone-400 tabular-nums">{seg.segment.time}</div>
      )}
      <div className="text-stone-700 leading-snug text-xs">{seg.segment.activity}</div>
      {seg.place && (
        <button
          onClick={(e) => { e.stopPropagation(); onPlaceClick(seg.place!); }}
          className="text-[10px] text-stone-400 hover:text-stone-700 hover:underline mt-0.5 text-left"
        >
          {seg.place.blackOwned ? '★ ' : ''}{seg.place.name}
        </button>
      )}
    </>
  );
}

/* ─── Droppable cell wrapper ─────────────────────────────────────────────────── */

interface DroppableCellProps {
  id: string;
  dropData: DropPayload;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

export function DroppableCell({ id, dropData, className, style, children }: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({ id, data: dropData });

  return (
    <td
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/40' : ''}`}
      style={style}
    >
      {children}
    </td>
  );
}

/* ─── Droppable div (for bench area) ─────────────────────────────────────────── */

interface DroppableDivProps {
  id: string;
  dropData: DropPayload;
  className?: string;
  children: ReactNode;
}

export function DroppableDiv({ id, dropData, className, children }: DroppableDivProps) {
  const { isOver, setNodeRef } = useDroppable({ id, data: dropData });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
}
