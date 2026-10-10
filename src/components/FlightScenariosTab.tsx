import { useMemo, useState } from 'react';
import type { BookingOption, FlightScenario, Reservation, Trip } from '../types';
import { chooseOption, listReservations } from '../utils/reservations';
import {
  adjustedPerPerson,
  dayOffset,
  deleteFlightScenario,
  durationMinutes,
  flightLegs,
  formatDay,
  formatDuration,
  formatTime,
  getAirportPenalties,
  getFlightScenarios,
  optionPenaltyPerPerson,
  parseLocal,
  perPerson,
  saveAirportPenalties,
  saveFlightScenario,
  scenarioTotals,
} from '../utils/flightScenarios';

interface Props {
  tripId: string;
  itineraryId: string;
  trip: Trip;
}

type SortKey = 'price' | 'adjusted' | 'depart' | 'arrive' | 'duration';

interface LegFilter {
  from: Set<string>;      // empty = any
  to: Set<string>;        // empty = any
  dates: Set<string>;     // departure dates (YYYY-MM-DD); empty = any
  maxStops: 'any' | 0 | 1;
  departAfter: string;    // "HH:MM" or ''
  arriveBy: string;       // "HH:MM" or ''
  sort: SortKey;
}

function blankFilter(): LegFilter {
  return { from: new Set(), to: new Set(), dates: new Set(), maxStops: 'any', departAfter: '', arriveBy: '', sort: 'price' };
}

function money(n: number | undefined | null): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function toggleIn(set: Set<string>, v: string): Set<string> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

/** Minutes since midnight for an "HH:MM" string. */
function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

function passesFilter(o: BookingOption, f: LegFilter, legDate: string | undefined): boolean {
  const fl = o.flight!;
  if (f.from.size && !f.from.has(fl.from)) return false;
  if (f.to.size && !f.to.has(fl.to)) return false;
  if (f.dates.size && !f.dates.has(fl.depart.slice(0, 10))) return false;
  if (f.maxStops !== 'any' && fl.stops > f.maxStops) return false;
  if (f.departAfter) {
    const d = parseLocal(fl.depart);
    if (d.getHours() * 60 + d.getMinutes() < hm(f.departAfter)) return false;
  }
  if (f.arriveBy) {
    // "Arrive by" is anchored to the leg's date (reservation.date) when known,
    // otherwise to the departure date; anything landing later is out.
    const anchor = legDate ?? fl.depart.slice(0, 10);
    const limit = parseLocal(`${anchor}T${f.arriveBy}`).getTime();
    if (parseLocal(fl.arrive).getTime() > limit) return false;
  }
  return true;
}

function sortOptions(opts: BookingOption[], key: SortKey, penalties: Record<string, number>): BookingOption[] {
  const val = (o: BookingOption): number => {
    switch (key) {
      case 'price': return o.totalPrice ?? Number.POSITIVE_INFINITY;
      case 'adjusted': return adjustedPerPerson(o, penalties) ?? Number.POSITIVE_INFINITY;
      case 'depart': return parseLocal(o.flight!.depart).getTime();
      case 'arrive': return parseLocal(o.flight!.arrive).getTime();
      case 'duration': return durationMinutes(o.flight!);
    }
  };
  return [...opts].sort((a, b) => val(a) - val(b));
}

