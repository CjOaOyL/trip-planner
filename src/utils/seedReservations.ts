import type { Trip, Itinerary, Reservation, ReservationCategory } from '../types';
import { getReservations, saveReservation } from './reservations';

const SEED_KEY = (tripId: string, itineraryId: string) =>
  `seeded:${tripId}:${itineraryId}`;

const MIGRATED_IDS_KEY = (tripId: string, itineraryId: string) =>
  `reservations-migrated-autoseed-ids:${tripId}:${itineraryId}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Deterministic ID for an itinerary-derived reservation. Same inputs → same ID
 * across every device, so the repo's reservations.json can attach options to
 * these reservations without per-device collisions.
 */
function autoSeedId(itineraryId: string, category: ReservationCategory, placeId: string): string {
  return `auto-${itineraryId}-${category}-${placeId}`;
}

// Reservation names produced by this auto-seed. Used by the migration to detect
// pre-existing random-UUID rows that should be renamed to deterministic IDs.
const AUTO_SEED_NAME_PATTERNS: RegExp[] = [
  /^Hotel near /,
  /^Lift tickets — /,
  /^Ski rental — /,
  /^Reservation — /,
  /^Entry \/ tickets — /,
  /^Tour — /,
];

function isAutoSeedShape(r: Reservation): boolean {
  return AUTO_SEED_NAME_PATTERNS.some((p) => p.test(r.name));
}

/**
 * One-time migration: rename pre-existing random-UUID reservations from this
 * itinerary's auto-seed to their deterministic IDs. Preserves user-edited
 * fields and merges any options. Idempotent — tracked via its own flag key.
 */
function migrateAutoSeedIds(trip: Trip, itinerary: Itinerary): void {
  const flag = MIGRATED_IDS_KEY(trip.meta.id, itinerary.id);
  if (localStorage.getItem(flag)) return;

  const store = getReservations(trip.meta.id);
  const now = new Date().toISOString();
  let dirty = false;

  for (const oldId of Object.keys(store)) {
    const r = store[oldId];
    if (r.itineraryId !== itinerary.id) continue;
    if (!r.placeId) continue;
    if (!isAutoSeedShape(r)) continue;

    const newId = autoSeedId(itinerary.id, r.category, r.placeId);
    if (oldId === newId) continue;

    const collision = store[newId];
    if (collision) {
      // Merge options into the deterministic entry, dedupe by option ID.
      const existingOptIds = new Set((collision.options ?? []).map((o) => o.id));
      const merged = [
        ...(collision.options ?? []),
        ...(r.options ?? []).filter((o) => !existingOptIds.has(o.id)),
      ];
      store[newId] = {
        ...collision,
        options: merged.length ? merged : collision.options,
        updatedAt: now,
      };
    } else {
      store[newId] = { ...r, id: newId, updatedAt: now };
    }
    delete store[oldId];
    dirty = true;
  }

  if (dirty) {
    localStorage.setItem(`reservations:${trip.meta.id}`, JSON.stringify(store));
  }
  localStorage.setItem(flag, '1');
}

function createAutoSeed(
  trip: Trip,
  itinerary: Itinerary,
  partial: Omit<Reservation, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>,
): void {
  if (!partial.placeId) return;
  const id = autoSeedId(itinerary.id, partial.category, partial.placeId);
  const now = new Date().toISOString();
  saveReservation(trip.meta.id, {
    ...partial,
    id,
    tripId: trip.meta.id,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Groups consecutive overnight stays at the same place into hotel spans.
 * Returns [{placeId, checkIn, checkOut, nights}]
 */
function buildHotelSpans(itinerary: Itinerary, startDate: string) {
  const spans: { placeId: string; checkIn: string; checkOut: string; nights: number }[] = [];
  let i = 0;
  const days = itinerary.days;

  while (i < days.length) {
    const placeId = days[i].overnightPlaceId;
    // Skip home origin
    if (placeId === 'hopewell-nj') { i++; continue; }

    let j = i;
    while (j < days.length && days[j].overnightPlaceId === placeId) j++;

    const nights = j - i;
    spans.push({
      placeId,
      checkIn: addDays(startDate, i),
      checkOut: addDays(startDate, j),
      nights,
    });
    i = j;
  }
  return spans;
}

/**
 * First-time auto-seed of reservations from itinerary data.
 * Also runs the deterministic-ID migration on every load until it has
 * processed the current store once.
 */
export function seedReservations(trip: Trip, itinerary: Itinerary): void {
  // Migrate pre-existing random-UUID auto-seed rows first, then proceed.
  migrateAutoSeedIds(trip, itinerary);

  const key = SEED_KEY(trip.meta.id, itinerary.id);
  if (localStorage.getItem(key)) return; // already seeded

  const existing = getReservations(trip.meta.id);
  const existingKeys = new Set(
    Object.values(existing).map((r) => `${r.itineraryId}|${r.placeId}|${r.category}`),
  );

  function needsSeeding(placeId: string, category: ReservationCategory): boolean {
    return !existingKeys.has(`${itinerary.id}|${placeId}|${category}`);
  }

  // ── Hotels ────────────────────────────────────────────────────────────────
  const hotelSpans = buildHotelSpans(itinerary, trip.meta.startDate);
  for (const span of hotelSpans) {
    const place = trip.places[span.placeId];
    if (!place) continue;
    if (!needsSeeding(span.placeId, 'hotel')) continue;

    createAutoSeed(trip, itinerary, {
      name: `Hotel near ${place.name} — ${span.nights} night${span.nights > 1 ? 's' : ''}`,
      category: 'hotel',
      status: 'needed',
      itineraryId: itinerary.id,
      placeId: span.placeId,
      checkIn: span.checkIn,
      checkOut: span.checkOut,
    });
  }

  // ── Ski lift tickets + rentals ────────────────────────────────────────────
  const skiResortsSeen = new Set<string>();
  for (const day of itinerary.days) {
    for (const seg of day.segments) {
      const place = trip.places[seg.placeId];
      if (place?.type !== 'ski-resort') continue;
      if (skiResortsSeen.has(seg.placeId)) continue;
      skiResortsSeen.add(seg.placeId);

      if (needsSeeding(seg.placeId, 'lift-tickets')) {
        createAutoSeed(trip, itinerary, {
          name: `Lift tickets — ${place.name}`,
          category: 'lift-tickets',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
      if (needsSeeding(seg.placeId, 'ski-rental')) {
        createAutoSeed(trip, itinerary, {
          name: `Ski rental — ${place.name}`,
          category: 'ski-rental',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
    }
  }

  // ── Restaurants ───────────────────────────────────────────────────────────
  const restaurantsSeen = new Set<string>();
  for (const day of itinerary.days) {
    for (const seg of day.segments) {
      const place = trip.places[seg.placeId];
      if (place?.type !== 'restaurant') continue;
      if (restaurantsSeen.has(seg.placeId)) continue;
      restaurantsSeen.add(seg.placeId);

      if (needsSeeding(seg.placeId, 'restaurant')) {
        createAutoSeed(trip, itinerary, {
          name: `Reservation — ${place.name}`,
          category: 'restaurant',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
    }
  }

  // ── Museums / attractions ─────────────────────────────────────────────────
  const museumsSeen = new Set<string>();
  for (const day of itinerary.days) {
    for (const seg of day.segments) {
      const place = trip.places[seg.placeId];
      if (!place || !['museum', 'attraction'].includes(place.type)) continue;
      if (museumsSeen.has(seg.placeId)) continue;
      museumsSeen.add(seg.placeId);

      if (needsSeeding(seg.placeId, 'activity')) {
        createAutoSeed(trip, itinerary, {
          name: `Entry / tickets — ${place.name}`,
          category: 'activity',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
    }
  }

  // ── Campus tours ─────────────────────────────────────────────────────────
  const toursSeen = new Set<string>();
  for (const day of itinerary.days) {
    for (const seg of day.segments) {
      const isTour =
        seg.activity.toLowerCase().includes('tour') ||
        seg.activity.toLowerCase().includes('admissions');
      if (!isTour) continue;
      if (toursSeen.has(seg.placeId)) continue;
      toursSeen.add(seg.placeId);

      if (needsSeeding(seg.placeId, 'tour')) {
        const place = trip.places[seg.placeId];
        createAutoSeed(trip, itinerary, {
          name: `Tour — ${place?.name ?? seg.placeId}`,
          category: 'tour',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
    }
  }

  localStorage.setItem(key, '1');
}
