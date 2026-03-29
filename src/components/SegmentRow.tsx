import type { Segment, Place, PlaceType, ReservationStatus } from '../types';

interface Props {
  segment: Segment;
  place: Place | undefined;
  onPlaceClick: (place: Place) => void;
  reservationStatus?: ReservationStatus;
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

export default function SegmentRow({ segment, place, onPlaceClick, reservationStatus }: Props) {
  const typeStyle = place ? TYPE_STYLES[place.type] : TYPE_STYLES.other;
  const duration = formatDuration(segment.durationMinutes);
  const showDot = place && NEEDS_RESERVATION.includes(place.type);
  const dot = reservationStatus ? RES_DOT[reservationStatus] : null;

  return (
    <div className="flex items-start gap-4 px-5 py-3 hover:bg-stone-50 transition-colors">
      {/* Time */}
      <span className="shrink-0 w-20 text-xs font-medium text-stone-400 pt-0.5 tabular-nums">
        {segment.time}
      </span>

      {/* Activity + place */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
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

      {/* Duration */}
      {duration && (
        <span className="shrink-0 text-xs text-stone-400 pt-0.5">{duration}</span>
      )}
    </div>
  );
}