export default function FlightScenariosTab({ tripId, itineraryId, trip }: Props) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const legs = useMemo(
    () => flightLegs(listReservations(tripId, itineraryId)),
    [tripId, itineraryId, tick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [penalties, setPenalties] = useState<Record<string, number>>(() =>
    getAirportPenalties(tripId, trip.meta.airportPenalties),
  );
  const [filters, setFilters] = useState<Record<string, LegFilter>>({});
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    // Start from whatever is already marked "chosen" on each leg.
    const init: Record<string, string> = {};
    for (const leg of flightLegs(listReservations(tripId, itineraryId))) {
      const chosen = (leg.options ?? []).find((o) => o.status === 'chosen' && o.flight);
      if (chosen) init[leg.id] = chosen.id;
    }
    return init;
  });
  const [scenarioName, setScenarioName] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const scenarios = getFlightScenarios(tripId).filter((s) => !s.itineraryId || s.itineraryId === itineraryId);

  // All airports that appear on any leg — drives the penalty editor.
  const airports = useMemo(() => {
    const set = new Set<string>();
    for (const leg of legs) for (const o of leg.options ?? []) if (o.flight) { set.add(o.flight.from); set.add(o.flight.to); }
    return [...set].sort();
  }, [legs]);

  const totals = scenarioTotals(legs, selections, penalties);

  function getFilter(legId: string): LegFilter {
    return filters[legId] ?? blankFilter();
  }
  function setFilter(legId: string, patch: Partial<LegFilter>) {
    setFilters((prev) => ({ ...prev, [legId]: { ...getFilter(legId), ...patch } }));
  }

  function select(legId: string, optionId: string) {
    setSelections((prev) => (prev[legId] === optionId ? omit(prev, legId) : { ...prev, [legId]: optionId }));
  }

  function setPenalty(code: string, value: string) {
    const n = value === '' ? 0 : Number(value);
    const next = { ...penalties, [code]: Number.isFinite(n) ? n : 0 };
    setPenalties(next);
    saveAirportPenalties(tripId, next);
  }

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }

  function handleSave(asNew: boolean) {
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    const saved = saveFlightScenario(tripId, {
      id: asNew ? undefined : loadedId ?? undefined,
      itineraryId,
      name,
      selections: { ...selections },
      penalties: { ...penalties },
    });
    setLoadedId(saved.id);
    setScenarioName(saved.name);
    flash(asNew || !loadedId ? `Saved "${saved.name}"` : `Updated "${saved.name}"`);
    refresh();
  }

  function handleLoad(s: FlightScenario) {
    setSelections({ ...s.selections });
    setPenalties({ ...s.penalties });
    saveAirportPenalties(tripId, s.penalties);
    setScenarioName(s.name);
    setLoadedId(s.id);
    flash(`Loaded "${s.name}"`);
  }

  function handleDelete(s: FlightScenario) {
    if (!confirm(`Delete scenario "${s.name}"?`)) return;
    deleteFlightScenario(tripId, s.id);
    if (loadedId === s.id) { setLoadedId(null); setScenarioName(''); }
    refresh();
  }

  function handleApply() {
    const count = legs.filter((l) => selections[l.id]).length;
    if (!count) return;
    if (!confirm(`Mark the ${count} selected flight${count > 1 ? 's' : ''} as "chosen" on their reservations? Other options on those legs become shortlisted.`)) return;
    for (const leg of legs) {
      const id = selections[leg.id];
      if (id) chooseOption(tripId, leg.id, id);
    }
    flash('Applied to reservations');
    refresh();
  }

  function clearSelections() {
    setSelections({});
    setLoadedId(null);
    setScenarioName('');
  }

  if (legs.length === 0) {
    return (
      <div className="text-stone-400 text-sm italic">
        No flight legs with structured options yet. Add a <code>flight</code> block to options on a ✈️ Flight reservation to compare them here.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      {/* ── Legs ── */}
      <div className="space-y-6 min-w-0">
        {legs.map((leg) => (
          <LegPanel
            key={leg.id}
            leg={leg}
            filter={getFilter(leg.id)}
            onFilter={(patch) => setFilter(leg.id, patch)}
            selectedId={selections[leg.id]}
            onSelect={(optionId) => select(leg.id, optionId)}
            penalties={penalties}
          />
        ))}
      </div>

      {/* ── Scenario sidebar ── */}
      <aside className="space-y-4 lg:sticky lg:top-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">This scenario</h3>
          <ul className="space-y-2 mb-3">
            {legs.map((leg) => {
              const o = (leg.options ?? []).find((x) => x.id === selections[leg.id]);
              return (
                <li key={leg.id} className="text-xs">
                  <div className="text-stone-400 truncate" title={leg.name}>{leg.name}</div>
                  {o?.flight ? (
                    <div className="text-stone-700">
                      <span className="font-medium">{o.flight.from} → {o.flight.to}</span> · {o.flight.airline} ·{' '}
                      {formatDay(o.flight.depart)} {formatTime(o.flight.depart)}
                      <span className="text-stone-400"> · {money(o.totalPrice)} ({o.flight.passengers} pax)</span>
                    </div>
                  ) : (
                    <div className="text-stone-300 italic">nothing selected</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-stone-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Fare total</span><span className="font-semibold text-stone-800">{money(totals.fare)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Airport penalties</span><span className="text-stone-600">{totals.penalty ? `+${money(totals.penalty)}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Adjusted</span><span className="font-semibold text-stone-800">{money(totals.adjusted)}</span></div>
            <div className="text-[11px] text-stone-400">{totals.legsSelected} of {totals.legsTotal} legs selected</div>
          </div>

          <div className="mt-4 space-y-2">
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Scenario name (e.g. Tampa Wed, PHL Mon)"
              className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={totals.legsSelected === 0}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {loadedId ? 'Update' : 'Save scenario'}
              </button>
              {loadedId && (
                <button
                  onClick={() => handleSave(true)}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  Save as new
                </button>
              )}
              <button
                onClick={handleApply}
                disabled={totals.legsSelected === 0}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                title="Mark these options as chosen on their reservations"
              >
                Apply as chosen
              </button>
              <button onClick={clearSelections} className="text-sm px-3 py-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
                Clear
              </button>
            </div>
            {feedback && <div className="text-xs text-green-600">{feedback}</div>}
          </div>
        </div>

        {/* Penalties */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-700 mb-1">Airport penalties</h3>
          <p className="text-[11px] text-stone-400 mb-3">Per person, per leg. Added to the fare when ranking — set 0 for your preferred airport.</p>
          <div className="grid grid-cols-2 gap-2">
            {airports.map((code) => (
              <label key={code} className="flex items-center gap-2 text-xs">
                <span className="w-9 font-mono font-semibold text-stone-600">{code}</span>
                <span className="text-stone-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={penalties[code] ?? 0}
                  onChange={(e) => setPenalty(code, e.target.value)}
                  className="w-full border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Saved scenarios */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Saved scenarios ({scenarios.length})</h3>
          {scenarios.length === 0 && <div className="text-xs text-stone-300 italic">None yet — pick a flight on each leg and save.</div>}
          <ul className="space-y-2">
            {scenarios
              .map((s) => ({ s, t: scenarioTotals(legs, s.selections, s.penalties) }))
              .sort((a, b) => a.t.adjusted - b.t.adjusted)
              .map(({ s, t }) => (
                <li key={s.id} className={`rounded-xl border px-3 py-2 text-xs ${loadedId === s.id ? 'border-blue-300 bg-blue-50' : 'border-stone-100 bg-stone-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => handleLoad(s)} className="text-left font-medium text-stone-700 hover:underline flex-1 min-w-0 truncate" title="Load this scenario">
                      {s.name}
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-stone-300 hover:text-red-500" title="Delete">✕</button>
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {money(t.fare)} fare · {money(t.adjusted)} adjusted · {t.legsSelected}/{t.legsTotal} legs
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

// ─── One leg: filters + option table ──────────────────────────────────────────

interface LegProps {
  leg: Reservation;
  filter: LegFilter;
  onFilter: (patch: Partial<LegFilter>) => void;
  selectedId?: string;
  onSelect: (optionId: string) => void;
  penalties: Record<string, number>;
}

function LegPanel({ leg, filter, onFilter, selectedId, onSelect, penalties }: LegProps) {
  const all = (leg.options ?? []).filter((o) => o.flight);
  const froms = [...new Set(all.map((o) => o.flight!.from))].sort();
  const tos = [...new Set(all.map((o) => o.flight!.to))].sort();
  const dates = [...new Set(all.map((o) => o.flight!.depart.slice(0, 10)))].sort();
  const visible = sortOptions(all.filter((o) => passesFilter(o, filter, leg.date)), filter.sort, penalties);
  const pax = all[0]?.flight?.passengers;

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'price', label: 'Price' },
    { id: 'adjusted', label: 'Adjusted' },
    { id: 'depart', label: 'Departure' },
    { id: 'arrive', label: 'Arrival' },
    { id: 'duration', label: 'Duration' },
  ];

  return (
    <section className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-4 pt-4 pb-3 border-b border-stone-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-stone-800">{leg.name}</h3>
            <div className="text-xs text-stone-400 mt-0.5">
              {all.length} options{pax ? ` · prices are for ${pax} passenger${pax > 1 ? 's' : ''}` : ''}{leg.date ? ` · leg date ${leg.date}` : ''}
            </div>
          </div>
          {selectedId && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">1 selected</span>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 items-center text-xs">
          <ChipGroup label="From" values={froms} active={filter.from} onToggle={(v) => onFilter({ from: toggleIn(filter.from, v) })} />
          <ChipGroup label="To" values={tos} active={filter.to} onToggle={(v) => onFilter({ to: toggleIn(filter.to, v) })} />
          {dates.length > 1 && (
            <ChipGroup
              label="Date"
              values={dates}
              display={(d) => formatDay(`${d}T00:00`)}
              active={filter.dates}
              onToggle={(v) => onFilter({ dates: toggleIn(filter.dates, v) })}
            />
          )}
          <div className="flex items-center gap-1">
            <span className="text-stone-400">Stops</span>
            {(['any', 0, 1] as const).map((s) => (
              <button
                key={String(s)}
                onClick={() => onFilter({ maxStops: s })}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  filter.maxStops === s ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {s === 'any' ? 'any' : s === 0 ? 'nonstop' : '≤ 1'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1">
            <span className="text-stone-400">Depart after</span>
            <input type="time" value={filter.departAfter} onChange={(e) => onFilter({ departAfter: e.target.value })} className="border border-stone-200 rounded px-1.5 py-0.5" />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-stone-400">Arrive by</span>
            <input type="time" value={filter.arriveBy} onChange={(e) => onFilter({ arriveBy: e.target.value })} className="border border-stone-200 rounded px-1.5 py-0.5" />
            {filter.arriveBy && leg.date && <span className="text-stone-300">on {formatDay(`${leg.date}T00:00`)}</span>}
          </label>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-stone-400">Sort</span>
            <select value={filter.sort} onChange={(e) => onFilter({ sort: e.target.value as SortKey })} className="border border-stone-200 rounded px-1.5 py-0.5 bg-white">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {(filter.from.size || filter.to.size || filter.dates.size || filter.maxStops !== 'any' || filter.departAfter || filter.arriveBy) ? (
            <button onClick={() => onFilter(blankFilter())} className="text-stone-400 hover:text-stone-600 underline">reset</button>
          ) : null}
        </div>
      </header>

      {/* Options */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-stone-400 border-b border-stone-100">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-2 py-2">Route</th>
              <th className="px-2 py-2">Airline</th>
              <th className="px-2 py-2">Departs</th>
              <th className="px-2 py-2">Arrives</th>
              <th className="px-2 py-2">Duration</th>
              <th className="px-2 py-2">Stops</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-right">Per person</th>
              <th className="px-2 py-2 text-right" title="Per person + airport penalty">Adjusted</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-stone-300 italic">No options match these filters.</td></tr>
            )}
            {visible.map((o) => {
              const f = o.flight!;
              const sel = selectedId === o.id;
              const off = dayOffset(f);
              const pen = optionPenaltyPerPerson(o, penalties);
              return (
                <tr
                  key={o.id}
                  onClick={() => onSelect(o.id)}
                  className={`border-b border-stone-50 cursor-pointer transition-colors ${
                    sel ? 'bg-green-50' : o.status === 'rejected' ? 'opacity-50 hover:bg-stone-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <td className="px-3 py-2">
                    <input type="radio" checked={sel} onChange={() => onSelect(o.id)} onClick={(e) => e.stopPropagation()} className="accent-green-600" />
                  </td>
                  <td className="px-2 py-2 font-semibold text-stone-700 whitespace-nowrap">
                    {f.from} → {f.to}
                    {o.status === 'chosen' && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">chosen</span>}
                  </td>
                  <td className="px-2 py-2 text-stone-600 whitespace-nowrap">{f.airline}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-stone-700">{formatTime(f.depart)}</div>
                    <div className="text-stone-400">{formatDay(f.depart)}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-stone-700">
                      {formatTime(f.arrive)}
                      {off > 0 && <span className="text-amber-600 font-medium"> +{off}</span>}
                    </div>
                    <div className="text-stone-400">{formatDay(f.arrive)}</div>
                  </td>
                  <td className="px-2 py-2 text-stone-600 whitespace-nowrap">{formatDuration(durationMinutes(f))}</td>
                  <td className="px-2 py-2 text-stone-600 whitespace-nowrap">
                    {f.stops === 0 ? <span className="text-green-700 font-medium">Nonstop</span> : `${f.stops} stop${f.via ? ` · ${f.via}` : ''}${f.layover ? ` (${f.layover})` : ''}`}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-stone-800 whitespace-nowrap">{money(o.totalPrice)}</td>
                  <td className="px-2 py-2 text-right text-stone-600 whitespace-nowrap">{money(perPerson(o))}</td>
                  <td className="px-2 py-2 text-right text-stone-600 whitespace-nowrap" title={pen ? `includes +$${pen} airport penalty` : undefined}>
                    {money(adjustedPerPerson(o, penalties))}{pen ? <span className="text-stone-300"> *</span> : null}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <a href={o.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">search ↗</a>
                    {(f.cabinNotes || o.notes) && (
                      <span className="ml-2 text-stone-300 cursor-help" title={[f.cabinNotes, o.notes].filter(Boolean).join('\n\n')}>ⓘ</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChipGroup({
  label, values, active, onToggle, display,
}: {
  label: string;
  values: string[];
  active: Set<string>;
  onToggle: (v: string) => void;
  display?: (v: string) => string;
}) {
  if (values.length <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-stone-400">{label}</span>
      {values.map((v) => {
        const on = active.has(v);
        return (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={`px-2 py-0.5 rounded-full border font-mono transition-colors ${
              on ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            {display ? display(v) : v}
          </button>
        );
      })}
    </div>
  );
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];
  return next;
}
