import { useState } from 'react';
import type { Segment, Place, PlaceType, ReservationStatus, EventType } from '../types';

const EVENT_BADGE: Record<EventType, { label: string; style: string }> = {
  concert:    { label: '🎵 Concert',    style: 'bg-purple-100 text-purple-700 border-purple-200' },
  rehearsal:  { label: '🎼 Rehearsal',  style: 'bg-blue-100 text-blue-700 border-blue-200' },
  meal:       { label: '🍽 Meal',       style: 'bg-orange-100 text-orange-700 border-orange-200' },
  activity:   { label: '📍 Activity',   style: 'bg-teal-100 text-teal-700 border-teal-200' },
  'free-time':{ label: '🕐 Free Time',  style: 'bg-green-100 text-green-700 border-green-200' },
  travel:     { label: '✈️ Travel',     style: 'bg-stone-100 text-stone-500 border-stone-200' },
  rest:       { label: '🛏 Rest',       style: 'bg-indigo-50 text-indigo-500 border-indigo-100' },
};

interface Props {
  segment: Segment;
  place: Place | undefined;
  onPlaceClick: (place: Place) => void;
  reservationStatus?: ReservationStatus;
  showCost?: boolean;
  editing?: boolean;
  onUpdate?: (updated: Segment) => void;
  onRemove?: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const TYPE_STYLES: Record<PlaceType, { bg: string; label: string }> = {
  university:         { bg: 'bg-indigo-100 text-indigo-700', label: 'University' },
  restaurant:         { bg: 'bg-orange-100 text-orange-700', label: 'Restaurant' },
  attraction:         { bg: 'bg-teal-100 text-teal-700',     label: 'Attraction' },
  hotel:              { bg: 'bg-purple-100 text-purple-700', label: 'Hotel' },
  'ski-resort':       { bg: 'bg-sky-100 text-sky-700',       label: 'Ski Resort' },
  'charging-station': { bg: 'bg-green-100 text-green-700',   label: 'Charger' },
  neighborhood:       { bg: 'bg-pink-100 text-pink-700',     label: 'Neighborhood' },
  museum:             { bg: 'bg-amber-100 text-amber-700',   label: 'Museum' },
  park:               { bg: 'bg-lime-100 text-lime-700',     label: 'Park' },
  'concert-venue':    { bg: 'bg-purple-100 text-purple-700', label: 'Venue' },
  airport:            { bg: 'bg-stone-100 text-stone-500',   label: 'Airport' },
  beach:              { bg: 'bg-cyan-100 text-cyan-700',     label: 'Beach' },
  other:              { bg: 'bg-stone-100 text-stone-500',   label: '' },
};

// Dot color + tooltip text per reservation status
const RES_DOT: Record<ReservationStatus, { color: string; title: string }> = {
  needed:    { color: 'bg-red-400',    title: 'Reservation needed' },
  contacted: { color: 'bg-yellow-400', title: 'Contacted' },
  booked:    { color: 'bg-blue-400',   title: 'Booked' },
  confirmed: { color: 'bg-green-500',  title: 'Confirmed ✓' },
  cancelled: { color: 'bg-stone-300',  title: 'Cancelled' },
};

// Only show a dot for place types that typically need a reservation
const NEEDS_RESERVATION: PlaceType[] = [
  'restaurant', 'ski-resort', 'museum', 'attraction', 'university',
];

export default function SegmentRow({ segment, place, onPlaceClick, reservationStatus, showCost, editing, onUpdate, onRemove }: Props) {
  const typeStyle = place ? TYPE_STYLES[place.type] : TYPE_STYLES.other;
  const duration = formatDuration(segment.durationMinutes);
  const showDot = place && NEEDS_RESERVATION.includes(place.type);
  const dot = reservationStatus ? RES_DOT[reservationStatus] : null;
  const hasCost = showCost && segment.costEstimate != null && segment.costEstimate > 0;

  // Inline editing state
  const [editTime, setEditTime] = useState(segment.time);
  const [editActivity, setEditActivity] = useState(segment.activity);
  const [editDuration, setEditDuration] = useState(String(segment.durationMinutes));
  const [editCost, setEditCost] = useState(String(segment.costEstimate ?? ''));
  const [editNotes, setEditNotes] = useState(segment.notes ?? '');
  const [isEditing, setIsEditing] = useState(false);

  function commitEdit() {
    if (!onUpdate) return;
    onUpdate({
      ...segment,
      time: editTime.trim() || segment.time,
      activity: editActivity.trim() || segment.activity,
      durationMinutes: parseInt(editDuration) || segment.durationMinutes,
      costEstimate: editCost ? parseFloat(editCost) : undefined,
      notes: editNotes.trim() || undefined,
    });
    setIsEditing(false);
  }

  function cancelEdit() {
    setEditTime(segment.time);
    setEditActivity(segment.activity);
    setEditDuration(String(segment.durationMinutes));
    setEditCost(String(segment.costEstimate ?? ''));
    setEditNotes(segment.notes ?? '');
    setIsEditing(false);
  }

  // ── Inline edit mode ──
  if (editing && isEditing) {
    return (
      <div className="flex flex-col gap-2 px-5 py-3 bg-blue-50 border-l-4 border-blue-400">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-stone-500">
            Time
            <input value={editTime} onChange={(e) => setEditTime(e.target.value)}
              className="block w-24 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white" />
          </label>
          <label className="text-xs text-stone-500 flex-1">
            Activity
            <input value={editActivity} onChange={(e) => setEditActivity(e.target.value)}
              className="block w-full mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white" />
          </label>
          <label className="text-xs text-stone-500">
            Minutes
            <input value={editDuration} onChange={(e) => setEditDuration(e.target.value)} type="number"
              className="block w-20 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white" />
          </label>
          <label className="text-xs text-stone-500">
            Cost $
            <input value={editCost} onChange={(e) => setEditCost(e.target.value)} type="number"
              className="block w-20 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white" placeholder="—" />
          </label>
        </div>
        <label className="text-xs text-stone-500">
          Notes
          <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
            className="block w-full mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white" placeholder="Optional" />
        </label>
        <div className="flex gap-2">
          <button onClick={commitEdit}
            className="text-xs font-medium px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Done
          </button>
          <button onClick={cancelEdit}
            className="text-xs font-medium px-3 py-1 bg-stone-200 text-stone-600 rounded hover:bg-stone-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const eventBadge = segment.eventType ? EVENT_BADGE[segment.eventType] : null;
  const isFixed = segment.fixed === true;
  const isVisitorOpen = segment.openTo?.includes('visitor') ?? true;
  const isTicketed = segment.ticketed === true;

  return (
    <div className={`flex items-start gap-4 px-5 py-3 hover:bg-stone-50 transition-colors ${editing ? 'group/seg' : ''} ${isFixed ? 'border-l-2 border-stone-300' : ''}`}>
      {/* Time */}
      <span className="shrink-0 w-20 text-xs font-medium text-stone-400 pt-0.5 tabular-nums">
        {segment.time}
      </span>

      {/* Activity + place */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lock icon for fixed events */}
          {isFixed && <span title="Fixed event — part of the set schedule" className="text-stone-400 text-xs">🔒</span>}
          <span className="text-sm text-stone-800">{segment.activity}</span>
          {/* Reservation status dot */}
          {showDot && (
            <span
              title={dot ? dot.title : 'No reservation tracked'}
              className={`shrink-0 inline-block w-2 h-2 rounded-full ${
                dot ? dot.color : 'bg-stone-200'
              }`}
            />
          )}
        </div>

        {/* Event type badge */}
        {eventBadge && (
          <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${eventBadge.style}`}>
            {eventBadge.label}
          </span>
        )}

        {/* Ticketed badge */}
        {isTicketed && (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            🎟 Ticket required
          </span>
        )}

        {/* Open to visitors badge */}
        {isVisitorOpen && segment.openTo && (
          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            👥 Open to visitors
          </span>
        )}

        {place && (
          <button
            onClick={() => onPlaceClick(place)}
            className="mt-0.5 flex items-center gap-1.5 text-xs hover:underline"
          >
            {place.blackOwned && (
              <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                Black-owned
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full font-medium ${typeStyle.bg}`}>
              {typeStyle.label || place.type}
            </span>
            <span className="text-stone-500">{place.name}</span>
          </button>
        )}

        {segment.notes && (
          <p className="mt-1 text-xs text-stone-400 italic">{segment.notes}</p>
        )}
      </div>

      {/* Duration + cost */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
        {duration && (
          <span className="text-xs text-stone-400">{duration}</span>
        )}
        {hasCost && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            ${segment.costEstimate}
          </span>
        )}
      </div>

      {/* Edit / remove buttons (only in edit mode) */}
      {editing && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/seg:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            title="Edit segment"
            className="text-xs text-stone-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50"
          >
            ✏️
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              title="Remove segment"
              className="text-xs text-stone-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
