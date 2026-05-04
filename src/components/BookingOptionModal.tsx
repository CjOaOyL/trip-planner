import { useEffect, useState } from 'react';
import type { BookingOption, ReservationCategory } from '../types';
import { addOption, updateOption } from '../utils/reservations';
import { scrapeListing } from '../utils/scrape';

interface Props {
  tripId: string;
  reservationId: string;
  category: ReservationCategory;
  existing: BookingOption | null;   // null = create mode
  onSave: () => void;
  onClose: () => void;
}

type FormState = {
  url: string;
  title: string;
  totalPrice: string;
  currency: string;
  pricePerNight: string;
  location: string;
  beds: string;
  bedrooms: string;
  bathrooms: string;
  guests: string;
  amenities: string;     // comma-separated input
  imageUrl: string;
  notes: string;
};

function blank(): FormState {
  return {
    url: '',
    title: '',
    totalPrice: '',
    currency: 'USD',
    pricePerNight: '',
    location: '',
    beds: '',
    bedrooms: '',
    bathrooms: '',
    guests: '',
    amenities: '',
    imageUrl: '',
    notes: '',
  };
}

function fromOption(o: BookingOption): FormState {
  return {
    url: o.url,
    title: o.title,
    totalPrice: o.totalPrice != null ? String(o.totalPrice) : '',
    currency: o.currency ?? 'USD',
    pricePerNight: o.pricePerNight != null ? String(o.pricePerNight) : '',
    location: o.location ?? '',
    beds: o.beds != null ? String(o.beds) : '',
    bedrooms: o.bedrooms != null ? String(o.bedrooms) : '',
    bathrooms: o.bathrooms != null ? String(o.bathrooms) : '',
    guests: o.guests != null ? String(o.guests) : '',
    amenities: (o.amenities ?? []).join(', '),
    imageUrl: o.imageUrl ?? '',
    notes: o.notes ?? '',
  };
}

function num(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function BookingOptionModal({
  tripId,
  reservationId,
  category,
  existing,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState<FormState>(blank());
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  useEffect(() => {
    setForm(existing ? fromOption(existing) : blank());
    setScrapeError(null);
  }, [existing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAutoFill() {
    if (!form.url.trim()) {
      setScrapeError('Paste a listing URL first.');
      return;
    }
    setScraping(true);
    setScrapeError(null);
    try {
      const data = await scrapeListing(form.url.trim(), category);
      setForm((prev) => ({
        ...prev,
        title: data.title ?? prev.title,
        totalPrice: data.totalPrice != null ? String(data.totalPrice) : prev.totalPrice,
        currency: data.currency ?? prev.currency,
        pricePerNight: data.pricePerNight != null ? String(data.pricePerNight) : prev.pricePerNight,
        location: data.location ?? prev.location,
        beds: data.beds != null ? String(data.beds) : prev.beds,
        bedrooms: data.bedrooms != null ? String(data.bedrooms) : prev.bedrooms,
        bathrooms: data.bathrooms != null ? String(data.bathrooms) : prev.bathrooms,
        guests: data.guests != null ? String(data.guests) : prev.guests,
        amenities: data.amenities?.length ? data.amenities.join(', ') : prev.amenities,
        imageUrl: data.imageUrl ?? prev.imageUrl,
        notes: data.notes ?? prev.notes,
      }));
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Auto-fill failed');
    } finally {
      setScraping(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.url.trim() || !form.title.trim()) return;

    const amenities = form.amenities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const partial = {
      url: form.url.trim(),
      title: form.title.trim(),
      totalPrice: num(form.totalPrice),
      currency: form.currency.trim() || undefined,
      pricePerNight: num(form.pricePerNight),
      location: form.location.trim() || undefined,
      beds: num(form.beds),
      bedrooms: num(form.bedrooms),
      bathrooms: num(form.bathrooms),
      guests: num(form.guests),
      amenities: amenities.length ? amenities : undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (existing) {
      updateOption(tripId, reservationId, existing.id, partial);
    } else {
      addOption(tripId, reservationId, partial);
    }
    onSave();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl pointer-events-auto flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h2 className="font-bold text-stone-800">
              {existing ? 'Edit Option' : 'Add Booking Option'}
            </h2>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* URL + auto-fill */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Listing URL *</label>
              <div className="flex gap-2">
                <input
                  required
                  type="url"
                  value={form.url}
                  onChange={(e) => set('url', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={scraping || !form.url.trim()}
                  className="bg-stone-800 hover:bg-stone-700 disabled:bg-stone-300 text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors whitespace-nowrap"
                >
                  {scraping ? 'Reading…' : '✨ Auto-fill'}
                </button>
              </div>
              {scrapeError && (
                <p className="text-xs text-red-600 mt-1">{scrapeError}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Studio apartment near Old Town"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Price row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Total price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalPrice}
                  onChange={(e) => set('totalPrice', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Per night</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pricePerNight}
                  onChange={(e) => set('pricePerNight', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Currency</label>
                <input
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value.toUpperCase())}
                  maxLength={3}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 uppercase"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Address, neighborhood, or city"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Capacity row */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Beds</label>
                <input
                  type="number" min="0" step="1"
                  value={form.beds}
                  onChange={(e) => set('beds', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Bedrooms</label>
                <input
                  type="number" min="0" step="1"
                  value={form.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Baths</label>
                <input
                  type="number" min="0" step="0.5"
                  value={form.bathrooms}
                  onChange={(e) => set('bathrooms', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Guests</label>
                <input
                  type="number" min="0" step="1"
                  value={form.guests}
                  onChange={(e) => set('guests', e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">
                Amenities <span className="text-stone-400 font-normal">(comma-separated)</span>
              </label>
              <input
                value={form.amenities}
                onChange={(e) => set('amenities', e.target.value)}
                placeholder="WiFi, Kitchen, Pool, Parking"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Image preview */}
            {form.imageUrl && (
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Image</label>
                <img
                  src={form.imageUrl}
                  alt=""
                  className="w-full max-h-48 object-cover rounded-lg border border-stone-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              />
            </div>
          </form>

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
              {existing ? 'Save Changes' : 'Add Option'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
