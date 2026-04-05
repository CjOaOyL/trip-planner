import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Itinerary, Place, Day, Segment, TimeSlot } from '../types';
import { inferSlot, SLOT_ORDER, SLOT_LABEL, SLOT_BG } from '../utils/slotUtils';
import {
  uid,
  DraggableCard,
  DroppableCell,
  DroppableDiv,
  type DndSegment,
  type DragPayload,
} from './SlotDnD';
import type { VoteOption } from '../utils/voteSession';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface Props {
  itinerary: Itinerary;
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

/* ─── Grid state ────────────────────────────────────────────────────────────── */

interface GridDay {
  day: Day;
  bySlot: Map<TimeSlot, DndSegment[]>;
}

function buildGrid(itinerary: Itinerary, places: Record<string, Place>): GridDay[] {
  return itinerary.days.map((day) => {
    const bySlot = new Map<TimeSlot, DndSegment[]>();
    for (const s of SLOT_ORDER) bySlot.set(s, []);

    for (const segment of day.segments) {
      const place = places[segment.placeId];
      const slot = inferSlot(segment, place?.type);
      bySlot.get(slot)!.push({ uid: uid(), segment, slot, place });
    }

    for (const leg of day.legs) {
      const from = places[leg.fromPlaceId];
      const to   = places[leg.toPlaceId];
      const fake: Segment = {
        time: '—',
        placeId: leg.fromPlaceId,
        activity: `Drive: ${from?.name ?? '?'} → ${to?.name ?? '?'} (${Math.floor(leg.drivingMinutes / 60)}h${leg.drivingMinutes % 60 ? ` ${leg.drivingMinutes % 60}m` : ''})`,
        durationMinutes: leg.drivingMinutes,
      };
      bySlot.get('travel')!.push({ uid: uid(), segment: fake, slot: 'travel', place: from });
    }

    return { day, bySlot };
  });
}

/** Places from the trip that don't appear in any segment — candidates for the bench. */
function findUnscheduledPlaces(
  places: Record<string, Place>,
  grid: GridDay[],
  bench: DndSegment[],
): Place[] {
  const used = new Set<string>();
  for (const gd of grid) {
    for (const segs of gd.bySlot.values()) {
      for (const s of segs) if (s.place) used.add(s.place.id);
    }
  }
  for (const s of bench) if (s.place) used.add(s.place.id);
  return Object.values(places).filter(
    (p) => !used.has(p.id) && p.type !== 'charging-station',
  );
}

function activeSlots(grid: GridDay[], bench: DndSegment[]): TimeSlot[] {
  return SLOT_ORDER.filter((slot) =>
    grid.some((d) => (d.bySlot.get(slot)?.length ?? 0) > 0) ||
    bench.some((s) => s.slot === slot),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function TripOverview({ itinerary, places, onPlaceClick }: Props) {
  const navigate = useNavigate();

  /* ── State ── */
  const initialGrid = useMemo(() => buildGrid(itinerary, places), [itinerary, places]);
  const [grid, setGrid] = useState<GridDay[]>(() => buildGrid(itinerary, places));
  const [bench, setBench] = useState<DndSegment[]>([]);
  const [activeId, setActiveId] = useState<DndSegment | null>(null);
  const [showBench, setShowBench] = useState(true);

  /* ── Vote selection mode ── */
  const [voteMode, setVoteMode] = useState(false);
  const [selected, setSelected] = useState<Map<number, VoteOption>>(new Map());

  function toggleSelect(seg: DndSegment) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(seg.uid)) {
        next.delete(seg.uid);
      } else {
        // Build a 2–3 sentence summary voters can read before ranking
        const place = seg.place;
        const parts: string[] = [];
        if (place?.description) parts.push(place.description);
        if (seg.segment.notes) parts.push(seg.segment.notes);
        if (seg.segment.durationMinutes) {
          const hrs = Math.floor(seg.segment.durationMinutes / 60);
          const mins = seg.segment.durationMinutes % 60;
          const dur = hrs > 0 ? `${hrs}h${mins ? ` ${mins}m` : ''}` : `${mins}m`;
          parts.push(`Estimated time: ${dur}.`);
        }
        if (place?.blackOwned) parts.push('Black-owned.');
        const opt: VoteOption = {
          id: `seg-${seg.uid}`,
          label: seg.segment.activity,
          description: parts.join(' ') || place?.name,
          placeId: seg.segment.placeId,
          itineraryId: itinerary.id,
        };
        next.set(seg.uid, opt);
      }
      return next;
    });
  }

  function launchVote() {
    const options = Array.from(selected.values());
    const params = new URLSearchParams({
      title: `Vote for ${itinerary.name}`,
      options: encodeURIComponent(JSON.stringify(options)),
      itineraryId: itinerary.id,
    });
    navigate(`/vote?${params.toString()}`);
  }

  function exitVoteMode() {
    setVoteMode(false);
    setSelected(new Map());
  }

  const slots = useMemo(() => activeSlots(grid, bench), [grid, bench]);
  const unscheduled = useMemo(() => findUnscheduledPlaces(places, grid, bench), [places, grid, bench]);

  /* ── DnD sensors ── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /* ── Reset to original ── */
  const handleReset = useCallback(() => {
    setGrid(buildGrid(itinerary, places));
    setBench([]);
  }, [itinerary, places]);

  const hasChanges = useMemo(() => {
    // Quick dirty check: compare segment counts
    const origCount = initialGrid.reduce((n, d) => n + [...d.bySlot.values()].reduce((a, s) => a + s.length, 0), 0);
    const currCount = grid.reduce((n, d) => n + [...d.bySlot.values()].reduce((a, s) => a + s.length, 0), 0);
    return currCount !== origCount || bench.length > 0;
  }, [initialGrid, grid, bench]);

  /* ── DnD handlers ── */
  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragPayload | undefined;
    if (data) setActiveId(data.seg);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as DragPayload;
    const dropData = over.data.current as { dayIndex: number; slot: TimeSlot; location: 'grid' | 'bench' } | undefined;
    if (!dragData || !dropData) return;

    // Same spot — no-op
    if (
      dragData.fromLocation === dropData.location &&
      dragData.fromDayIndex === dropData.dayIndex &&
      dragData.fromSlot === dropData.slot
    ) return;

    const seg = dragData.seg;

    setGrid((prev) => {
      const next = prev.map((gd) => ({
        ...gd,
        bySlot: new Map([...gd.bySlot.entries()].map(([k, v]) => [k, [...v]])),
      }));

      // Remove from grid source
      if (dragData.fromLocation === 'grid') {
        const srcSlotArr = next[dragData.fromDayIndex]?.bySlot.get(dragData.fromSlot);
        if (srcSlotArr) {
          const idx = srcSlotArr.findIndex((s) => s.uid === seg.uid);
          if (idx !== -1) srcSlotArr.splice(idx, 1);
        }
      }

      // Add to grid target
      if (dropData.location === 'grid') {
        const tgtSlotArr = next[dropData.dayIndex]?.bySlot.get(dropData.slot);
        if (tgtSlotArr) {
          tgtSlotArr.push({ ...seg, slot: dropData.slot });
        }
      }

      return next;
    });

    // Remove from bench source
    if (dragData.fromLocation === 'bench') {
      setBench((prev) => prev.filter((s) => s.uid !== seg.uid));
    }

    // Add to bench target
    if (dropData.location === 'bench') {
      setBench((prev) => [...prev, seg]);
    }
  }

  /* ── Add unscheduled place to bench ── */
  function addToBench(place: Place) {
    const seg: DndSegment = {
      uid: uid(),
      segment: { time: 'TBD', placeId: place.id, activity: place.name, durationMinutes: 60 },
      slot: 'afternoon',
      place,
    };
    setBench((prev) => [...prev, seg]);
  }

  /* ── Remove from bench entirely ── */
  function removeFromBench(segUid: number) {
    setBench((prev) => prev.filter((s) => s.uid !== segUid));
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-xs text-stone-400">
            All {itinerary.days.length} days side-by-side. <strong>Drag</strong> events between slots. Scroll right for more days.
          </p>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button onClick={handleReset} className="text-xs text-stone-400 hover:text-stone-700 underline">
                Reset
              </button>
            )}
            <button
              onClick={() => setShowBench(!showBench)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showBench ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
              }`}
            >
              📦 Bench {bench.length > 0 && `(${bench.length})`}
            </button>
            <button
              onClick={() => { setVoteMode(!voteMode); setSelected(new Map()); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                voteMode ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
              }`}
            >
              🗳 {voteMode ? 'Cancel Vote' : 'Start a Vote'}
            </button>
          </div>
        </div>

        {/* Vote mode instruction banner */}
        {voteMode && (
          <div className="mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center justify-between gap-3">
            <span>Click any activity cards to select them for a vote. Select 2 or more, then click <strong>Vote on Selected</strong>.</span>
            <button onClick={exitVoteMode} className="text-indigo-400 hover:text-indigo-700 font-medium whitespace-nowrap">Exit</button>
          </div>
        )}

        {/* ── Slot grid ── */}
        <div className="overflow-x-auto pb-4">
          <table className="border-separate border-spacing-0 min-w-full text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-stone-50 border-b border-r border-stone-200 p-0">
                  <div className="w-28 h-14" />
                </th>
                {grid.map(({ day }, i) => (
                  <th key={day.id} className="border-b border-r-2 border-stone-400 bg-white min-w-[180px] max-w-[220px]">
                    <div className="px-3 py-2 text-left">
                      <div className="font-bold text-stone-700">Day {i + 1}</div>
                      <div className="text-stone-400 font-normal truncate">{day.theme}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <td className={`sticky left-0 z-10 border-b border-r border-stone-200 ${SLOT_BG[slot]}`}>
                    <div className="w-28 px-3 py-2 font-semibold text-stone-600 whitespace-nowrap">
                      {SLOT_LABEL[slot]}
                    </div>
                  </td>

                  {grid.map(({ day, bySlot }, di) => {
                    const segs = bySlot.get(slot) ?? [];
                    const dropId = `grid:${di}:${slot}`;
                    return (
                      <DroppableCell
                        key={day.id}
                        id={dropId}
                        dropData={{ dayIndex: di, slot, location: 'grid' }}
                        className={`border-b border-r-2 border-stone-400 align-top ${SLOT_BG[slot]} min-w-[180px]`}
                      >
                        {segs.length === 0 ? (
                          <div className="px-3 py-2 text-stone-300 italic">—</div>
                        ) : (
                          <div className="px-2 py-1.5 space-y-1.5">
                            {segs.map((seg) => (
                              <div key={seg.uid} className="relative group/card">
                                <DraggableCard
                                  id={`drag:${di}:${slot}:${seg.uid}`}
                                  dragData={{ seg, fromDayIndex: di, fromSlot: slot, fromLocation: 'grid' }}
                                  seg={seg}
                                  onPlaceClick={onPlaceClick}
                                />
                                {/* Vote selection overlay */}
                                {voteMode && (
                                  <button
                                    onClick={() => toggleSelect(seg)}
                                    className={`absolute inset-0 rounded transition-all ${
                                      selected.has(seg.uid)
                                        ? 'bg-indigo-200/60 ring-2 ring-indigo-500'
                                        : 'bg-transparent hover:bg-indigo-50/60'
                                    }`}
                                  >
                                    <span className={`absolute top-1 right-1 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                                      selected.has(seg.uid)
                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                        : 'bg-white border-stone-400'
                                    }`}>
                                      {selected.has(seg.uid) ? '✓' : ''}
                                    </span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </DroppableCell>
                    );
                  })}
                </tr>
              ))}

              {/* Overnight row (not draggable) */}
              <tr>
                <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-indigo-50">
                  <div className="w-28 px-3 py-2 font-semibold text-indigo-700 whitespace-nowrap">🛏 Overnight</div>
                </td>
                {grid.map(({ day }) => {
                  const place = places[day.overnightPlaceId];
                  return (
                    <td key={day.id} className="border-b border-r-2 border-stone-400 bg-indigo-50 align-middle">
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

        {/* ── Slot legend ── */}
        <div className="flex flex-wrap gap-2 mt-4">
          {slots.map((slot) => (
            <div key={slot} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${SLOT_BG[slot]} text-stone-600`}>
              {SLOT_LABEL[slot]}
            </div>
          ))}
        </div>

        {/* ── Bench / parking lot ── */}
        {showBench && (
          <section className="mt-6 border-2 border-dashed border-teal-300 rounded-xl bg-teal-50/40 p-4">
            <h3 className="text-sm font-bold text-teal-800 mb-2">
              📦 Bench <span className="font-normal text-teal-600 text-xs">— drag items here to stash them, or drag them back to a slot</span>
            </h3>

            {/* Drop zone for bench */}
            <DroppableDiv
              id="drop:bench"
              dropData={{ dayIndex: -1, slot: 'morning', location: 'bench' }}
              className="min-h-[56px] flex flex-wrap gap-2 p-2 rounded-lg border border-teal-200 bg-white/60"
            >
              {bench.length === 0 && (
                <p className="text-xs text-teal-400 italic w-full text-center py-2">
                  Drag events here to remove them from the schedule
                </p>
              )}
              {bench.map((seg) => (
                <div key={seg.uid} className="relative group">
                  <DraggableCard
                    id={`drag:bench:${seg.uid}`}
                    dragData={{ seg, fromDayIndex: -1, fromSlot: seg.slot, fromLocation: 'bench' }}
                    seg={seg}
                    onPlaceClick={onPlaceClick}
                  />
                  <button
                    onClick={() => removeFromBench(seg.uid)}
                    title="Remove from bench"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-400 text-white text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </DroppableDiv>

            {/* Unscheduled places — add to bench */}
            {unscheduled.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-teal-600 font-medium mb-1.5">Available places not in schedule:</p>
                <div className="flex flex-wrap gap-1.5">
                  {unscheduled.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => addToBench(place)}
                      className="text-xs px-2 py-1 rounded-full border border-teal-200 bg-white text-teal-700 hover:bg-teal-100 transition-colors"
                    >
                      + {place.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Floating vote bar ── */}
      {voteMode && selected.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-indigo-900/30">
          <span className="text-sm font-medium">
            {selected.size} options selected
          </span>
          <button
            onClick={launchVote}
            className="bg-white text-indigo-700 font-semibold text-sm px-4 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            🗳 Vote on Selected →
          </button>
          <button onClick={() => setSelected(new Map())} className="text-indigo-200 hover:text-white text-xs">
            Clear
          </button>
        </div>
      )}

      {/* ── Drag overlay (follows cursor) ── */}
      <DragOverlay>
        {activeId && (
          <DraggableCard
            id="overlay"
            dragData={{ seg: activeId, fromDayIndex: -1, fromSlot: activeId.slot, fromLocation: 'grid' }}
            seg={activeId}
            onPlaceClick={onPlaceClick}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
