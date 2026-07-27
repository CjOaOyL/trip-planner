import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import CountryBorders from '../components/CountryBorders';
import performersKml from '../../data/trips/france-2026/maps/performers.kml?raw';
import visitorsKml from '../../data/trips/france-2026/maps/visitors.kml?raw';

// ── KML parsing ───────────────────────────────────────────────────────────────

interface KmlStop {
  name: string;
  description: string;
  position: [number, number]; // [lat, lng]
}

interface KmlLayer {
  title: string;
  stops: KmlStop[];
  route: [number, number][];
}

function parseKml(kml: string): KmlLayer {
  const doc = new DOMParser().parseFromString(kml, 'application/xml');
  const title = doc.querySelector('Document > name')?.textContent ?? 'Route';
  const stops: KmlStop[] = [];
  let route: [number, number][] = [];

  doc.querySelectorAll('Placemark').forEach((pm) => {
    const name = pm.querySelector('name')?.textContent ?? '';
    const description = pm.querySelector('description')?.textContent ?? '';
    const point = pm.querySelector('Point > coordinates');
    const line = pm.querySelector('LineString > coordinates');
    if (point?.textContent) {
      const [lng, lat] = point.textContent.trim().split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        stops.push({ name, description, position: [lat, lng] });
      }
    } else if (line?.textContent) {
      route = line.textContent
        .trim()
        .split(/\s+/)
        .map((triple) => {
          const [lng, lat] = triple.split(',').map(Number);
          return [lat, lng] as [number, number];
        })
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    }
  });

  return { title, stops, route };
}

function layerBounds(layers: KmlLayer[]): [[number, number], [number, number]] | null {
  const pts = layers.flatMap((l) => [...l.stops.map((s) => s.position), ...l.route]);
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

// ── Auto-fit bounds ───────────────────────────────────────────────────────────

function BoundsFitter({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, bounds]);
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PERFORMER_COLOR = '#e07a38';
const VISITOR_COLOR = '#38a0e0';

export default function TourMapsPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [showPerformers, setShowPerformers] = useState(true);
  const [showVisitors, setShowVisitors] = useState(true);
  const [europeOnly, setEuropeOnly] = useState(true);

  const performers = useMemo(() => parseKml(performersKml), []);
  const visitors = useMemo(() => parseKml(visitorsKml), []);

  const shown = useMemo(() => {
    const layers: { layer: KmlLayer; color: string }[] = [];
    if (showPerformers) layers.push({ layer: performers, color: PERFORMER_COLOR });
    if (showVisitors) layers.push({ layer: visitors, color: VISITOR_COLOR });
    return layers;
  }, [showPerformers, showVisitors, performers, visitors]);

  // Europe-only view drops the US stops (west of -30° lng) so the trip detail is legible
  const bounds = useMemo(() => {
    const clipped = shown.map(({ layer, color }) => ({
      color,
      layer: europeOnly
        ? {
            ...layer,
            stops: layer.stops.filter((s) => s.position[1] > -30),
            route: layer.route.filter((p) => p[1] > -30),
          }
        : layer,
    }));
    return layerBounds(clipped.map((c) => c.layer));
  }, [shown, europeOnly]);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <button
        onClick={() => navigate(`/trip/${tripId}`)}
        className="text-sm text-stone-400 hover:text-stone-700 mb-6 block"
      >
        ← Back to Trip
      </button>

      <h1 className="text-3xl font-bold text-stone-800 mb-1">Tour Maps</h1>
      <p className="text-stone-500 mb-4">
        The full performer tour route and the family (visitor) route, side by side.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPerformers}
            onChange={(e) => setShowPerformers(e.target.checked)}
          />
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PERFORMER_COLOR }} />
          <span className="font-medium text-stone-700">Performer tour ({performers.stops.length} stops)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showVisitors}
            onChange={(e) => setShowVisitors(e.target.checked)}
          />
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: VISITOR_COLOR }} />
          <span className="font-medium text-stone-700">Family / visitor route ({visitors.stops.length} stops)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={europeOnly}
            onChange={(e) => setEuropeOnly(e.target.checked)}
          />
          <span className="font-medium text-stone-700">Zoom to Europe (hide US legs)</span>
        </label>
      </div>

      <MapContainer
        center={[45, 5]}
        zoom={5}
        className="w-full rounded-2xl z-0"
        style={{ height: '70vh' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds && <BoundsFitter bounds={bounds} />}
        <CountryBorders />

        {shown.map(({ layer, color }) => (
          <div key={layer.title}>
            <Polyline
              positions={layer.route}
              pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: '6 4' }}
            />
            {layer.stops.map((stop) => (
              <CircleMarker
                key={`${layer.title}-${stop.name}`}
                center={stop.position}
                radius={8}
                pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <div className="text-xs font-semibold">{stop.name}</div>
                </Tooltip>
                <Popup maxWidth={320}>
                  <div className="text-sm font-bold mb-1">{stop.name}</div>
                  <div className="text-xs whitespace-pre-wrap max-h-56 overflow-y-auto">
                    {stop.description}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </div>
        ))}
      </MapContainer>

      <p className="text-xs text-stone-400 mt-3">
        Click a stop for its schedule, address, and booking details. Orange = performer tour bus route ·
        Blue = family drive/flight route.
      </p>
    </div>
  );
}
