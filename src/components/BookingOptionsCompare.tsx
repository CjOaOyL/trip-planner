import { useEffect, useMemo, useState } from 'react';
import type { BookingOption, BookingOptionStatus } from '../types';
import { chooseOption, deleteOption, updateOption } from '../utils/reservations';

interface Props {
  tripId: string;
  reservationId: string;
  options: BookingOption[];
  onChange: () => void;
  onEdit: (option: BookingOption) => void;
}

const STATUS_STYLE: Record<BookingOptionStatus, { bg: string; text: string; label: string }> = {
  shortlist: { bg: 'bg-stone-100',  text: 'text-stone-600', label: 'Shortlist' },
  chosen:    { bg: 'bg-green-100',  text: 'text-green-700', label: 'Chosen ✓' },
  rejected:  { bg: 'bg-stone-50',   text: 'text-stone-400', label: 'Rejected' },
};

type SortKey = 'price' | 'beds' | 'rating' | 'site';
type SortDir = 'asc' | 'desc';

function formatPrice(o: BookingOption): string {
  if (o.totalPrice == null) return '—';
  const currency = o.currency ?? 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(o.totalPrice);
  } catch {
    return `${currency} ${o.totalPrice.toLocaleString()}`;
  }
}

function formatBeds(o: BookingOption): string {
  const parts: string[] = [];
  if (o.bedrooms != null) parts.push(`${o.bedrooms} BR`);
  if (o.beds != null) parts.push(`${o.beds} bed${o.beds === 1 ? '' : 's'}`);
  if (o.bathrooms != null) parts.push(`${o.bathrooms} BA`);
  return parts.join(' · ') || '—';
}

/** Human-readable listing site derived from the option URL. */
export function listingSite(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('airbnb')) return 'Airbnb';
    if (host.includes('vrbo')) return 'VRBO';
    if (host.includes('booking.com')) return 'Booking.com';
    if (host.includes('expedia')) return 'Expedia';
    if (host.includes('hotels.com')) return 'Hotels.com';
    if (host.includes('evolve')) return 'Evolve';
    if (host.includes('vacasa')) return 'Vacasa';
    if (host.includes('marriott')) return 'Marriott';
    if (host.includes('hilton')) return 'Hilton';
    // Fallback: second-level domain, capitalized
    const parts = host.split('.');
    const core = parts.length >= 2 ? parts[parts.length - 2] : host;
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return '—';
  }
}

const SITE_STYLE: Record<string, string> = {
  Airbnb: 'bg-rose-100 text-rose-700',
  VRBO: 'bg-sky-100 text-sky-700',
  'Booking.com': 'bg-blue-100 text-blue-700',
  Expedia: 'bg-yellow-100 text-yellow-800',
};

/** Value used for sorting; undefined sorts last regardless of direction. */
function sortValue(o: BookingOption, key: SortKey): number | string | undefined {
  switch (key) {
    case 'price': return o.totalPrice ?? undefined;
    case 'beds': return o.beds ?? o.bedrooms ?? undefined;
    case 'rating': return o.rating ?? undefined;
    case 'site': return listingSite(o.url);
  }
}

/** Inline-editable notes cell: click to edit, blur / Cmd+Enter to save, Esc to cancel. */
function NotesCell({
  value,
  onSave,
}: {
  value: string | undefined;
  onSave: (next: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? '').trim()) onSave(next || undefined);
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
        }}
        rows={4}
        className="w-full min-w-[220px] border border-stone-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300 resize-y bg-white"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit notes"
      className="text-left w-full min-w-[200px] max-w-[320px] whitespace-pre-wrap text-stone-600 hover:bg-white/70 rounded px-1 -mx-1 py-0.5"
    >
      {value ? (
        <span className="line-clamp-4">{value}</span>
      ) : (
        <span className="text-stone-300 italic">Add a note…</span>
      )}
    </button>
  );
}

