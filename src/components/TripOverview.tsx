import { useMemo } from 'react';
import type { Itinerary, Place, Day, Segment, TimeSlot } from '../types';
import { inferSlot, SLOT_ORDER, SLOT_LABEL, SLOT_BG } from '../utils/slotUtils';

interface Props {
  itinerary: Itinerary;
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

interface SlottedSegment {
  segment: Segment;
  slot: TimeSlot;
  place?: Place;
}

interface SlottedDay {
  day: Day;
  bySlot: Map<TimeSlot, SlottedSegment[]>;
}

function buildSlottedDays(itinerary: Itinerary, places: Record<string, Place>): SlottedDay[] {
  return itinerary.days.map((day) => {
    const bySlot = new Map<TimeSlot, SlottedSegment[]>();
    for (const slot of SLOT_ORDER) bySlot.set(slot, []);

    for (const segment of day.segments) {
      const place = places[segment.placeId];
      const slot = inferSlot(segment, place?.type);
      bySlot.get(slot)!.push({ segment, slot, place });
    }

    // Add driving legs as travel segments
    for (const leg of day.legs) {
      const fromPlace = places[leg.fromPlaceId];
      const toPlace   = places[leg.toPlaceId];
      const fakeSegment: Segment = {
        time: '—',
        placeId: leg.fromPlaceId,
        activity: `Drive: ${fromPlace?.name ?? '?'} → ${toPlace?.name ?? '?'} (${Math.floor(leg.drivingMinutes / 60)}h${leg.drivingMinutes % 60 ? ` ${leg.drivingMinutes % 60}m` : ''})`,
        durationMinutes: leg.drivingMinutes,
      };
      bySlot.get('travel')!.push({ segment: fakeSegment, slot: 'travel', place: fromPlace });
    }

    return { day, bySlot };
  });
}

// Which slots actually have content across the whole itinerary?
function activeSlotsFor(days: SlottedDay[]): TimeSlot[] {
  return SLOT_ORDER.filter((slot) =>
    days.some((d) => (d.bySlot.get(slot)?.length ?? 0) > 0)
  );
}

export default function TripOverview({ itinerary, places, onPlaceClick }: Props) {
  const slottedDays = useMemo(
    () => buildSlottedDays(itinerary, places),
    [itinerary, places]
  );
  const activeSlots = useMemo(() => activeSlotsFor(slottedDays), [slottedDays]);

  return (
    <div>
      <p className="text-xs text-stone-400 mb-4">
        All {itinerary.days.length} days side-by-side. Click any place to see details. Scroll right for more days.
      </p>

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto pb-4">
        <table className="border-separate border-spacing-0 min-w-full text-xs">
          {/* ── Day headers ── */}
          <thead>
            <tr>
              {/* Slot label column */}
              <th className="sticky left-0 z-20 bg-stone-50 border-b border-r border-stone-200 p-0">
                <div className="w-28 h-14" />
              </th>
              {slottedDays.map(({ day }, i) => (
                <th
                  key={day.id}
                  className="border-b border-r border-stone-200 bg-white min-w-[180px] max-w-[220px]"
                >
                  <div className="px-3 py-2 text-left">
                    <div className="font-bold text-stone-700">Day {i + 1}</div>
                    <div className="text-stone-400 font-normal truncate">{day.theme}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Slot rows ── */}
          <tbody>
            {activeSlots.map((slot) => (
              <tr key={slot}>
                {/* Sticky slot label */}
                <td className={`sticky left-0 z-10 border-b border-r border-stone-200 ${SLOT_BG[slot]}`}>
                  <div className="w-28 px-3 py-2 font-semibold text-stone-600 whitespace-nowrap">
                    {SLOT_LABEL[slot]}
                  </div>
                </td>

                {/* Day cells */}
                {slottedDays.map(({ day, bySlot }) => {
                  const segs = bySlot.get(slot) ?? [];
                  return (
                    <td
                      key={day.id}
                      className={`border-b border-r border-stone-200 align-top ${SLOT_BG[slot]} min-w-[180px]`}
                    >
                      {segs.length === 0 ? (
                        <div className="px-3 py-2 text-stone-300 italic">—</div>
                      ) : (
                        <div className="px-2 py-1.5 space-y-1.5">
                          {segs.map((ss, i) => (
                            <SlotCell
                              key={i}
                              ss={ss}
                              onPlaceClick={onPlaceClick}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Overnight row */}
            <tr>
              <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-indigo-50">
                <div className="w-28 px-3 py-2 font-semibold text-indigo-700 whitespace-nowrap">🛏 Overnight</div>
              </td>
              {slottedDays.map(({ day }) => {
                const place = places[day.overnightPlaceId];
                return (
                  <td key={day.id} className="border-b border-r border-stone-200 bg-indigo-50 align-middle">
                    <div className="px-2 py-1.5">
                      {place ? (
                        <button
                          onClick={() => onPlaceClick(place)}
                          className="text-indigo-700 font-medium hover:underline text-left leading-tight"
                        >
                          {place.name}
                        </button>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Slot legend */}
      <div className="flex flex-wrap gap-2 mt-4">
        {activeSlots.map((slot) => (
          <div key={slot} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${SLOT_BG[slot]} text-stone-600`}>
            {SLOT_LABEL[slot]}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotCell({ ss, onPlaceClick }: { ss: SlottedSegment; onPlaceClick: (p: Place) => void }) {
  return (
    <div className="rounded bg-white/70 px-2 py-1 shadow-sm">
      {ss.segment.time !== '—' && (
        <div className="text-[10px] text-stone-400 tabular-nums">{ss.segment.time}</div>
      )}
      <div className="text-stone-700 leading-snug">{ss.segment.activity}</div>
      {ss.place && (
        <button
          onClick={() => onPlaceClick(ss.place!)}
          className="text-[10px] text-stone-400 hover:text-stone-700 hover:underline mt-0.5 text-left"
        >
          {ss.place.blackOwned ? '★ ' : ''}{ss.place.name}
        </button>
      )}
    </div>
  );
}
