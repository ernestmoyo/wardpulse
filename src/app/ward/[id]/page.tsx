/**
 * Ward Scorecard Page — /ward/[id]
 *
 * Displays the full scorecard for a single ward:
 *   - Overall grade + category breakdown
 *   - Recent reports list
 *   - Mini map centered on ward
 *   - Link to report an issue
 *
 * For Sprint 1 demo: uses static seed data from GeoJSON.
 * Post-Sprint 1: fetches from Supabase API.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import WardScorecard from '@/components/WardScorecard';
import type { Ward, WardScorecard as ScorecardType, WardScore } from '@/lib/types';

// Load ward data from GeoJSON at build time
async function getWardData(wardNumber: string): Promise<Ward | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const geojsonPath = path.join(process.cwd(), 'public', 'wards.geojson');
    const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

    const feature = data.features.find(
      (f: { properties: { ward_number: number } }) =>
        String(f.properties.ward_number) === wardNumber
    );

    if (!feature) return null;

    const props = feature.properties;
    return {
      id: props.ward_number,
      name: props.name || `Ward ${props.ward_number}`,
      ward_number: props.ward_number,
      areas: props.areas || null,
      municipality: props.municipality,
      district: props.district || 'Unknown',
      province: props.province || 'Harare',
      population: props.population || null,
      geom: feature.geometry,
    };
  } catch {
    return null;
  }
}

// Placeholder scorecard for Sprint 1 (before Supabase is connected)
function makeDemoScorecard(ward: Ward): ScorecardType {
  const demoScores: WardScore[] = [
    { ward_id: ward.id, category: 'water', grade: null, open_count: 0, resolved_count: 0, avg_response_days: null, computed_at: new Date().toISOString() },
    { ward_id: ward.id, category: 'roads', grade: null, open_count: 0, resolved_count: 0, avg_response_days: null, computed_at: new Date().toISOString() },
    { ward_id: ward.id, category: 'sanitation', grade: null, open_count: 0, resolved_count: 0, avg_response_days: null, computed_at: new Date().toISOString() },
    { ward_id: ward.id, category: 'waste', grade: null, open_count: 0, resolved_count: 0, avg_response_days: null, computed_at: new Date().toISOString() },
  ];

  return {
    ward,
    overall_grade: null,
    category_scores: demoScores,
    total_open: 0,
    total_resolved: 0,
    response_rate: 0,
  };
}

export default async function WardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ward = await getWardData(id);

  if (!ward) {
    notFound();
  }

  // Sprint 1: demo scorecard (no DB yet)
  // Post-Sprint 1: fetch from /api/ward/[id]/score
  const scorecard = makeDemoScorecard(ward);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link href="/map" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to map
        </Link>

        {/* Scorecard */}
        <WardScorecard scorecard={scorecard} />

        {/* Ward details */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Ward Details</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Municipality</dt>
            <dd className="capitalize font-medium">{ward.municipality}</dd>
            <dt className="text-gray-500">District</dt>
            <dd className="font-medium">{ward.district}</dd>
            <dt className="text-gray-500">Population</dt>
            <dd className="font-medium">{ward.population?.toLocaleString() ?? 'Unknown'}</dd>
            <dt className="text-gray-500">Ward Number</dt>
            <dd className="font-medium">{ward.ward_number}</dd>
          </dl>
        </div>

        {/* Report CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/report"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Report an issue in this ward
          </Link>
        </div>
      </div>
    </main>
  );
}
