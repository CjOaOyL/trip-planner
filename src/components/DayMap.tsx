import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Day, Place, Coordinates } from '../types';
import { TYPE_COLOR, TYPE_EMOJI } from '../utils/placeStyles';
import CountryBorders from './CountryBorders';

// ── Auto-fit bounds ───────────────────────────────────────────────────────────

function BoundsFitter({ coords }: { coords: Coordinates[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 13);
      return;
    }
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, coords]);
  return null;
}

// ── Numbered divIcon ──────────────────────────────────────────────────────────

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `
      <div style="
        width:26px;height:26px;border-radius:50%;
        background:${color};border:2.5px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.25);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:#fff;
      ">${n}</div>`,
  });
}

// ── Build ordered stop list for one day ───────────────────────────────────────

interface DayStop {
  place: Place;
  label: string;
  isCharging: boolean;
  isOvernight: boolean;
  order: number;
}

interface DayPolyline {
  positions: Coordinates[];
  dashed: boolean; // dashed = bus/flight/train leg
}

function buildDayRoute(day: Day, places: Record<string, Place>) {
  const stops: DayStop[] = [];
  const lines: DayPolyline[] = [];
  const seen = new Set<string>();
  let order = 1;

  function addStop(placeId: string, label: string, isCharging = false, isOvernight = false) {
    const place = places[placeId];
    if (!place) return;
    if (!seen.has(placeId)) {
      seen.add(placeId);
      stops.push({ place, label, isCharging, isOvernight, order: order++ });
    }
  }

  // Add segment places in schedule order
  day.segments.forEach((seg) => addStop(seg.placeId, seg.activity));

  // Add overnight
  addStop(day.overnightPlaceId, 'Overnight', false, true);

  // Build polylines from legs
  day.legs.forEach((leg) => {
    const from = places[leg.fromPlaceId];
    if (!from) return;

    const waypoints: Coordinates[] = [from.coordinates];

    // Charging stops along the leg
    leg.chargingStops?.forEach((cs) => {
      const cp = places[cs.placeId];
      addStop(cs.placeId, `Charge stop — ${places[cs.placeId]?.name ?? cs.placeId}`, true);
      if (cp) waypoints.push(cp.coordinates);
    });

    const to = places[leg.toPlaceId];
    if (to) waypoints.push(to.coordinates);

    const mode = leg.travelMode ?? 'drive';
    const dashed = mode !== 'drive'; // buses, flights, trains show dashed

    // Emit one line segment per waypoint pair
    for (let i = 0; i < waypoints.length - 1; i++) {
      lines.push({ positions: [waypoints[i], waypoints[i + 1]], dashed });
    }
  });

  // If no explicit legs but multiple segment places, draw a connecting line
  if (lines.length === 0 && stops.length > 1) {
    for (let i = 0; i < stops.length - 1; i++) {
      lines.push({
        positions: [stops[i].place.coordinates, stops[i + 1].place.coordinates],
        dashed: true,
      });
    }
  }

  // All unique coordinates (for bounds fitting)
  const allCoords = stops.map((s) => s.place.coordinates);

  return { stops, lines, allCoords };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  day: Day;
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

export default function DayMap({ day, places, onPlaceClick }: Props) {
  const { stops, lines, allCoords } = useMemo(
    () => buildDayRoute(day, places),
    [day, places],
  );

  if (allCoords.length === 0) return null;

  const center = allCoords[0];

  return (
    <MapContainer
      center={center}
      zoom={10}
      className="w-full rounded-xl z-0"
      style={{ height: '240px' }}
      scrollWheelZoom={false}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsFitter coords={allCoords} />

      {/* Country borders */}
      <CountryBorders />

      {/* Route lines */}
      {lines.map((line, i) => (
        <Polyline
          key={i}
          positions={line.positions}
          pathOptions={{
            color: '#e05c4b',
            weight: 3,
            opacity: 0.75,
            dashArray: line.dashed ? '6 5' : undefined,
          }}
        />
      ))}

      {/* Numbered stop markers */}
      {stops.map(({ place, label, isCharging, isOvernight, order: n }) => {
        const color = isOvernight
          ? '#4f46e5'
          : isCharging
          ? '#22c55e'
          : (TYPE_COLOR[place.type] ?? '#94a3b8');
        const emoji = TYPE_EMOJI[place.type] ?? '📌';

        return (
          <Marker
            key={place.id}
            position={place.coordinates}
            icon={numberedIcon(n, color)}
            eventHandlers={{ click: () => onPlaceClick(place) }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.97} permanent={false}>
              <div className="text-xs font-semibold whitespace-nowrap">
                {emoji} {place.name}
              </div>
              {label !== place.name && (
                <div className="text-[10px] text-stone-500 max-w-[180px] whitespace-normal">{label}</div>
              )}
              {isOvernight && (
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">🛏 Overnight</div>
              )}
              {place.blackOwned && (
                <div className="text-[10px] font-bold text-white bg-black px-1 rounded mt-0.5 inline-block">
                  Black-owned
                </div>
              )}
            </Tooltip>
          </Marker>
        );
      })}

      {/* Charging stop small dots (additional, non-numbered) */}
      {stops.filter((s) => s.isCharging).map(({ place }) => (
        <CircleMarker
          key={`charge-${place.id}`}
          center={place.coordinates}
          radius={5}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#22c55e', fillOpacity: 1 }}
        >
          <Tooltip direction="top" opacity={0.95}>
            <span className="text-xs">⚡ {place.name}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
