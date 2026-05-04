import type { BookingOption, Reservation, ReservationStore } from '../types';

function storageKey(tripId: string) {
  return `reservations:${tripId}`;
}

export function getReservations(tripId: string): ReservationStore {
  try {
    const raw = localStorage.getItem(storageKey(tripId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveReservation(tripId: string, reservation: Reservation): void {
  const store = getReservations(tripId);
  store[reservation.id] = { ...reservation, updatedAt: new Date().toISOString() };
  localStorage.setItem(storageKey(tripId), JSON.stringify(store));
}

export function deleteReservation(tripId: string, reservationId: string): void {
  const store = getReservations(tripId);
  delete store[reservationId];
  localStorage.setItem(storageKey(tripId), JSON.stringify(store));
}

export function createReservation(
  tripId: string,
  partial: Omit<Reservation, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
): Reservation {
  const now = new Date().toISOString();
  const reservation: Reservation = {
    ...partial,
    id: crypto.randomUUID(),
    tripId,
    createdAt: now,
    updatedAt: now,
  };
  saveReservation(tripId, reservation);
  return reservation;
}

// ─── Booking option helpers ──────────────────────────────────────────────────

export function addOption(
  tripId: string,
  reservationId: string,
  partial: Omit<BookingOption, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: BookingOption['status'] }
): BookingOption | null {
  const store = getReservations(tripId);
  const reservation = store[reservationId];
  if (!reservation) return null;

  const now = new Date().toISOString();
  const option: BookingOption = {
    ...partial,
    id: crypto.randomUUID(),
    status: partial.status ?? 'shortlist',
    createdAt: now,
    updatedAt: now,
  };

  const updated: Reservation = {
    ...reservation,
    options: [...(reservation.options ?? []), option],
    updatedAt: now,
  };
  saveReservation(tripId, updated);
  return option;
}

export function updateOption(
  tripId: string,
  reservationId: string,
  optionId: string,
  patch: Partial<Omit<BookingOption, 'id' | 'createdAt'>>
): void {
  const store = getReservations(tripId);
  const reservation = store[reservationId];
  if (!reservation?.options) return;

  const now = new Date().toISOString();
  const updated: Reservation = {
    ...reservation,
    options: reservation.options.map((o) =>
      o.id === optionId ? { ...o, ...patch, updatedAt: now } : o
    ),
    updatedAt: now,
  };
  saveReservation(tripId, updated);
}

export function deleteOption(tripId: string, reservationId: string, optionId: string): void {
  const store = getReservations(tripId);
  const reservation = store[reservationId];
  if (!reservation?.options) return;

  const updated: Reservation = {
    ...reservation,
    options: reservation.options.filter((o) => o.id !== optionId),
    updatedAt: new Date().toISOString(),
  };
  saveReservation(tripId, updated);
}

/**
 * Mark an option as "chosen" — sets all other options to "rejected", and
 * copies the option's url + cost into the parent reservation so existing UI
 * (booking link, cost display) keeps working.
 */
export function chooseOption(tripId: string, reservationId: string, optionId: string): void {
  const store = getReservations(tripId);
  const reservation = store[reservationId];
  if (!reservation?.options) return;

  const chosen = reservation.options.find((o) => o.id === optionId);
  if (!chosen) return;

  const now = new Date().toISOString();
  const updated: Reservation = {
    ...reservation,
    options: reservation.options.map((o) => ({
      ...o,
      status: o.id === optionId ? 'chosen' : o.status === 'chosen' ? 'shortlist' : o.status,
      updatedAt: now,
    })),
    bookingUrl: chosen.url,
    cost: chosen.totalPrice ?? reservation.cost,
    updatedAt: now,
  };
  saveReservation(tripId, updated);
}

/** Returns all reservations sorted by date, then category */
export function listReservations(tripId: string, itineraryId?: string): Reservation[] {
  const store = getReservations(tripId);
  let items = Object.values(store);
  if (itineraryId) {
    items = items.filter((r) => !r.itineraryId || r.itineraryId === itineraryId);
  }
  return items.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return a.createdAt.localeCompare(b.createdAt);
  });
}
