'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  { id: 'water', label: 'Water Supply', icon: '💧' },
  { id: 'roads', label: 'Roads & Potholes', icon: '🚧' },
  { id: 'sanitation', label: 'Sewage & Sanitation', icon: '🚽' },
  { id: 'waste', label: 'Waste & Dumping', icon: '🗑️' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '💡' },
  { id: 'health', label: 'Health & Clinics', icon: '🏥' },
];

type Step = 'category' | 'ward' | 'details' | 'done';

export default function ReportPage() {
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState('');
  const [wardId, setWardId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ward_id: Number(wardId),
          category,
          description: description || undefined,
          source: 'citizen',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportId(data.report.id);
        setStep('done');
      } else {
        alert(data.error || 'Failed to submit report');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <Link href="/" className="text-xl font-bold text-gray-900">WardPulse</Link>
        <Link href="/map" className="text-sm text-blue-600 hover:underline">View Map</Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {['category', 'ward', 'details'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === s ? 'bg-blue-600 text-white' :
                  ['category', 'ward', 'details'].indexOf(step) > i || step === 'done'
                    ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {['category', 'ward', 'details'].indexOf(step) > i || step === 'done' ? '✓' : i + 1}
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>

          {/* Step 1: Category */}
          {step === 'category' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What's the issue?</h2>
              <p className="text-gray-500 mb-6">Select a category</p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setStep('ward'); }}
                    className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                  >
                    <span className="text-3xl block mb-2">{cat.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Ward */}
          {step === 'ward' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Which ward?</h2>
              <p className="text-gray-500 mb-6">
                Selected: <span className="font-medium capitalize">{category}</span>
                <button onClick={() => setStep('category')} className="text-blue-600 ml-2 text-sm">(change)</button>
              </p>
              <select
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl text-lg mb-4 bg-white"
              >
                <option value="">Select your ward...</option>
                <optgroup label="Harare">
                  {Array.from({ length: 46 }, (_, i) => i + 1).map((n) => (
                    <option key={`h${n}`} value={n}>Ward {n} — Harare</option>
                  ))}
                </optgroup>
                <optgroup label="Chitungwiza">
                  {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                    <option key={`c${n}`} value={n}>Ward {n} — Chitungwiza</option>
                  ))}
                </optgroup>
                <optgroup label="Epworth">
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                    <option key={`e${n}`} value={n}>Ward {n} — Epworth</option>
                  ))}
                </optgroup>
              </select>
              <button
                disabled={!wardId}
                onClick={() => setStep('details')}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Step 3: Details + Submit */}
          {step === 'details' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Any details?</h2>
              <p className="text-gray-500 mb-6">Optional — you can skip this and submit now</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue (optional)..."
                rows={4}
                className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 resize-none"
              />

              <div className="bg-gray-100 rounded-xl p-4 mb-4 text-sm">
                <p><span className="font-medium">Category:</span> <span className="capitalize">{category}</span></p>
                <p><span className="font-medium">Ward:</span> {wardId}</p>
                {description && <p><span className="font-medium">Details:</span> {description}</p>}
              </div>

              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                onClick={() => setStep('ward')}
                className="w-full text-gray-500 py-2 text-sm mt-2 hover:text-gray-700"
              >
                Back
              </button>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted!</h2>
              <p className="text-gray-500 mb-6">Report #{reportId} has been logged. Thank you for helping improve your ward.</p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/ward/${wardId}`}
                  className="bg-blue-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors"
                >
                  View Ward Scorecard
                </Link>
                <button
                  onClick={() => { setStep('category'); setCategory(''); setWardId(''); setDescription(''); }}
                  className="border-2 border-gray-200 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Submit Another Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
