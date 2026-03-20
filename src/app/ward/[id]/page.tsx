/**
 * Ward Scorecard Page — /ward/[id]
 *
 * Reads ward + score data from local JSON db.
 * Displays scorecard, ward details, and report CTA.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import WardScorecard from '@/components/WardScorecard';
import { getWardScorecard, getReports } from '@/lib/db';

export default async function WardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wardNumber = Number(id);
  const scorecard = getWardScorecard(wardNumber);

  if (!scorecard) notFound();

  const recentReports = getReports({ ward_id: wardNumber }).slice(0, 10);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/map" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to map
        </Link>

        <WardScorecard scorecard={scorecard} />

        {/* Ward details */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Ward Details</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Municipality</dt>
            <dd className="capitalize font-medium">{scorecard.ward.municipality}</dd>
            <dt className="text-gray-500">District</dt>
            <dd className="font-medium">{scorecard.ward.district}</dd>
            <dt className="text-gray-500">Population</dt>
            <dd className="font-medium">{scorecard.ward.population?.toLocaleString() ?? 'Unknown'}</dd>
            <dt className="text-gray-500">Ward Number</dt>
            <dd className="font-medium">{scorecard.ward.ward_number}</dd>
          </dl>
        </div>

        {/* Recent reports */}
        {recentReports.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Recent Reports</h3>
            <ul className="space-y-3">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-start gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    r.status === 'open' ? 'bg-red-100 text-red-700' :
                    r.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {r.status}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium capitalize">{r.category}</span>
                    {r.description && (
                      <p className="text-gray-500 mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
