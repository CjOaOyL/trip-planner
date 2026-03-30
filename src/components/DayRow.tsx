import type { Day, Place, Segment, ReservationStatus } from '../types';
import LegCard from './LegCard';
import SegmentRow from './SegmentRow';

interface Props {
  day: Day;
  dayNumber: number;
  places: Record<string, Place>;
  isOpen: boolean;
  onToggle: () => void;
  onPlaceClick: (place: Place) => void;
  reservationsByPlaceId?: Record<string, ReservationStatus>;
  showCost?: boolean;
  editing?: boolean;
  onUpdateDay?: (updated: Day) => void;
  onRemoveDay?: () => void;
}

/** Total drive minutes across all legs in a day */
function totalDriveMinutes(day: Day): number {
  return day.legs.reduce((sum, leg) => sum + leg.drivingMinutes, 0);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function DayRow({ day, dayNumber, places, isOpen, onToggle, onPlaceClick, reservationsByPlaceId = {}, showCost, editing, onUpdateDay, onRemoveDay }: Props) {
  const overnight = places[day.overnightPlaceId];
  const driveMinutes = totalDriveMinutes(day);
  const hasLegs = day.legs.length > 0;

  // Cost totals for this day
  const activityCost = day.segments.reduce((sum, s) => sum + (s.costEstimate ?? 0), 0);
  const lodgingCost = day.lodgingCost ?? 0;
  const dayTotal = activityCost + lodgingCost;
  const hasCosts = dayTotal > 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {/* ── Header (always visible) ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        {/* Day number badge */}
        <span className="shrink-0 w-8 h-8 rounded-full bg-stone-100 text-stone-600 text-sm font-semibold flex items-center justify-center">
          {dayNumber}
        </span>

        {/* Label + theme */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-800 text-sm">{day.label}</div>
          <div className="text-stone-400 text-xs mt-0.5">{day.theme}</div>
        </div>

        {/* Meta chips */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {showCost && hasCosts && (
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              💲{dayTotal.toLocaleString()}
            </span>
          )}
          {hasLegs && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              🚗 {formatMinutes(driveMinutes)}
            </span>
          )}
          {overnight && (
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full max-w-[140px] truncate">
              🛏 {overnight.name}
            </span>
          )}
        </div>

        {/* Chevron */}
        <span
          className={`shrink-0 text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {/* ── Expanded content ── */}
      {isOpen && (
        <div className="border-t border-stone-100">
          {/* Edit day controls (edit mode) */}
          {editing && onUpdateDay && (
            <div className="px-5 py-3 bg-blue-50/50 border-b border-stone-100 flex flex-wrap items-center gap-3">
              <label className="text-xs text-stone-500">
                Theme
                <input
                  value={day.theme}
                  onChange={(e) => onUpdateDay({ ...day, theme: e.target.value })}
                  className="block w-56 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white"
                />
              </label>
              <label className="text-xs text-stone-500">
                Label
                <input
                  value={day.label}
                  onChange={(e) => onUpdateDay({ ...day, label: e.target.value })}
                  className="block w-56 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white"
                />
              </label>
              <label className="text-xs text-stone-500">
                Lodging $
                <input
                  value={day.lodgingCost ?? ''}
                  onChange={(e) => onUpdateDay({ ...day, lodgingCost: parseFloat(e.target.value) || 0 })}
                  type="number" className="block w-20 mt-0.5 px-2 py-1 text-xs border border-stone-200 rounded bg-white"
                />
              </label>
              {onRemoveDay && (
                <button
                  onClick={onRemoveDay}
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 ml-auto"
                >
                  Remove Day
                </button>
              )}
            </div>
          )}
          {/* Drive legs */}
          {hasLegs && (
            <div className="px-5 py-4 bg-blue-50 border-b border-stone-100 space-y-3">
              <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Driving</div>
              {day.legs.map((leg) => (
                <LegCard key={leg.id} leg={leg} places={places} onPlaceClick={onPlaceClick} />
              ))}
            </div>
          )}

          {/* Schedule segments */}
          {day.segments.length > 0 && (
            <div className="divide-y divide-stone-100">
              <div className="px-5 pt-3 pb-1">
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Schedule</span>
              </div>
              {day.segments.map((seg, i) => (
                <SegmentRow
                  key={i}
                  segment={seg}
                  place={places[seg.placeId]}
                  onPlaceClick={onPlaceClick}
                  reservationStatus={reservationsByPlaceId[seg.placeId]}
                  showCost={showCost}
                  editing={editing}
                  onUpdate={editing && onUpdateDay ? (updatedSeg: Segment) => {
                    const newSegments = [...day.segments];
                    newSegments[i] = updatedSeg;
                    onUpdateDay({ ...day, segments: newSegments });
                  } : undefined}
                  onRemove={editing && onUpdateDay ? () => {
                    const newSegments = day.segments.filter((_, idx) => idx !== i);
                    onUpdateDay({ ...day, segments: newSegments });
                  } : undefined}
                />
              ))}
            </div>
          )}

          {/* Add segment button (edit mode) */}
          {editing && onUpdateDay && (
            <div className="px-5 py-2 border-t border-stone-100">
              <button
                onClick={() => {
                  const newSeg: Segment = {
                    time: 'TBD',
                    placeId: day.overnightPlaceId || '',
                    activity: 'New activity',
                    durationMinutes: 60,
                  };
                  onUpdateDay({ ...day, segments: [...day.segments, newSeg] });
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                + Add segment
              </button>
            </div>
          )}

          {/* Day notes */}
          {day.notes && (
            <div className="px-5 py-3 bg-amber-50 border-t border-stone-100 flex gap-2 text-sm text-amber-800">
              <span className="shrink-0">💡</span>
              <span>{day.notes}</span>
            </div>
          )}

          {/* Overnight footer */}
          {overnight && (
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center gap-2 text-sm text-stone-500">
              <span>🛏</span>
              <span>Overnight in </span>
              <button
                onClick={() => onPlaceClick(overnight)}
                className="font-medium text-stone-700 hover:text-brand-600 hover:underline"
              >
                {overnight.name}
              </button>
              {showCost && lodgingCost > 0 && (
                <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Lodging ${lodgingCost}
                </span>
              )}
            </div>
          )}

          {/* Day cost summary */}
          {showCost && hasCosts && (
            <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between text-sm">
              <span className="text-emerald-700 font-medium">Day Total</span>
              <div className="flex items-center gap-3">
                {activityCost > 0 && (
                  <span className="text-xs text-emerald-600">Activities ${activityCost.toLocaleString()}</span>
                )}
                {lodgingCost > 0 && (
                  <span className="text-xs text-emerald-600">Lodging ${lodgingCost.toLocaleString()}</span>
                )}
                <span className="font-bold text-emerald-800">${dayTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
