function key(tripId: string) {
  return `archived:${tripId}`;
}

export function getArchivedIds(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(tripId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function archiveItinerary(tripId: string, itineraryId: string): void {
  const ids = getArchivedIds(tripId);
  ids.add(itineraryId);
  localStorage.setItem(key(tripId), JSON.stringify([...ids]));
}

export function unarchiveItinerary(tripId: string, itineraryId: string): void {
  const ids = getArchivedIds(tripId);
  ids.delete(itineraryId);
  localStorage.setItem(key(tripId), JSON.stringify([...ids]));
}

export function isArchived(tripId: string, itineraryId: string, defaultArchived?: boolean): boolean {
  const stored = localStorage.getItem(key(tripId));
  // If user has never touched archive state, fall back to the JSON default
  if (stored === null) return defaultArchived ?? false;
  return getArchivedIds(tripId).has(itineraryId);
}
