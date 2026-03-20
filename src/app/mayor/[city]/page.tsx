/**
 * Mayor Dashboard — /mayor/[city]
 * City-wide aggregate view using local JSON db.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWardsByMunicipality, getReports } from '@/lib/db';
import type { Municipality } from '@/lib/types';

const VALID_CITIES: Municipality[] = ['harare', 'chitungwiza', 'epworth'];

const CITY_LABELS: Record<Municipality, string> = {
  harare: 'City of Harare',
  chitungwiza: 'Chitungwiza Municipality',
  epworth: 'Epworth Local Board',
};

export default async function MayorDashboardPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  if (!VALID_CITIES.includes(city as Municipality)) notFound();

  const wards = getWardsByMunicipality(city);
  const reports = getReports({ municipality: city });
  const cityLabel = CITY_LABELS[city as Municipality];
  const totalPop = wards.reduce((s, w) => s + (w.population || 0), 0);
  const openReports = reports.filter((r) => r.status === 'open').length;
  const resolvedReports = reports.filter((r) => r.status === 'resolved').length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/map" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to map
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{cityLabel}</h1>
          <p className="text-gray-500 mt-1">Mayor Dashboard</p>

          <div className="grid grid-cols-4 gap-6 mt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{wards.length}</p>
              <p className="text-sm text-gray-500">Wards</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{totalPop.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Population</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{openReports}</p>
              <p className="text-sm text-gray-500">Open Reports</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{resolvedReports}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Wards</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {wards
              .sort((a, b) => a.ward_number - b.ward_number)
              .map((w) => (
                <Link
                  key={w.ward_number}
                  href={`/ward/${w.ward_number}`}
                  className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">{w.name}</p>
                  {w.areas && <p className="text-xs text-gray-500 truncate">{w.areas}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Pop: {w.population?.toLocaleString() ?? '?'}
                  </p>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
