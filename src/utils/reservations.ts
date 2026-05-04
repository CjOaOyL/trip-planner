import type { BookingOption, Reservation, ReservationStore } from '../types';

function storageKey(tripId: string) {
  return `reservations:${tripId}`;
}

function seedConsumedKey(tripId: string) {
  return `reservations-seed-consumed:${tripId}`;
}

// ─── Seed reservation type (for repo-defined defaults) ────────────────────────

export type SeedOption = Omit<BookingOption, 'createdAt' | 'updatedAt'>;
export type SeedReservation = Omit<
  Reservation,
  'tripId' | 'createdAt' | 'updatedAt' | 'options'
> & { options?: SeedOption[] };

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

// ─── Seed merge ──────────────────────────────────────────────────────────────

function getSeedConsumed(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seedConsumedKey(tripId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeedConsumed(tripId: string, ids: Set<string>): void {
  localStorage.setItem(seedConsumedKey(tripId), JSON.stringify([...ids]));
}

/**
 * Merges repo-defined seed reservations into localStorage.
 *
 * Behavior:
 * - Seed entries with new IDs are added to localStorage.
 * - Seed entries already present (by ID) are not re-applied — local edits win.
 * - Seed entries the user has deleted stay deleted (tracked in `seedConsumed`).
 * - Calling this multiple times is idempotent.
 */
export function mergeSeedReservations(tripId: string, seed: SeedReservation[]): void {
  if (!seed?.length) return;
  const store = getReservations(tripId);
  const consumed = getSeedConsumed(tripId);
  const now = new Date().toISOString();
  let dirty = false;

  for (const seedRes of seed) {
    const existing = store[seedRes.id];

    if (!existing) {
      // Reservation not in localStorage. If we've already added it once, skip
      // (user deleted it). Otherwise, add it wholesale.
      if (consumed.has(seedRes.id)) continue;
      const { options: seedOptions, ...rest } = seedRes;
      const newRes: Reservation = {
        ...rest,
        tripId,
        createdAt: now,
        updatedAt: now,
        options: (seedOptions ?? []).map((opt) => ({ ...opt, createdAt: now, updatedAt: now })),
      };
      store[seedRes.id] = newRes;
      consumed.add(seedRes.id);
      for (const opt of seedOptions ?? []) consumed.add(opt.id);
      dirty = true;
      continue;
    }

    // Reservation already present locally — only merge new options.
    consumed.add(seedRes.id);
    const existingOptionIds = new Set((existing.options ?? []).map((o) => o.id));
    const newOptions: BookingOption[] = [];
    for (const seedOpt of seedRes.options ?? []) {
      if (existingOptionIds.has(seedOpt.id)) {
        consumed.add(seedOpt.id);
        continue;
      }
      if (consumed.has(seedOpt.id)) continue; // user deleted this option previously
      newOptions.push({ ...seedOpt, createdAt: now, updatedAt: now });
      consumed.add(seedOpt.id);
    }
    if (newOptions.length) {
      store[seedRes.id] = {
        ...existing,
        options: [...(existing.options ?? []), ...newOptions],
        updatedAt: now,
      };
      dirty = true;
    }
  }

  if (dirty) {
    localStorage.setItem(storageKey(tripId), JSON.stringify(store));
  }
  saveSeedConsumed(tripId, consumed);
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
