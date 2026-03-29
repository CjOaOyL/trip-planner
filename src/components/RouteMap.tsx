import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { Itinerary, Place, PlaceType } from '../types';
import { buildRouteData } from '../utils/routeUtils';

// ── Marker color by place type ────────────────────────────────────────────────

const TYPE_COLOR: Record<PlaceType, string> = {
  university:         '#6366f1', // indigo
  restaurant:         '#f97316', // orange
  attraction:         '#14b8a6', // teal
  hotel:              '#a855f7', // purple
  'ski-resort':       '#0ea5e9', // sky
  'charging-station': '#22c55e', // green
  neighborhood:       '#ec4899', // pink
  museum:             '#f59e0b', // amber
  park:               '#84cc16', // lime
  other:              '#94a3b8', // slate
};

const TYPE_EMOJI: Record<PlaceType, string> = {
  university:         '🎓',
  restaurant:         '🍽',
  attraction:         '📍',
  hotel:              '🛏',
  'ski-resort':       '⛷',
  'charging-station': '⚡',
  neighborhood:       '🏘',
  museum:             '🏛',
  park:               '🌿',
  other:              '📌',
};

// ── Auto-fit bounds ───────────────────────────────────────────────────────────

function BoundsFitter({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, bounds]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  itinerary: Itinerary;
  places: Record<string, Place>;
  onPlaceClick: (place: Place) => void;
}

export default function RouteMap({ itinerary, places, onPlaceClick }: Props) {
  const route = useMemo(
    () => buildRouteData(itinerary, places),
    [itinerary, places]
  );

  // Initial center — midpoint of bounds
  const center: [number, number] = [
    (route.bounds[0][0] + route.bounds[1][0]) / 2,
    (route.bounds[0][1] + route.bounds[1][1]) / 2,
  ];

  return (
    <MapContainer
      center={center}
      zoom={6}
      className="w-full rounded-2xl z-0"
      style={{ height: '360px' }}
      scrollWheelZoom={false}
    >
      {/* Map tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Auto-fit */}
      <BoundsFitter bounds={route.bounds} />

      {/* Route polylines */}
      {route.legs.map((leg, i) => (
        <Polyline
          key={i}
          positions={[leg.from, leg.to]}
          pathOptions={{
            color: '#e05c4b',
            weight: 3,
            opacity: 0.7,
            dashArray: '6 4',
          }}
        />
      ))}

      {/* Place markers */}
      {route.stops.map(({ place, isChargingStop, isOvernight }) => {
        const color = TYPE_COLOR[place.type] ?? '#94a3b8';
        const emoji = TYPE_EMOJI[place.type] ?? '📌';
        const radius = isChargingStop ? 6 : isOvernight ? 10 : 8;

        return (
          <CircleMarker
            key={place.id}
            center={place.coordinates}
            radius={radius}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onPlaceClick(place) }}
          >
            <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
              <div className="text-xs font-semibold">
                {emoji} {place.name}
              </div>
              {place.blackOwned && (
                <div className="text-[10px] font-bold text-white bg-black px-1 rounded mt-0.5 inline-block">
                  Black-owned
                </div>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
