/**
 * WardScorecard — Visual grade display for a ward
 */

import type { WardScorecard as ScorecardType, Grade, ReportCategory } from '@/lib/types';
import { MIN_REPORTS_FOR_GRADE } from '@/lib/types';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  water: 'Water', roads: 'Roads', sanitation: 'Sanitation',
  waste: 'Waste', infrastructure: 'Infrastructure', health: 'Health', other: 'Other',
};

const CATEGORY_ORDER: ReportCategory[] = ['water', 'roads', 'sanitation', 'waste', 'infrastructure', 'health'];

function GradeBadge({ grade, size = 'lg' }: { grade: Grade; size?: 'sm' | 'lg' }) {
  const color = grade ? GRADE_COLORS[grade] : '#9ca3af';
  const cls = size === 'lg' ? 'w-20 h-20 text-4xl' : 'w-10 h-10 text-lg';
  return (
    <div className={`${cls} rounded-lg flex items-center justify-center font-bold text-white`} style={{ backgroundColor: color }}>
      {grade ?? '—'}
    </div>
  );
}

export default function WardScorecard({ scorecard, compact = false }: { scorecard: ScorecardType; compact?: boolean }) {
  const { ward, overall_grade, category_scores, total_open, total_resolved, response_rate } = scorecard;
  const total = total_open + total_resolved;
  const maxOpen = Math.max(...category_scores.map((s) => s.open_count), 1);

  const statusLabel = total === 0 ? 'No data yet' : total < MIN_REPORTS_FOR_GRADE ? 'Limited data' : '';
  const areaDisplay = ward.areas ? `${ward.name} — ${ward.areas}` : ward.name;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start gap-4 mb-4">
        <GradeBadge grade={overall_grade} size={compact ? 'sm' : 'lg'} />
        <div className="flex-1">
          <h2 className={`font-bold text-gray-900 ${compact ? 'text-lg' : 'text-xl'}`}>{areaDisplay}</h2>
          <p className="text-sm text-gray-500 capitalize">{ward.municipality}</p>
          {statusLabel ? (
            <p className="text-sm text-amber-600 mt-1">{statusLabel}</p>
          ) : (
            <div className="flex gap-4 mt-1 text-sm text-gray-600">
              <span>{total_open} open</span><span>·</span>
              <span>{total_resolved} resolved</span><span>·</span>
              <span>Response: {response_rate}%</span>
            </div>
          )}
        </div>
      </div>
      {!compact && category_scores.length > 0 && (
        <div className="mt-4 space-y-1">
          {CATEGORY_ORDER.map((cat) => {
            const score = category_scores.find((s) => s.category === cat);
            if (!score) return null;
            const color = score.grade ? GRADE_COLORS[score.grade] : '#9ca3af';
            const barW = Math.max((score.open_count / maxOpen) * 100, 5);
            return (
              <div key={cat} className="flex items-center gap-3 py-1">
                <span className="w-28 text-sm text-gray-600 shrink-0">{CATEGORY_LABELS[cat]}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: color }} />
                </div>
                <span className="w-8 text-center text-sm font-semibold" style={{ color }}>{score.grade ?? '—'}</span>
                <span className="w-14 text-right text-xs text-gray-500">{score.open_count} open</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
