/**
 * Favorites — persisted in localStorage.
 *
 *   Key:  `favorites:${tripId}`
 *   Value: string[]  (itinerary ids)
 */

function key(tripId: string) {
  return `favorites:${tripId}`;
}

export function getFavoriteIds(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(tripId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function isFavorite(tripId: string, itineraryId: string): boolean {
  return getFavoriteIds(tripId).has(itineraryId);
}

export function toggleFavorite(tripId: string, itineraryId: string): boolean {
  const ids = getFavoriteIds(tripId);
  const nowFav = !ids.has(itineraryId);
  if (nowFav) {
    ids.add(itineraryId);
  } else {
    ids.delete(itineraryId);
  }
  localStorage.setItem(key(tripId), JSON.stringify([...ids]));
  return nowFav;
}
