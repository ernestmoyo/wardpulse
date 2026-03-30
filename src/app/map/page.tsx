'use client';

/**
 * Public Map Page — /map
 *
 * Full-screen ward choropleth map.
 * Click any ward to navigate to its scorecard.
 */

import MapView from '@/components/MapView';

export default function MapPage() {
  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">WardPulse</h1>
          <p className="text-sm text-gray-500">Harare · Chitungwiza · Epworth — 78 wards</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/" className="text-blue-600 hover:underline">Home</a>
          <a href="/report" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Report Issue</a>
        </nav>
      </header>

      {/* Map legend */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 text-xs shrink-0">
        <span className="text-gray-900 font-bold">Grade:</span>
        {[
          { grade: 'A', color: '#22c55e', label: 'A (Best)' },
          { grade: 'B', color: '#84cc16', label: 'B' },
          { grade: 'C', color: '#eab308', label: 'C' },
          { grade: 'D', color: '#f97316', label: 'D' },
          { grade: 'F', color: '#ef4444', label: 'F (Worst)' },
          { grade: '—', color: '#d1d5db', label: 'No data' },
        ].map(({ grade, color, label }) => (
          <span key={grade} className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded inline-block border border-gray-300" style={{ backgroundColor: color }} />
            <span className="text-gray-900 font-semibold">{label}</span>
          </span>
        ))}
      </div>

      {/* Map (fills remaining space) */}
      <div className="flex-1">
        <MapView />
      </div>
    </main>
  );
}
