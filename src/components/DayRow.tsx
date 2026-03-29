import type { Day, Place } from '../types';
import LegCard from './LegCard';
import SegmentRow from './SegmentRow';

interface Props {
  day: Day;
  dayNumber: number;
  places: Record<string, Place>;
  isOpen: boolean;
  onToggle: () => void;
  onPlaceClick: (place: Place) => void;
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

export default function DayRow({ day, dayNumber, places, isOpen, onToggle, onPlaceClick }: Props) {
  const overnight = places[day.overnightPlaceId];
  const driveMinutes = totalDriveMinutes(day);
  const hasLegs = day.legs.length > 0;

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
                />
              ))}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
