import type { Reservation, ReservationStore } from '../types';

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
