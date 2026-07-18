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

export default function BookingOptionsCompare({
  tripId,
  reservationId,
  options,
  onChange,
  onEdit,
}: Props) {
  if (options.length === 0) return null;

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

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left text-stone-400 font-medium">
            <th className="px-2 font-medium">Option</th>
            <th className="px-2 font-medium text-right">Price</th>
            <th className="px-2 font-medium">Beds / Layout</th>
            <th className="px-2 font-medium">Rating</th>
            <th className="px-2 font-medium">Location</th>
            <th className="px-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const style = STATUS_STYLE[o.status] ?? STATUS_STYLE.shortlist;
            const dimmed = o.status === 'rejected';
            const unavailable = o.availability === 'unavailable';
            const rowBg = unavailable ? 'bg-red-50 ring-1 ring-red-200' : 'bg-stone-50';
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
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums align-top">
                  <div className="font-semibold text-stone-700">{formatPrice(o)}</div>
                  {o.pricePerNight != null && (
                    <div className="text-stone-400">{formatPrice({ ...o, totalPrice: o.pricePerNight })}/nt</div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-stone-600 align-top">
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
                <td className="px-2 py-1.5 text-stone-600 align-top max-w-[180px]">
                  <span className="line-clamp-2" title={o.location}>{o.location ?? '—'}</span>
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
