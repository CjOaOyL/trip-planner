import type { Reservation, ReservationStatus } from '../types';
import { saveReservation, deleteReservation } from '../utils/reservations';

interface Props {
  reservation: Reservation;
  onUpdate: () => void;
  onEdit: (reservation: Reservation) => void;
}

const STATUS_ORDER: ReservationStatus[] = [
  'needed', 'contacted', 'booked', 'confirmed', 'cancelled',
];

const STATUS_STYLE: Record<ReservationStatus, { bg: string; text: string; label: string }> = {
  needed:    { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Needed' },
  contacted: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Contacted' },
  booked:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Booked' },
  confirmed: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Confirmed ✓' },
  cancelled: { bg: 'bg-stone-100',  text: 'text-stone-400',  label: 'Cancelled' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  hotel:        '🛏',
  restaurant:   '🍽',
  'ski-rental': '🎿',
  'lift-tickets':'🎟',
  activity:     '🎯',
  tour:         '🗺',
  other:        '📌',
};

function nextStatus(current: ReservationStatus): ReservationStatus {
  const idx = STATUS_ORDER.indexOf(current);
  // Don't auto-advance past confirmed; don't advance cancelled
  if (current === 'confirmed' || current === 'cancelled') return current;
  return STATUS_ORDER[idx + 1];
}

export default function ReservationCard({ reservation, onUpdate, onEdit }: Props) {
  const style = STATUS_STYLE[reservation.status];
  const emoji = CATEGORY_EMOJI[reservation.category] ?? '📌';

  function advanceStatus() {
    const updated: Reservation = {
      ...reservation,
      status: nextStatus(reservation.status),
      updatedAt: new Date().toISOString(),
    };
    saveReservation(reservation.tripId, updated);
    onUpdate();
  }

  function handleDelete() {
    if (confirm(`Delete "${reservation.name}"?`)) {
      deleteReservation(reservation.tripId, reservation.id);
      onUpdate();
    }
  }

  return (
    <div className={`bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex gap-3 ${
      reservation.status === 'cancelled' ? 'opacity-50' : ''
    }`}>
      {/* Category emoji */}
      <div className="shrink-0 text-xl mt-0.5">{emoji}</div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-stone-800 text-sm">{reservation.name}</span>
          {/* Status badge — click to advance */}
          <button
            onClick={advanceStatus}
            title={reservation.status === 'confirmed' ? 'Already confirmed' : 'Click to advance status'}
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} transition-opacity hover:opacity-70`}
          >
            {style.label}
          </button>
        </div>

        {/* Date(s) */}
        {(reservation.checkIn || reservation.date) && (
          <div className="text-xs text-stone-500 mt-1">
            {reservation.checkIn && reservation.checkOut
              ? `${reservation.checkIn} → ${reservation.checkOut}`
              : reservation.date}
          </div>
        )}

        {/* Confirmation + cost row */}
        <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
          {reservation.confirmationNumber && (
            <span className="text-stone-500">
              Conf # <span className="font-mono font-semibold text-stone-700">{reservation.confirmationNumber}</span>
            </span>
          )}
          {reservation.cost != null && (
            <span className="text-stone-500">
              ${reservation.cost.toLocaleString()}
            </span>
          )}
          {reservation.bookingUrl && (
            <a
              href={reservation.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Booking link ↗
            </a>
          )}
        </div>

        {/* Notes */}
        {reservation.notes && (
          <p className="text-xs text-stone-400 italic mt-1.5">{reservation.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col gap-1">
        <button
          onClick={() => onEdit(reservation)}
          className="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded hover:bg-stone-100"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="text-xs text-stone-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
