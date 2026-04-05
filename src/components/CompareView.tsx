import { useMemo, useState, useCallback } from 'react';
import type { Itinerary, Place, Segment, TimeSlot, Day } from '../types';
import { inferSlot, SLOT_ORDER, SLOT_LABEL, SLOT_BG } from '../utils/slotUtils';
import { computeStayRuns, dayColorIdxArray, STAY_PALETTE } from '../utils/stayUtils';
import { uid } from './SlotDnD';
import MiniMap from './MiniMap';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface Props {
  currentItinerary: Itinerary;
  allItineraries: Itinerary[];
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

/* ─── Slot‑parsed helpers ───────────────────────────────────────────────────── */

interface SlottedSegment {
  uid: number;
  segment: Segment;
  slot: TimeSlot;
  place?: Place;
  itineraryId: string;
  dayIndex: number;
}

interface SlottedDay {
  day: Day;
  dayIndex: number;
  itineraryId: string;
  bySlot: Map<TimeSlot, SlottedSegment[]>;
}

function buildSlottedDay(
  day: Day,
  dayIndex: number,
  itineraryId: string,
  places: Record<string, Place>,
): SlottedDay {
  const bySlot = new Map<TimeSlot, SlottedSegment[]>();
  for (const s of SLOT_ORDER) bySlot.set(s, []);

  for (const segment of day.segments) {
    const place = places[segment.placeId];
    const slot = inferSlot(segment, place?.type);
    bySlot.get(slot)!.push({ uid: uid(), segment, slot, place, itineraryId, dayIndex });
  }

  // Driving legs → travel slot
  for (const leg of day.legs) {
    const from = places[leg.fromPlaceId];
    const to   = places[leg.toPlaceId];
    const fake: Segment = {
      time: '—',
      placeId: leg.fromPlaceId,
      activity: `Drive: ${from?.name ?? '?'} → ${to?.name ?? '?'} (${Math.floor(leg.drivingMinutes / 60)}h${leg.drivingMinutes % 60 ? ` ${leg.drivingMinutes % 60}m` : ''})`,
      durationMinutes: leg.drivingMinutes,
    };
    bySlot.get('travel')!.push({ uid: uid(), segment: fake, slot: 'travel', place: from, itineraryId, dayIndex });
  }

  return { day, dayIndex, itineraryId, bySlot };
}

/* ─── View mode ─────────────────────────────────────────────────────────────── */

type ViewMode = 'side-by-side' | 'slot-focus';

/* ─── Mix‑and‑match draft state ─────────────────────────────────────────────── */

interface DraftEntry {
  dayIndex: number;
  slot: TimeSlot;
  segments: SlottedSegment[];
  sourceItineraryId: string;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function CompareView({ currentItinerary, allItineraries, places, onPlaceClick }: Props) {
  // Active (non-archived) itineraries only
  const activeItineraries = useMemo(
    () => allItineraries.filter((it) => !it.archived),
    [allItineraries],
  );

  // Selection state — current always selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([currentItinerary.id]),
  );
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [focusSlot, setFocusSlot] = useState<TimeSlot>('dinner');

  // Mix‑and‑match draft: keyed as "dayIndex:slot"
  const [draft, setDraft] = useState<Map<string, DraftEntry>>(new Map());
  const [showDraft, setShowDraft] = useState(false);

  const toggleItinerary = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Build slotted data for every selected itinerary
  const selectedItineraries = useMemo(
    () => activeItineraries.filter((it) => selectedIds.has(it.id)),
    [activeItineraries, selectedIds],
  );

  const slottedByItinerary = useMemo(() => {
    const map = new Map<string, SlottedDay[]>();
    for (const it of selectedItineraries) {
      map.set(it.id, it.days.map((day, i) => buildSlottedDay(day, i, it.id, places)));
    }
    return map;
  }, [selectedItineraries, places]);

  // Max number of days across selected itineraries
  const maxDays = useMemo(
    () => Math.max(...selectedItineraries.map((it) => it.days.length), 0),
    [selectedItineraries],
  );

  // Detect which slots are active across all selected itineraries
  const activeSlots = useMemo(() => {
    return SLOT_ORDER.filter((slot) =>
      [...slottedByItinerary.values()].some((days) =>
        days.some((d) => (d.bySlot.get(slot)?.length ?? 0) > 0),
      ),
    );
  }, [slottedByItinerary]);

  // ── Pick segment into the mix‑and‑match draft ──
  function pickForDraft(dayIndex: number, slot: TimeSlot, segments: SlottedSegment[], sourceItineraryId: string) {
    const key = `${dayIndex}:${slot}`;
    setDraft((prev) => {
      const next = new Map(prev);
      // Toggle off if same source already selected
      const existing = next.get(key);
      if (existing && existing.sourceItineraryId === sourceItineraryId) {
        next.delete(key);
      } else {
        next.set(key, { dayIndex, slot, segments, sourceItineraryId });
      }
      return next;
    });
    if (!showDraft) setShowDraft(true);
  }

  function clearDraft() {
    setDraft(new Map());
  }

  // Color for each itinerary (for visual badge)
  const itineraryColors: Record<string, string> = {};
  const PALETTE = [
    'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500',
    'bg-violet-500', 'bg-teal-500', 'bg-orange-500',
  ];
  activeItineraries.forEach((it, i) => {
    itineraryColors[it.id] = PALETTE[i % PALETTE.length];
  });

  /* ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Itinerary picker ── */}
      <section>
        <h2 className="text-sm font-semibold text-stone-600 mb-2">Select itineraries to compare</h2>
        <div className="flex flex-wrap gap-2">
          {activeItineraries.map((it) => {
            const selected = selectedIds.has(it.id);
            return (
              <button
                key={it.id}
                onClick={() => toggleItinerary(it.id)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selected
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-300 bg-white text-stone-500 hover:border-stone-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${itineraryColors[it.id]}`} />
                {it.name}
                <span className="text-[10px] opacity-70">({it.days.length}d)</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── View mode toggle + slot focus ── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-0 border border-stone-200 rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1.5 font-medium transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-500 hover:bg-stone-50'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode('slot-focus')}
            className={`px-3 py-1.5 font-medium transition-colors ${
              viewMode === 'slot-focus'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-500 hover:bg-stone-50'
            }`}
          >
            Slot Focus
          </button>
        </div>

        {viewMode === 'slot-focus' && (
          <select
            value={focusSlot}
            onChange={(e) => setFocusSlot(e.target.value as TimeSlot)}
            className="text-xs border border-stone-200 rounded px-2 py-1.5"
          >
            {SLOT_ORDER.map((s) => (
              <option key={s} value={s}>{SLOT_LABEL[s]}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowDraft(!showDraft)}
          className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showDraft
              ? 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
          }`}
        >
          🧩 Mix & Match {draft.size > 0 && `(${draft.size})`}
        </button>
      </div>

      {/* ── Main grid ── */}
      {/* ── Mini route maps for selected itineraries ── */}
      {selectedItineraries.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-600 mb-2">Route snapshots</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {selectedItineraries.map((it) => (
              <div key={it.id} className="shrink-0 w-64">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${itineraryColors[it.id]}`} />
                  <span className="text-xs font-medium text-stone-600 truncate">{it.name}</span>
                </div>
                <MiniMap itinerary={it} places={places} height={160} />
              </div>
            ))}
          </div>
        </section>
      )}

      {viewMode === 'side-by-side' && (
        <SideBySideGrid
          selectedItineraries={selectedItineraries}
          slottedByItinerary={slottedByItinerary}
          activeSlots={activeSlots}
          maxDays={maxDays}
          places={places}
          itineraryColors={itineraryColors}
          draft={draft}
          onPick={pickForDraft}
          onPlaceClick={onPlaceClick}
        />
      )}

      {viewMode === 'slot-focus' && (
        <SlotFocusGrid
          slot={focusSlot}
          selectedItineraries={selectedItineraries}
          slottedByItinerary={slottedByItinerary}
          maxDays={maxDays}
          itineraryColors={itineraryColors}
          draft={draft}
          onPick={pickForDraft}
          onPlaceClick={onPlaceClick}
        />
      )}

      {/* ── Mix & Match Draft ── */}
      {showDraft && (
        <DraftPanel
          draft={draft}
          maxDays={maxDays}
          activeSlots={activeSlots}
          itineraryColors={itineraryColors}
          allItineraries={allItineraries}
          onClear={clearDraft}
          onPlaceClick={onPlaceClick}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ── Side-by-Side Grid ─────────────────────────────────────────────────────── */

function SideBySideGrid({
  selectedItineraries,
  slottedByItinerary,
  activeSlots,
  maxDays,
  places,
  itineraryColors,
  draft,
  onPick,
  onPlaceClick,
}: {
  selectedItineraries: Itinerary[];
  slottedByItinerary: Map<string, SlottedDay[]>;
  activeSlots: TimeSlot[];
  maxDays: number;
  places: Record<string, Place>;
  itineraryColors: Record<string, string>;
  draft: Map<string, DraftEntry>;
  onPick: (dayIndex: number, slot: TimeSlot, segments: SlottedSegment[], sourceItineraryId: string) => void;
  onPlaceClick: (place: Place) => void;
}) {
  // Per-itinerary stay-group color index arrays
  const stayRunsByIt = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStayRuns>>();
    for (const it of selectedItineraries) {
      const days = slottedByItinerary.get(it.id) ?? [];
      map.set(it.id, computeStayRuns(days.map((sd) => sd.day.overnightPlaceId)));
    }
    return map;
  }, [selectedItineraries, slottedByItinerary]);

  const dayColorsByIt = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const it of selectedItineraries) {
      const days = slottedByItinerary.get(it.id) ?? [];
      const runs = stayRunsByIt.get(it.id)!;
      map.set(it.id, dayColorIdxArray(runs, days.length));
    }
    return map;
  }, [selectedItineraries, slottedByItinerary, stayRunsByIt]);

  return (
    <div className="overflow-x-auto pb-4">
      <table className="border-separate border-spacing-0 min-w-full text-xs">
        {/* ── Header: Day columns grouped per itinerary ── */}
        <thead>
          {/* Day group header */}
          <tr>
            <th className="sticky left-0 z-30 bg-stone-50 border-b border-r border-stone-200 p-0" rowSpan={2}>
              <div className="w-28 h-full" />
            </th>
            {Array.from({ length: maxDays }, (_, di) => (
              <th
                key={di}
                colSpan={selectedItineraries.length}
                className="border-b border-r-2 border-stone-400 bg-stone-100 text-center py-1.5 font-bold text-stone-600"
              >
                Day {di + 1}
              </th>
            ))}
          </tr>
          {/* Per-itinerary sub-header — colored by that itinerary's stay */}
          <tr>
            {Array.from({ length: maxDays }, (_, di) =>
              selectedItineraries.map((it, itIdx) => {
                const colorIdx = dayColorsByIt.get(it.id)?.[di] ?? 0;
                const isLastInDay = itIdx === selectedItineraries.length - 1;
                return (
                  <th
                    key={`${di}-${it.id}`}
                    style={{ backgroundColor: STAY_PALETTE[colorIdx] + '50' }}
                    className={`border-b min-w-[160px] max-w-[200px] ${
                      isLastInDay ? 'border-r-2 border-stone-400' : 'border-r border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-stone-500 font-medium truncate">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${itineraryColors[it.id]}`} />
                      <span className="truncate">{it.name}</span>
                    </div>
                  </th>
                );
              }),
            )}
          </tr>
        </thead>

        {/* ── Slot rows ── */}
        <tbody>
          {activeSlots.map((slot) => (
            <tr key={slot}>
              <td className={`sticky left-0 z-10 border-b border-r border-stone-200 ${SLOT_BG[slot]}`}>
                <div className="w-28 px-3 py-2 font-semibold text-stone-600 whitespace-nowrap">
                  {SLOT_LABEL[slot]}
                </div>
              </td>
              {Array.from({ length: maxDays }, (_, di) =>
                selectedItineraries.map((it, itIdx) => {
                  const days = slottedByItinerary.get(it.id);
                  const slottedDay = days?.[di];
                  const segs = slottedDay?.bySlot.get(slot) ?? [];
                  const draftKey = `${di}:${slot}`;
                  const isDrafted = draft.get(draftKey)?.sourceItineraryId === it.id;
                  const isLastInDay = itIdx === selectedItineraries.length - 1;
                  const colorIdx = dayColorsByIt.get(it.id)?.[di] ?? 0;

                  return (
                    <td
                      key={`${di}-${it.id}-${slot}`}
                      style={{ borderLeft: `3px solid ${STAY_PALETTE[colorIdx]}` }}
                      className={`border-b align-top ${SLOT_BG[slot]} min-w-[160px] relative group ${
                        isLastInDay ? 'border-r-2 border-stone-400' : 'border-r border-stone-200'
                      } ${isDrafted ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
                    >
                      {!slottedDay ? (
                        <div className="px-2 py-2 text-stone-200 italic text-center">—</div>
                      ) : segs.length === 0 ? (
                        <div className="px-2 py-2 text-stone-300 italic flex items-center justify-between">
                          <span>empty</span>
                        </div>
                      ) : (
                        <div className="px-2 py-1.5 space-y-1">
                          {segs.map((ss, i) => (
                            <CellCard key={i} ss={ss} onPlaceClick={onPlaceClick} />
                          ))}
                        </div>
                      )}
                      {/* Pick button (visible on hover) */}
                      {slottedDay && segs.length > 0 && (
                        <button
                          title="Pick for mix & match"
                          onClick={() => onPick(di, slot, segs, it.id)}
                          className={`absolute top-1 right-1 w-5 h-5 rounded text-[10px] leading-none transition-all ${
                            isDrafted
                              ? 'bg-amber-400 text-white opacity-100'
                              : 'bg-stone-300/50 text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-amber-400 hover:text-white'
                          }`}
                        >
                          {isDrafted ? '✓' : '+'}
                        </button>
                      )}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}

          {/* ── Overnight row — full stay color per cell ── */}
          <tr>
            <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-stone-100">
              <div className="w-28 px-3 py-2 font-semibold text-stone-600 whitespace-nowrap">🛏 Overnight</div>
            </td>
            {Array.from({ length: maxDays }, (_, di) =>
              selectedItineraries.map((it, itIdx) => {
                const days = slottedByItinerary.get(it.id);
                const slottedDay = days?.[di];
                const place = slottedDay ? places[slottedDay.day.overnightPlaceId] : undefined;
                const isLastInDay = itIdx === selectedItineraries.length - 1;
                const colorIdx = dayColorsByIt.get(it.id)?.[di] ?? 0;
                return (
                  <td
                    key={`${di}-${it.id}-overnight`}
                    style={{ backgroundColor: STAY_PALETTE[colorIdx] }}
                    className={`border-b align-middle ${isLastInDay ? 'border-r-2 border-stone-400' : 'border-r border-stone-200'}`}
                  >
                    {place ? (
                      <button
                        onClick={() => onPlaceClick(place)}
                        className="px-2 py-1.5 text-stone-700 font-medium hover:underline text-left leading-tight text-[11px]"
                      >
                        {place.name}
                      </button>
                    ) : (
                      <span className="px-2 py-1.5 text-stone-400 italic block">—</span>
                    )}
                  </td>
                );
              }),
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── Slot Focus Grid ────────────────────────────────────────────────────────── */

function SlotFocusGrid({
  slot,
  selectedItineraries,
  slottedByItinerary,
  maxDays,
  itineraryColors,
  draft,
  onPick,
  onPlaceClick,
}: {
  slot: TimeSlot;
  selectedItineraries: Itinerary[];
  slottedByItinerary: Map<string, SlottedDay[]>;
  maxDays: number;
  itineraryColors: Record<string, string>;
  draft: Map<string, DraftEntry>;
  onPick: (dayIndex: number, slot: TimeSlot, segments: SlottedSegment[], sourceItineraryId: string) => void;
  onPlaceClick: (place: Place) => void;
}) {
  return (
    <div>
      <p className="text-xs text-stone-400 mb-3">
        Comparing <strong>{SLOT_LABEL[slot]}</strong> across all days for {selectedItineraries.length} itinerary{selectedItineraries.length > 1 ? 'ies' : ''}.
      </p>
      <div className="overflow-x-auto pb-4">
        <table className="border-separate border-spacing-0 min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-stone-50 border-b border-r border-stone-200 w-32 px-3 py-2 text-left text-stone-600">
                {SLOT_LABEL[slot]}
              </th>
              {Array.from({ length: maxDays }, (_, di) => (
                <th key={di} className="border-b border-r-2 border-stone-500 bg-stone-100 text-center py-2 font-bold text-stone-600 min-w-[180px]">
                  Day {di + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedItineraries.map((it) => {
              const days = slottedByItinerary.get(it.id) ?? [];
              return (
                <tr key={it.id}>
                  <td className={`sticky left-0 z-10 border-b border-r border-stone-200 bg-white`}>
                    <div className="flex items-center gap-1.5 px-3 py-2 font-medium text-stone-600">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${itineraryColors[it.id]}`} />
                      <span className="truncate">{it.name}</span>
                    </div>
                  </td>
                  {Array.from({ length: maxDays }, (_, di) => {
                    const slottedDay = days[di];
                    const segs = slottedDay?.bySlot.get(slot) ?? [];
                    const draftKey = `${di}:${slot}`;
                    const isDrafted = draft.get(draftKey)?.sourceItineraryId === it.id;

                    return (
                      <td
                        key={di}
                        className={`border-b border-r-2 border-stone-500 align-top ${SLOT_BG[slot]} min-w-[180px] relative group ${
                          isDrafted ? 'ring-2 ring-amber-400 ring-inset' : ''
                        }`}
                      >
                        {!slottedDay ? (
                          <div className="px-2 py-2 text-stone-200 italic text-center">—</div>
                        ) : segs.length === 0 ? (
                          <div className="px-2 py-2 text-stone-300 italic">empty</div>
                        ) : (
                          <div className="px-2 py-1.5 space-y-1">
                            {segs.map((ss, i) => (
                              <CellCard key={i} ss={ss} onPlaceClick={onPlaceClick} />
                            ))}
                          </div>
                        )}
                        {slottedDay && segs.length > 0 && (
                          <button
                            title="Pick for mix & match"
                            onClick={() => onPick(di, slot, segs, it.id)}
                            className={`absolute top-1 right-1 w-5 h-5 rounded text-[10px] leading-none transition-all ${
                              isDrafted
                                ? 'bg-amber-400 text-white opacity-100'
                                : 'bg-stone-300/50 text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-amber-400 hover:text-white'
                            }`}
                          >
                            {isDrafted ? '✓' : '+'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Draft Panel (Mix & Match) ─────────────────────────────────────────────── */

function DraftPanel({
  draft,
  maxDays,
  activeSlots,
  itineraryColors,
  allItineraries,
  onClear,
  onPlaceClick,
}: {
  draft: Map<string, DraftEntry>;
  maxDays: number;
  activeSlots: TimeSlot[];
  itineraryColors: Record<string, string>;
  allItineraries: Itinerary[];
  onClear: () => void;
  onPlaceClick: (place: Place) => void;
}) {
  const itineraryName = (id: string) => allItineraries.find((it) => it.id === id)?.name ?? id;

  return (
    <section className="border-2 border-amber-300 rounded-xl bg-amber-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-amber-800">
          🧩 Mix & Match Draft {draft.size > 0 && <span className="font-normal text-amber-600">({draft.size} slots picked)</span>}
        </h3>
        <button onClick={onClear} className="text-xs text-amber-600 hover:text-amber-800 underline">
          Clear all
        </button>
      </div>

      {draft.size === 0 ? (
        <p className="text-xs text-amber-600 italic">
          Hover over any filled cell above and click <strong>+</strong> to pick it for your custom itinerary mix.
        </p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <table className="border-separate border-spacing-0 min-w-full text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-amber-50 border-b border-r border-amber-200 w-28 px-3 py-1.5 text-left text-amber-700">
                  Slot
                </th>
                {Array.from({ length: maxDays }, (_, di) => (
                  <th key={di} className="border-b border-r border-amber-200 bg-amber-100/50 text-center py-1.5 font-bold text-amber-700 min-w-[160px]">
                    Day {di + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSlots.map((slot) => {
                // Only show rows that have at least one pick
                const hasPick = Array.from({ length: maxDays }).some((_, di) => draft.has(`${di}:${slot}`));
                if (!hasPick) return null;
                return (
                  <tr key={slot}>
                    <td className={`sticky left-0 z-10 border-b border-r border-amber-200 ${SLOT_BG[slot]}`}>
                      <div className="w-28 px-3 py-2 font-semibold text-stone-600 whitespace-nowrap">
                        {SLOT_LABEL[slot]}
                      </div>
                    </td>
                    {Array.from({ length: maxDays }, (_, di) => {
                      const entry = draft.get(`${di}:${slot}`);
                      return (
                        <td key={di} className={`border-b border-r border-amber-200 align-top ${entry ? SLOT_BG[slot] : 'bg-white'} min-w-[160px]`}>
                          {entry ? (
                            <div className="px-2 py-1.5 space-y-1">
                              <div className="flex items-center gap-1 mb-1">
                                <span className={`w-2 h-2 rounded-full ${itineraryColors[entry.sourceItineraryId]}`} />
                                <span className="text-[10px] text-stone-400 truncate">
                                  {itineraryName(entry.sourceItineraryId)}
                                </span>
                              </div>
                              {entry.segments.map((ss, i) => (
                                <CellCard key={i} ss={ss} onPlaceClick={onPlaceClick} />
                              ))}
                            </div>
                          ) : (
                            <div className="px-2 py-2 text-stone-200 italic text-center">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Cell Card (shared by all grids) ────────────────────────────────────────── */

function CellCard({ ss, onPlaceClick }: { ss: SlottedSegment; onPlaceClick: (p: Place) => void }) {
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
