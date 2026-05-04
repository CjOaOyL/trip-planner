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

// ─── Field-fill merge helpers ────────────────────────────────────────────────

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

const OPTION_FILLABLE_FIELDS: (keyof BookingOption)[] = [
  'title', 'totalPrice', 'currency', 'pricePerNight',
  'location', 'beds', 'bedrooms', 'bathrooms', 'guests',
  'amenities', 'imageUrl', 'notes', 'scrapedAt',
];

const RESERVATION_FILLABLE_FIELDS: (keyof Reservation)[] = [
  'placeId', 'date', 'checkIn', 'checkOut', 'confirmationNumber',
  'cost', 'notes', 'bookingUrl', 'visitorId',
];

/**
 * Returns a copy of `existing` with empty fields filled from `incoming`.
 * Never overwrites a field that already has a value — local edits always win.
 */
function fillEmptyFields<T extends object>(
  existing: T,
  incoming: Partial<T>,
  fields: (keyof T)[],
): { merged: T; changed: boolean } {
  const merged = { ...existing };
  let changed = false;
  for (const f of fields) {
    if (isEmpty(merged[f]) && !isEmpty(incoming[f])) {
      merged[f] = incoming[f] as T[keyof T];
      changed = true;
    }
  }
  return { merged, changed };
}

function fillOption(existing: BookingOption, incoming: Partial<BookingOption>): BookingOption {
  const { merged, changed } = fillEmptyFields(existing, incoming, OPTION_FILLABLE_FIELDS);
  return changed ? { ...merged, updatedAt: new Date().toISOString() } : existing;
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

    // Reservation already present locally — fill empty fields and merge options.
    consumed.add(seedRes.id);
    const existingOptions = existing.options ?? [];
    const existingOptionMap = new Map(existingOptions.map((o) => [o.id, o]));
    const mergedOptions: BookingOption[] = [];
    let optionsChanged = false;

    for (const opt of existingOptions) {
      const seedMatch = (seedRes.options ?? []).find((o) => o.id === opt.id);
      if (seedMatch) {
        const filled = fillOption(opt, seedMatch);
        if (filled !== opt) optionsChanged = true;
        mergedOptions.push(filled);
        consumed.add(opt.id);
      } else {
        mergedOptions.push(opt);
      }
    }

    for (const seedOpt of seedRes.options ?? []) {
      if (existingOptionMap.has(seedOpt.id)) continue;
      if (consumed.has(seedOpt.id)) continue;
      mergedOptions.push({ ...seedOpt, createdAt: now, updatedAt: now });
      consumed.add(seedOpt.id);
      optionsChanged = true;
    }

    const fillResult = fillEmptyFields(
      existing,
      seedRes as Partial<Reservation>,
      RESERVATION_FILLABLE_FIELDS,
    );
    if (optionsChanged || fillResult.changed) {
      store[seedRes.id] = {
        ...fillResult.merged,
        options: mergedOptions,
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

// ─── Export / Import (round-trip via clipboard or chat) ──────────────────────

export interface ImportSummary {
  reservationsAdded: number;
  reservationsUpdated: number;  // had existing entry, filled at least one empty field
  optionsAdded: number;
  optionsUpdated: number;
}

/** Returns a pretty-printed JSON dump of all reservations for a trip. */
export function exportReservations(tripId: string): string {
  const store = getReservations(tripId);
  return JSON.stringify(Object.values(store), null, 2);
}

/**
 * Imports a JSON payload of reservations into localStorage using field-fill
 * semantics — empty fields are filled in from the import, populated fields
 * are preserved. Reservations / options not present locally are added.
 *
 * Throws on malformed JSON or shape mismatches.
 */
export function importReservations(tripId: string, json: string): ImportSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of reservations.');
  }

  const incoming = parsed as Reservation[];
  const store = getReservations(tripId);
  const now = new Date().toISOString();
  const summary: ImportSummary = {
    reservationsAdded: 0,
    reservationsUpdated: 0,
    optionsAdded: 0,
    optionsUpdated: 0,
  };

  for (const inc of incoming) {
    if (!inc?.id || typeof inc.id !== 'string') {
      throw new Error('Each reservation must have a string `id`.');
    }
    const existing = store[inc.id];

    if (!existing) {
      // New reservation — add wholesale (rewriting tripId + timestamps)
      const options = (inc.options ?? []).map((o) => ({
        ...o,
        createdAt: o.createdAt ?? now,
        updatedAt: o.updatedAt ?? now,
      }));
      store[inc.id] = {
        ...inc,
        tripId,
        options,
        createdAt: inc.createdAt ?? now,
        updatedAt: now,
      };
      summary.reservationsAdded += 1;
      summary.optionsAdded += options.length;
      continue;
    }

    // Existing — field-fill the reservation, then handle options
    const existingOptions = existing.options ?? [];
    const existingOptionMap = new Map(existingOptions.map((o) => [o.id, o]));
    const mergedOptions: BookingOption[] = [];
    let optionsChanged = false;

    for (const opt of existingOptions) {
      const incMatch = (inc.options ?? []).find((o) => o.id === opt.id);
      if (incMatch) {
        const filled = fillOption(opt, incMatch);
        if (filled !== opt) {
          summary.optionsUpdated += 1;
          optionsChanged = true;
        }
        mergedOptions.push(filled);
      } else {
        mergedOptions.push(opt);
      }
    }
    for (const incOpt of inc.options ?? []) {
      if (existingOptionMap.has(incOpt.id)) continue;
      mergedOptions.push({
        ...incOpt,
        createdAt: incOpt.createdAt ?? now,
        updatedAt: incOpt.updatedAt ?? now,
      });
      summary.optionsAdded += 1;
      optionsChanged = true;
    }

    const fillResult = fillEmptyFields(existing, inc, RESERVATION_FILLABLE_FIELDS);
    if (optionsChanged || fillResult.changed) {
      store[inc.id] = {
        ...fillResult.merged,
        options: mergedOptions,
        updatedAt: now,
      };
      if (fillResult.changed) summary.reservationsUpdated += 1;
    }
  }

  localStorage.setItem(storageKey(tripId), JSON.stringify(store));
  return summary;
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
