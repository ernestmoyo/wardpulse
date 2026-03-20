/**
 * WardPulse Scoring Engine
 *
 * Computes per-capita normalized, category-weighted grades (A-F) for each ward.
 * Published methodology: /methodology (see docs/SCORING.md)
 *
 * SCORING FLOW:
 * ─────────────
 *   For each ward × category:
 *     1. Count open reports
 *     2. Normalize per 1,000 residents
 *     3. Rank among all graded wards (>= MIN_REPORTS_FOR_GRADE)
 *     4. Assign grade by percentile (A=top 20%, F=bottom 20%)
 *
 *   Overall ward grade:
 *     weighted_avg = water(0.30) + roads(0.25) + sanitation(0.25) + waste(0.20)
 *
 *   Special cases:
 *     - 0 reports → "No data yet" (grade = null)
 *     - 1-2 reports → "Limited data" (grade = null, show reports)
 *     - population = 0 or null → excluded from per-capita ranking
 */

import {
  type ReportCategory,
  type Grade,
  type WardScore,
  type WardScorecard,
  type Ward,
  CATEGORY_WEIGHTS,
  GRADE_VALUES,
  MIN_REPORTS_FOR_GRADE,
} from './types';

// ─── Types for internal scoring ──────────────────────────────────────────────

interface ReportCounts {
  ward_id: number;
  category: ReportCategory;
  open_count: number;
  resolved_count: number;
  acknowledged_count: number;
  avg_response_days: number | null;
}

interface WardPopulation {
  ward_id: number;
  population: number | null;
}

// ─── Grade assignment ────────────────────────────────────────────────────────

function percentileToGrade(percentile: number): Grade {
  if (percentile <= 0.20) return 'A';
  if (percentile <= 0.40) return 'B';
  if (percentile <= 0.60) return 'C';
  if (percentile <= 0.80) return 'D';
  return 'F';
}

function gradeToNumber(grade: Grade): number {
  if (grade === null) return 0;
  return GRADE_VALUES[grade] ?? 0;
}

function numberToGrade(value: number): Grade {
  if (value >= 3.5) return 'A';
  if (value >= 2.5) return 'B';
  if (value >= 1.5) return 'C';
  if (value >= 0.5) return 'D';
  return 'F';
}

// ─── Per-capita scoring ──────────────────────────────────────────────────────

function perCapitaScore(openCount: number, population: number | null): number | null {
  if (population === null || population <= 0) return null;
  return openCount / (population / 1000);
}

// ─── Core scoring function ───────────────────────────────────────────────────

export function computeCategoryGrades(
  counts: ReportCounts[],
  populations: WardPopulation[],
  category: ReportCategory,
): WardScore[] {
  const popMap = new Map(populations.map((p) => [p.ward_id, p.population]));
  const categoryCounts = counts.filter((c) => c.category === category);

  const entries = categoryCounts.map((c) => {
    const population = popMap.get(c.ward_id) ?? null;
    const rawScore = perCapitaScore(c.open_count, population);
    const meetsThreshold = c.open_count >= MIN_REPORTS_FOR_GRADE;

    return {
      ward_id: c.ward_id,
      category,
      open_count: c.open_count,
      resolved_count: c.resolved_count,
      avg_response_days: c.avg_response_days,
      rawScore,
      meetsThreshold,
      canBeGraded: meetsThreshold && rawScore !== null,
    };
  });

  const gradable = entries
    .filter((e) => e.canBeGraded)
    .sort((a, b) => (a.rawScore as number) - (b.rawScore as number));

  const totalGradable = gradable.length;

  const gradeMap = new Map<number, Grade>();
  gradable.forEach((entry, index) => {
    const percentile = totalGradable > 1 ? index / (totalGradable - 1) : 0.5;
    gradeMap.set(entry.ward_id, percentileToGrade(percentile));
  });

  const now = new Date().toISOString();
  return entries.map((e) => ({
    ward_id: e.ward_id,
    category: e.category,
    grade: gradeMap.get(e.ward_id) ?? null,
    open_count: e.open_count,
    resolved_count: e.resolved_count,
    avg_response_days: e.avg_response_days,
    computed_at: now,
  }));
}

// ─── Overall ward grade ──────────────────────────────────────────────────────

export function computeOverallGrade(categoryScores: WardScore[]): Grade {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const score of categoryScores) {
    if (score.grade === null) continue;
    const weight = CATEGORY_WEIGHTS[score.category] ?? 0;
    if (weight === 0) continue;
    weightedSum += gradeToNumber(score.grade) * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  const normalizedScore = weightedSum / totalWeight;
  return numberToGrade(normalizedScore);
}

// ─── Full scorecard computation ──────────────────────────────────────────────

export function computeWardScorecard(
  ward: Ward,
  allCategoryScores: WardScore[],
): WardScorecard {
  const wardScores = allCategoryScores.filter((s) => s.ward_id === ward.id);
  const totalOpen = wardScores.reduce((sum, s) => sum + s.open_count, 0);
  const totalResolved = wardScores.reduce((sum, s) => sum + s.resolved_count, 0);
  const totalReports = totalOpen + totalResolved;
  const responseRate = totalReports > 0
    ? Math.round((totalResolved / totalReports) * 100)
    : 0;

  return {
    ward,
    overall_grade: computeOverallGrade(wardScores),
    category_scores: wardScores,
    total_open: totalOpen,
    total_resolved: totalResolved,
    response_rate: responseRate,
  };
}

// ─── Batch computation ───────────────────────────────────────────────────────

const ALL_CATEGORIES: ReportCategory[] = [
  'water', 'roads', 'sanitation', 'waste', 'infrastructure', 'health', 'other',
];

export function computeAllScores(
  counts: ReportCounts[],
  populations: WardPopulation[],
): WardScore[] {
  const allScores: WardScore[] = [];
  for (const category of ALL_CATEGORIES) {
    const categoryScores = computeCategoryGrades(counts, populations, category);
    allScores.push(...categoryScores);
  }
  return allScores;
}

/**
 * Grade color mapping for UI choropleth.
 */
export const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
  null: '#9ca3af',
};

export function getDataStatusLabel(totalReports: number): string {
  if (totalReports === 0) return 'No data yet';
  if (totalReports < MIN_REPORTS_FOR_GRADE) return 'Limited data';
  return '';
}
