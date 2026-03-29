import type { Trip, Itinerary, ReservationCategory } from '../types';
import { getReservations, createReservation } from './reservations';

const SEED_KEY = (tripId: string, itineraryId: string) =>
  `seeded:${tripId}:${itineraryId}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
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
 * Safe to call multiple times — checks a seeded flag in localStorage.
 */
export function seedReservations(trip: Trip, itinerary: Itinerary): void {
  const key = SEED_KEY(trip.meta.id, itinerary.id);
  if (localStorage.getItem(key)) return; // already seeded

  const existing = getReservations(trip.meta.id);
  // Build set of (itineraryId + placeId + category) already present
  const existingKeys = new Set(
    Object.values(existing).map((r) => `${r.itineraryId}|${r.placeId}|${r.category}`)
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

    createReservation(trip.meta.id, {
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
        createReservation(trip.meta.id, {
          name: `Lift tickets — ${place.name}`,
          category: 'lift-tickets',
          status: 'needed',
          itineraryId: itinerary.id,
          placeId: seg.placeId,
          date: addDays(trip.meta.startDate, itinerary.days.indexOf(day)),
        });
      }
      if (needsSeeding(seg.placeId, 'ski-rental')) {
        createReservation(trip.meta.id, {
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
        createReservation(trip.meta.id, {
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
        createReservation(trip.meta.id, {
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
        createReservation(trip.meta.id, {
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
