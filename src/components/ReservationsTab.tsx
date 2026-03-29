import { useState, useCallback, useEffect } from 'react';
import type { Reservation, ReservationCategory, ReservationStatus, Place, Trip, Itinerary } from '../types';
import { listReservations } from '../utils/reservations';
import { seedReservations } from '../utils/seedReservations';
import ReservationCard from './ReservationCard';
import ReservationModal from './ReservationModal';

interface Props {
  tripId: string;
  itineraryId: string;
  itineraryName: string;
  places: Record<string, Place>;
  trip?: Trip;
  itinerary?: Itinerary;
}

const CATEGORY_ORDER: ReservationCategory[] = [
  'hotel', 'lift-tickets', 'ski-rental', 'restaurant', 'activity', 'tour', 'other',
];

const CATEGORY_LABEL: Record<ReservationCategory, string> = {
  hotel:          '🛏 Hotels & Lodging',
  restaurant:     '🍽 Restaurants',
  'ski-rental':   '🎿 Ski Rentals',
  'lift-tickets': '🎟 Lift Tickets',
  activity:       '🎯 Activities',
  tour:           '🗺 Tours',
  other:          '📌 Other',
};

const STATUS_FILTER_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'needed',    label: 'Needed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked',    label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
];

export default function ReservationsTab({ tripId, itineraryId, itineraryName, trip, itinerary }: Props) {
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [editTarget, setEditTarget] = useState<Reservation | null | 'new'>('new' as unknown as null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tick, setTick] = useState(0); // increment to re-read localStorage

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Auto-seed on first open if trip + itinerary data available
  useEffect(() => {
    if (trip && itinerary) {
      seedReservations(trip, itinerary);
      refresh();
    }
  }, [trip, itinerary]); // eslint-disable-line react-hooks/exhaustive-deps

  const allReservations = listReservations(tripId, itineraryId);
  const filtered = statusFilter === 'all'
    ? allReservations
    : allReservations.filter((r) => r.status === statusFilter);

  // Group by category
  const grouped = new Map<ReservationCategory, Reservation[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const r of filtered) {
    grouped.get(r.category)?.push(r);
  }

  const totalCost = allReservations.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const confirmedCount = allReservations.filter((r) => r.status === 'confirmed').length;
  const neededCount = allReservations.filter((r) => r.status === 'needed').length;

  function openNew() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(r: Reservation) {
    setEditTarget(r);
    setModalOpen(true);
  }

  function handleSave() {
    setModalOpen(false);
    refresh();
  }

  // Suppress unused warning — tick forces re-render
  void tick;

  return (
    <div>
      {/* ── Summary bar ── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-stone-800">{allReservations.length}</div>
          <div className="text-xs text-stone-400 mt-0.5">Total items</div>
        </div>
        <div className="flex-1 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-700">{confirmedCount}</div>
          <div className="text-xs text-green-500 mt-0.5">Confirmed</div>
        </div>
        <div className="flex-1 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-600">{neededCount}</div>
          <div className="text-xs text-red-400 mt-0.5">Still needed</div>
        </div>
        {totalCost > 0 && (
          <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-700">${totalCost.toLocaleString()}</div>
            <div className="text-xs text-amber-500 mt-0.5">Tracked cost</div>
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Status filter pills */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={openNew}
          className="ml-auto bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Reservation
        </button>
      </div>

      {/* ── Empty state ── */}
      {allReservations.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">🗒</div>
          <div className="font-medium text-stone-500 mb-1">No reservations yet</div>
          <div className="text-sm mb-4">
            Track hotels, restaurants, lift tickets, ski rentals, and more for{' '}
            <span className="font-medium">{itineraryName}</span>.
          </div>
          <button
            onClick={openNew}
            className="bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Add your first reservation
          </button>
        </div>
      )}

      {/* ── Grouped lists ── */}
      {allReservations.length > 0 && (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                  {CATEGORY_LABEL[cat]}
                </h3>
                <div className="space-y-2">
                  {items.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onUpdate={refresh}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <ReservationModal
          tripId={tripId}
          itineraryId={itineraryId}
          existing={editTarget as Reservation | null}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
