import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import * as topojson from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';
import type { GeoJsonObject } from 'geojson';

let cachedGeoJson: GeoJsonObject | null = null;

export default function CountryBorders() {
  const [geoJson, setGeoJson] = useState<GeoJsonObject | null>(cachedGeoJson);

  useEffect(() => {
    if (cachedGeoJson) return;
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((r) => r.json())
      .then((topo: Topology) => {
        const geo = topojson.mesh(topo, (topo as Topology<Objects>).objects.countries, (a, b) => a !== b);
        cachedGeoJson = geo as unknown as GeoJsonObject;
        setGeoJson(cachedGeoJson);
      })
      .catch(() => {/* fail silently — borders are decorative */});
  }, []);

  if (!geoJson) return null;

  return (
    <GeoJSON
      key="country-borders"
      data={geoJson}
      style={{
        color: '#64748b',
        weight: 1.5,
        opacity: 0.55,
        fill: false,
      }}
    />
  );
}
