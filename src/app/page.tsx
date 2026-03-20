/**
 * Homepage — wardpulse.org
 *
 * Landing page + "My Ward" auto-detect.
 * Sprint 1: Static landing with links to map and ward pages.
 * Post-Sprint 1: GPS auto-detect → show your ward's scorecard.
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            WardPulse
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Ward-level civic service delivery intelligence
          </p>
          <p className="text-lg text-gray-500 mb-8">
            Harare · Chitungwiza · Epworth — 78 wards
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/map"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              View Ward Map
            </Link>
            <Link
              href="/report"
              className="border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Report an Issue
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How WardPulse Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Report',
              description: 'Citizens report service delivery failures — water, roads, sanitation, waste — in 3 taps from their phone.',
            },
            {
              step: '2',
              title: 'Score',
              description: 'Each ward gets a public grade (A-F) based on per-capita report rates. The scoring formula is transparent and published.',
            },
            {
              step: '3',
              title: 'Accountability',
              description: 'Councillors, journalists, NGOs, and donors see the data. When ignoring citizens has a public cost, service delivery improves.',
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {step}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage stats */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">78</p>
              <p className="text-sm text-gray-500">Wards covered</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">3</p>
              <p className="text-sm text-gray-500">Municipalities</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">6</p>
              <p className="text-sm text-gray-500">Report categories</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
          <p>WardPulse — Open source civic intelligence</p>
          <div className="flex gap-4 justify-center mt-2">
            <Link href="/methodology" className="hover:underline">Methodology</Link>
            <Link href="/map" className="hover:underline">Map</Link>
            <Link href="/report" className="hover:underline">Report</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
