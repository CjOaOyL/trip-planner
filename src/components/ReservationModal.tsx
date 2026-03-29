import { useEffect, useState } from 'react';
import type { Reservation, ReservationCategory, ReservationStatus } from '../types';
import { createReservation, saveReservation } from '../utils/reservations';

interface Props {
  tripId: string;
  itineraryId: string;
  existing: Reservation | null;  // null = create mode
  onSave: () => void;
  onClose: () => void;
}

const CATEGORIES: { value: ReservationCategory; label: string; emoji: string }[] = [
  { value: 'hotel',        label: 'Hotel / Lodging',  emoji: '🛏' },
  { value: 'restaurant',   label: 'Restaurant',       emoji: '🍽' },
  { value: 'ski-rental',   label: 'Ski Rental',       emoji: '🎿' },
  { value: 'lift-tickets', label: 'Lift Tickets',     emoji: '🎟' },
  { value: 'activity',     label: 'Activity',         emoji: '🎯' },
  { value: 'tour',         label: 'Tour',             emoji: '🗺' },
  { value: 'other',        label: 'Other',            emoji: '📌' },
];

const STATUSES: { value: ReservationStatus; label: string }[] = [
  { value: 'needed',    label: 'Needed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked',    label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

type FormState = {
  name: string;
  category: ReservationCategory;
  status: ReservationStatus;
  date: string;
  checkIn: string;
  checkOut: string;
  confirmationNumber: string;
  cost: string;
  bookingUrl: string;
  notes: string;
};

function blankForm(): FormState {
  return {
    name: '',
    category: 'hotel',
    status: 'needed',
    date: '',
    checkIn: '',
    checkOut: '',
    confirmationNumber: '',
    cost: '',
    bookingUrl: '',
    notes: '',
  };
}

function reservationToForm(r: Reservation): FormState {
  return {
    name: r.name,
    category: r.category,
    status: r.status,
    date: r.date ?? '',
    checkIn: r.checkIn ?? '',
    checkOut: r.checkOut ?? '',
    confirmationNumber: r.confirmationNumber ?? '',
    cost: r.cost != null ? String(r.cost) : '',
    bookingUrl: r.bookingUrl ?? '',
    notes: r.notes ?? '',
  };
}

export default function ReservationModal({ tripId, itineraryId, existing, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(blankForm());

  useEffect(() => {
    setForm(existing ? reservationToForm(existing) : blankForm());
  }, [existing]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const partial = {
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      itineraryId,
      date: form.date || undefined,
      checkIn: form.checkIn || undefined,
      checkOut: form.checkOut || undefined,
      confirmationNumber: form.confirmationNumber || undefined,
      cost: form.cost ? parseFloat(form.cost) : undefined,
      bookingUrl: form.bookingUrl || undefined,
      notes: form.notes || undefined,
    };

    if (existing) {
      saveReservation(tripId, { ...existing, ...partial, updatedAt: new Date().toISOString() });
    } else {
      createReservation(tripId, partial);
    }
    onSave();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h2 className="font-bold text-stone-800">
              {existing ? 'Edit Reservation' : 'Add Reservation'}
            </h2>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Hotel Vermont — 2 nights"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Category + Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value as ReservationCategory)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as ReservationStatus)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Check-in / Date</label>
                <input
                  type="date"
                  value={form.checkIn || form.date}
                  onChange={(e) => { set('checkIn', e.target.value); set('date', e.target.value); }}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Check-out</label>
                <input
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => set('checkOut', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            {/* Confirmation + Cost row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Confirmation #</label>
                <input
                  value={form.confirmationNumber}
                  onChange={(e) => set('confirmationNumber', e.target.value)}
                  placeholder="ABC123"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Cost ($)</label>
                <input
                  type="number"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            {/* Booking URL */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Booking URL</label>
              <input
                type="url"
                value={form.bookingUrl}
                onChange={(e) => set('bookingUrl', e.target.value)}
                placeholder="https://..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="Any details, deadlines, or reminders…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-stone-100">
            <button
              onClick={onClose}
              className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              {existing ? 'Save Changes' : 'Add Reservation'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
