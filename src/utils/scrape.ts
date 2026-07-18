import type { BookingOption, ReservationCategory } from '../types';

export type ScrapedFields = Partial<
  Omit<BookingOption, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'url'>
>;

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export async function scrapeListing(
  url: string,
  category?: ReservationCategory
): Promise<ScrapedFields> {
  // The app is hosted on GitHub Pages (static). Auto-fill needs a server
  // endpoint, so it only works if VITE_API_BASE points at one.
  if (!API_BASE && !import.meta.env.DEV) {
    throw new Error(
      'Auto-fill is unavailable on this static deployment — fill fields manually.'
    );
  }

  const res = await fetch(`${API_BASE}/api/scrape-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, category }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Scrape failed (${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as ScrapedFields;
}