export default function BookingOptionsCompare({
  tripId,
  reservationId,
  options,
  onChange,
  onEdit,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return options;
    const withIdx = options.map((o, i) => ({ o, i }));
    withIdx.sort((a, b) => {
      const av = sortValue(a.o, sortKey);
      const bv = sortValue(b.o, sortKey);
      // Missing values always sink to the bottom.
      if (av == null && bv == null) return a.i - b.i;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      if (cmp === 0) return a.i - b.i;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return withIdx.map((x) => x.o);
  }, [options, sortKey, sortDir]);

  if (options.length === 0) return null;

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      // Sensible first click: cheapest first, best-rated first, most beds first.
      setSortDir(key === 'rating' || key === 'beds' ? 'desc' : 'asc');
      return;
    }
    if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') { setSortKey(null); setSortDir('asc'); }
  }

  function handleChoose(id: string) {
    chooseOption(tripId, reservationId, id);
    onChange();
  }

  function handleReject(option: BookingOption) {
    const next: BookingOptionStatus = option.status === 'rejected' ? 'shortlist' : 'rejected';
    updateOption(tripId, reservationId, option.id, { status: next });
    onChange();
  }

  function handleDelete(option: BookingOption) {
    if (confirm(`Remove "${option.title}" from options?`)) {
      deleteOption(tripId, reservationId, option.id);
      onChange();
    }
  }

  function handleNotes(option: BookingOption, notes: string | undefined) {
    updateOption(tripId, reservationId, option.id, { notes });
    onChange();
  }

  function SortHeader({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === k;
    const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '↕';
    return (
      <th className={`px-2 font-medium ${align === 'right' ? 'text-right' : ''}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          title={active ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'} — click to ${sortDir === 'asc' ? 'reverse' : 'clear'}` : `Sort by ${label.toLowerCase()}`}
          className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-stone-100 hover:text-stone-700 ${active ? 'text-stone-800' : ''}`}
        >
          {label}
          <span className={`text-[10px] ${active ? 'text-stone-700' : 'text-stone-300'}`}>{arrow}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left text-stone-400 font-medium">
            <th className="px-2 font-medium">Option</th>
            <SortHeader label="Site" k="site" />
            <SortHeader label="Price" k="price" align="right" />
            <SortHeader label="Beds / Layout" k="beds" />
            <SortHeader label="Rating" k="rating" />
            <th className="px-2 font-medium">Key review summary</th>
            <th className="px-2 font-medium">Notes</th>
            <th className="px-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => {
            const style = STATUS_STYLE[o.status] ?? STATUS_STYLE.shortlist;
            const dimmed = o.status === 'rejected';
            const unavailable = o.availability === 'unavailable';
            const rowBg = unavailable ? 'bg-red-50 ring-1 ring-red-200' : 'bg-stone-50';
            const site = listingSite(o.url);
            const siteStyle = SITE_STYLE[site] ?? 'bg-stone-200 text-stone-700';
            return (
              <tr key={o.id} className={`${rowBg} ${dimmed ? 'opacity-50' : ''}`}>
                <td className="px-2 py-1.5 rounded-l-lg align-top">
                  <div className="flex items-start gap-2">
                    {o.imageUrl && (
                      <img
                        src={o.imageUrl}
                        alt=""
                        className={`w-10 h-10 object-cover rounded shrink-0 ${unavailable ? 'grayscale opacity-60' : ''}`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`font-medium hover:underline block truncate max-w-[180px] ${
                          unavailable
                            ? 'text-red-700 line-through hover:text-red-800'
                            : 'text-stone-700 hover:text-blue-600'
                        }`}
                        title={o.title}
                      >
                        {o.title} ↗
                      </a>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {unavailable ? (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold"
                            title={
                              o.availabilityCheckedAt
                                ? `Checked ${new Date(o.availabilityCheckedAt).toLocaleDateString()}`
                                : 'Marked unavailable'
                            }
                          >
                            ⚠ Unavailable
                          </span>
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        )}
                      </div>
                      {o.location && (
                        <div className="text-stone-400 truncate max-w-[180px] mt-0.5" title={o.location}>
                          {o.location}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5 align-top whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${siteStyle}`}>{site}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums align-top whitespace-nowrap">
                  <div className="font-semibold text-stone-700">{formatPrice(o)}</div>
                  {o.pricePerNight != null && (
                    <div className="text-stone-400">{formatPrice({ ...o, totalPrice: o.pricePerNight })}/nt</div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-stone-600 align-top whitespace-nowrap">
                  {formatBeds(o)}
                  {o.guests != null && (
                    <div className="text-stone-400">Sleeps {o.guests}</div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-stone-600 align-top whitespace-nowrap">
                  {o.rating != null ? (
                    <>
                      <div className="font-semibold text-stone-700">
                        ★ {o.rating.toFixed(2)}
                      </div>
                      {o.reviewCount != null && (
                        <div className="text-stone-400">{o.reviewCount} review{o.reviewCount === 1 ? '' : 's'}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {o.isGuestFavorite && (
                          <span className="inline-block px-1 py-0 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold" title="Airbnb Guest Favorite">
                            ♥ Favorite
                          </span>
                        )}
                        {o.isSuperhost && (
                          <span className="inline-block px-1 py-0 rounded bg-rose-100 text-rose-700 text-[10px] font-semibold" title="Superhost / Premier Host">
                            Superhost
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-stone-600 align-top min-w-[200px] max-w-[300px]">
                  {o.reviewSummary ? (
                    <span className="line-clamp-4 whitespace-pre-wrap" title={o.reviewSummary}>{o.reviewSummary}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEdit(o)}
                      className="text-stone-300 italic hover:text-stone-500"
                      title="Add a review summary (opens the editor)"
                    >
                      Add summary…
                    </button>
                  )}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <NotesCell value={o.notes} onSave={(n) => handleNotes(o, n)} />
                </td>
                <td className="px-2 py-1.5 rounded-r-lg align-top">
                  <div className="flex items-center gap-1 justify-end">
                    {o.status !== 'chosen' && (
                      <button
                        onClick={() => handleChoose(o.id)}
                        title="Choose this option"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 px-1.5 py-0.5 rounded"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(o)}
                      title={o.status === 'rejected' ? 'Restore to shortlist' : 'Reject'}
                      className="text-stone-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded"
                    >
                      {o.status === 'rejected' ? '↺' : '✗'}
                    </button>
                    <button
                      onClick={() => onEdit(o)}
                      title="Edit"
                      className="text-stone-400 hover:text-stone-700 hover:bg-stone-100 px-1.5 py-0.5 rounded"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(o)}
                      title="Delete"
                      className="text-stone-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
