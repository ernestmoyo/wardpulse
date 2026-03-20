'use client';

/**
 * MapView — MapLibre GL JS ward choropleth map
 *
 * DATA FLOW:
 *   /public/wards.geojson (static, CDN) → MapLibre → choropleth by grade
 *   Click ward → router.push(/ward/{id})
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308',
  D: '#f97316', F: '#ef4444',
};
const DEFAULT_COLOR = '#9ca3af';

const HARARE_CENTER: [number, number] = [31.05, -17.83];

const MAP_STYLE = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE
  || 'https://openmaptiles.data.gouv.fr/styles/osm-bright/style.json';

interface MapViewProps {
  wardGrades?: Record<string, string | null>;
  center?: [number, number];
  zoom?: number;
}

export default function MapView({
  wardGrades = {},
  center = HARARE_CENTER,
  zoom = 11,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('wards', {
        type: 'geojson',
        data: '/wards.geojson',
        promoteId: 'ward_number',
      });

      map.addLayer({
        id: 'ward-fills',
        type: 'fill',
        source: 'wards',
        paint: {
          'fill-color': DEFAULT_COLOR,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 0.4],
        },
      });

      map.addLayer({
        id: 'ward-borders',
        type: 'line',
        source: 'wards',
        paint: {
          'line-color': '#374151',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1],
        },
      });

      map.addLayer({
        id: 'ward-labels',
        type: 'symbol',
        source: 'wards',
        layout: { 'text-field': ['get', 'name'], 'text-size': 11 },
        paint: { 'text-color': '#1f2937', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });

      // Hover
      let hoveredId: string | number | null = null;
      map.on('mousemove', 'ward-fills', (e) => {
        if (!e.features?.length) return;
        if (hoveredId !== null) map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: false });
        hoveredId = e.features[0].id ?? null;
        if (hoveredId !== null) map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ward-fills', () => {
        if (hoveredId !== null) map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: false });
        hoveredId = null;
        map.getCanvas().style.cursor = '';
      });

      // Click → ward page
      map.on('click', 'ward-fills', (e) => {
        const props = e.features?.[0]?.properties;
        if (props?.ward_number) router.push(`/ward/${props.ward_number}`);
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [center, zoom, router, wardGrades]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden" />;
}
