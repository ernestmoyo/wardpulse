'use client';

/**
 * MapView — MapLibre GL JS ward choropleth map
 *
 * DATA FLOW:
 *   1. Fetch ward scores from /api/ward-scores
 *   2. Load /public/wards.geojson into MapLibre
 *   3. Color each ward polygon by grade (A=green → F=red)
 *   4. Click ward → /ward/{ward_number}
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};
const DEFAULT_COLOR = '#d1d5db';

const HARARE_CENTER: [number, number] = [31.05, -17.83];

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
}

export default function MapView({
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

    map.on('load', async () => {
      // Fetch ward scores to color the map
      let wardGrades: Record<string, string> = {};
      try {
        const res = await fetch('/api/ward-scores');
        if (res.ok) {
          const data = await res.json();
          wardGrades = data.grades ?? {};
        }
      } catch {
        // scores unavailable — map shows gray
      }

      // Build a color expression: match ward_number → grade color
      const colorExpression: maplibregl.ExpressionSpecification = [
        'match',
        ['get', 'ward_number'],
        // will be filled with [wardNum, color] pairs
      ] as unknown as maplibregl.ExpressionSpecification;

      // Add each ward's color
      for (const [wardNum, grade] of Object.entries(wardGrades)) {
        if (grade && GRADE_COLORS[grade]) {
          (colorExpression as unknown[]).push(Number(wardNum), GRADE_COLORS[grade]);
        }
      }
      // Default fallback color
      (colorExpression as unknown[]).push(DEFAULT_COLOR);

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
          'fill-color': Object.keys(wardGrades).length > 0 ? colorExpression : DEFAULT_COLOR,
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.8,
            0.55,
          ],
        },
      });

      map.addLayer({
        id: 'ward-borders',
        type: 'line',
        source: 'wards',
        paint: {
          'line-color': '#374151',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1,
          ],
        },
      });

      map.addLayer({
        id: 'ward-labels',
        type: 'symbol',
        source: 'wards',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
          'text-halo-blur': 0,
        },
      });

      // Popup on hover
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
      });

      let hoveredId: string | number | null = null;

      map.on('mousemove', 'ward-fills', (e) => {
        if (!e.features?.length) return;
        const feat = e.features[0];
        const props = feat.properties;

        if (hoveredId !== null) {
          map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: false });
        }
        hoveredId = feat.id ?? null;
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: true });
        }
        map.getCanvas().style.cursor = 'pointer';

        // Show popup with ward info
        const wn = String(props?.ward_number);
        const grade = wardGrades[wn] ?? 'No data';
        const areas = props?.areas || '';
        const name = props?.name || `Ward ${wn}`;
        const muni = props?.municipality || '';

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: system-ui; font-size: 13px; line-height: 1.4;">
              <strong>${name}</strong>
              ${areas ? `<br/><span style="color:#6b7280">${areas}</span>` : ''}
              <br/><span style="color:#6b7280; text-transform:capitalize">${muni}</span>
              <br/>Grade: <strong style="color:${GRADE_COLORS[grade] || '#9ca3af'}; font-size: 16px;">${grade}</strong>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseleave', 'ward-fills', () => {
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'wards', id: hoveredId }, { hover: false });
        }
        hoveredId = null;
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Click → ward page
      map.on('click', 'ward-fills', (e) => {
        const props = e.features?.[0]?.properties;
        if (props?.ward_number) {
          router.push(`/ward/${props.ward_number}`);
        }
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, router]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden" />;
}
