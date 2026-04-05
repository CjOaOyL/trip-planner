import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Itinerary, Place } from '../types';
import { buildRouteData } from '../utils/routeUtils';
import CountryBorders from './CountryBorders';

function BoundsFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) { map.setView(coords[0], 10); return; }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, coords]);
  return null;
}

interface Props {
  itinerary: Itinerary;
  places: Record<string, Place>;
  height?: number;
}

export default function MiniMap({ itinerary, places, height = 160 }: Props) {
  const route = useMemo(() => buildRouteData(itinerary, places), [itinerary, places]);

  const allCoords = useMemo((): [number, number][] =>
    route.stops.map((s) => [s.place.coordinates[0], s.place.coordinates[1]]),
    [route.stops],
  );

  if (allCoords.length === 0) return null;

  const center: [number, number] = [
    (route.bounds[0][0] + route.bounds[1][0]) / 2,
    (route.bounds[0][1] + route.bounds[1][1]) / 2,
  ];

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="w-full rounded-xl z-0"
      style={{ height }}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      doubleClickZoom={false}
      keyboard={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CountryBorders />
      <BoundsFitter coords={allCoords} />

      {route.legs.map((leg, i) => (
        <Polyline
          key={i}
          positions={[leg.from, leg.to]}
          pathOptions={{ color: '#e05c4b', weight: 2, opacity: 0.7, dashArray: '5 4' }}
        />
      ))}

      {route.stops.map(({ place, isOvernight }) => (
        <CircleMarker
          key={place.id}
          center={place.coordinates}
          radius={isOvernight ? 5 : 3.5}
          pathOptions={{
            color: '#fff',
            weight: 1.5,
            fillColor: isOvernight ? '#4f46e5' : '#e05c4b',
            fillOpacity: 1,
          }}
        />
      ))}
    </MapContainer>
  );
}
