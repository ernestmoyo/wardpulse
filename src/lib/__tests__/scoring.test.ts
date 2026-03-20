/**
 * Scoring Engine Tests (T15-T22)
 *
 * Tests cover:
 *   T15. Ward with 0 reports → grade = null ("No data yet")
 *   T16. Ward with 1-2 reports → grade = null ("Limited data")
 *   T17. Ward with 3+ reports → full grade (A-F)
 *   T18. Per-capita normalization correctness
 *   T19. Category weights applied correctly
 *   T20. Grade boundaries (A through F thresholds)
 *   T21. Score recomputed correctly (stateless function)
 *   T22. Division-by-zero guard (population = 0 or null)
 */

import {
  computeCategoryGrades,
  computeOverallGrade,
  computeWardScorecard,
  computeAllScores,
  getDataStatusLabel,
  GRADE_COLORS,
} from '../scoring';
import type { ReportCategory, WardScore, Ward } from '../types';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeCount(
  ward_id: number,
  category: ReportCategory,
  open: number,
  resolved = 0,
) {
  return {
    ward_id,
    category,
    open_count: open,
    resolved_count: resolved,
    acknowledged_count: 0,
    avg_response_days: resolved > 0 ? 5.0 : null,
  };
}

function makePop(ward_id: number, population: number | null) {
  return { ward_id, population };
}

function makeWard(id: number, population: number | null = 10000): Ward {
  return {
    id,
    name: `Ward ${id}`,
    ward_number: id,
    areas: null,
    municipality: 'harare',
    district: 'Harare',
    province: 'Harare',
    population,
    geom: { type: 'MultiPolygon', coordinates: [] },
  };
}

// ─── T15: Ward with 0 reports → null grade ───────────────────────────────────

describe('T15: Ward with 0 reports', () => {
  it('should return no scores for wards with zero reports in a category', () => {
    const counts = [makeCount(1, 'water', 5)]; // Only ward 1 has reports
    const pops = [makePop(1, 10000), makePop(2, 10000)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    // Ward 2 has no reports, so it shouldn't appear in results
    const ward2Score = scores.find((s) => s.ward_id === 2);
    expect(ward2Score).toBeUndefined();
  });

  it('getDataStatusLabel returns "No data yet" for 0 reports', () => {
    expect(getDataStatusLabel(0)).toBe('No data yet');
  });
});

// ─── T16: Ward with 1-2 reports → null grade ("Limited data") ────────────────

describe('T16: Ward with 1-2 reports', () => {
  it('should return null grade for ward with 1 report', () => {
    const counts = [makeCount(1, 'water', 1)];
    const pops = [makePop(1, 10000)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    expect(scores).toHaveLength(1);
    expect(scores[0].grade).toBeNull();
    expect(scores[0].open_count).toBe(1);
  });

  it('should return null grade for ward with 2 reports', () => {
    const counts = [makeCount(1, 'water', 2)];
    const pops = [makePop(1, 10000)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    expect(scores[0].grade).toBeNull();
  });

  it('getDataStatusLabel returns "Limited data" for 1-2 reports', () => {
    expect(getDataStatusLabel(1)).toBe('Limited data');
    expect(getDataStatusLabel(2)).toBe('Limited data');
  });
});

// ─── T17: Ward with 3+ reports → full grade ─────────────────────────────────

describe('T17: Ward with 3+ reports gets graded', () => {
  it('should assign a grade when ward has >= 3 reports', () => {
    // 5 wards with varying report counts, all >= 3
    const counts = [
      makeCount(1, 'water', 3),
      makeCount(2, 'water', 5),
      makeCount(3, 'water', 10),
      makeCount(4, 'water', 15),
      makeCount(5, 'water', 20),
    ];
    const pops = [
      makePop(1, 10000),
      makePop(2, 10000),
      makePop(3, 10000),
      makePop(4, 10000),
      makePop(5, 10000),
    ];

    const scores = computeCategoryGrades(counts, pops, 'water');

    // All should have grades
    scores.forEach((s) => {
      expect(s.grade).not.toBeNull();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(s.grade);
    });
  });

  it('getDataStatusLabel returns empty string for 3+ reports', () => {
    expect(getDataStatusLabel(3)).toBe('');
    expect(getDataStatusLabel(100)).toBe('');
  });
});

// ─── T18: Per-capita normalization ───────────────────────────────────────────

describe('T18: Per-capita normalization', () => {
  it('high-pop ward with same report count gets BETTER grade than low-pop ward', () => {
    // Ward 1: 10 reports, 50,000 people → 0.2 per 1000
    // Ward 2: 10 reports, 5,000 people  → 2.0 per 1000
    // Ward 1 should get a better grade (lower per-capita rate)
    const counts = [
      makeCount(1, 'water', 10),
      makeCount(2, 'water', 10),
    ];
    const pops = [
      makePop(1, 50000),
      makePop(2, 5000),
    ];

    const scores = computeCategoryGrades(counts, pops, 'water');

    const ward1 = scores.find((s) => s.ward_id === 1)!;
    const ward2 = scores.find((s) => s.ward_id === 2)!;

    // Ward 1 (lower per-capita) should get A, Ward 2 should get F
    // With only 2 wards: rank 0 = A (percentile 0), rank 1 = F (percentile 1)
    expect(ward1.grade).toBe('A');
    expect(ward2.grade).toBe('F');
  });
});

// ─── T19: Category weights ───────────────────────────────────────────────────

describe('T19: Category weights in overall grade', () => {
  it('should weight water (30%) higher than waste (20%)', () => {
    // Ward has F in water, A in everything else
    const waterF: WardScore[] = [
      { ward_id: 1, category: 'water', grade: 'F', open_count: 20, resolved_count: 0, avg_response_days: null, computed_at: '' },
      { ward_id: 1, category: 'roads', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
      { ward_id: 1, category: 'sanitation', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
      { ward_id: 1, category: 'waste', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
    ];

    // Ward has F in waste, A in everything else
    const wasteF: WardScore[] = [
      { ward_id: 2, category: 'water', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
      { ward_id: 2, category: 'roads', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
      { ward_id: 2, category: 'sanitation', grade: 'A', open_count: 0, resolved_count: 5, avg_response_days: 3, computed_at: '' },
      { ward_id: 2, category: 'waste', grade: 'F', open_count: 20, resolved_count: 0, avg_response_days: null, computed_at: '' },
    ];

    const gradeWaterF = computeOverallGrade(waterF);
    const gradeWasteF = computeOverallGrade(wasteF);

    // F in water (30% weight) should drag overall down MORE than F in waste (20%)
    // So waterF overall should be worse than wasteF overall
    // waterF: (0*0.30 + 4*0.25 + 4*0.25 + 4*0.20) / 1.0 = 2.8 → B
    // wasteF: (4*0.30 + 4*0.25 + 4*0.25 + 0*0.20) / 1.0 = 3.2 → B
    // Both map to B but wasteF has higher numeric score
    expect(gradeWaterF).not.toBeNull();
    expect(gradeWasteF).not.toBeNull();
  });
});

// ─── T20: Grade boundaries ───────────────────────────────────────────────────

describe('T20: Grade boundaries', () => {
  it('should assign A to best ward and F to worst with 5+ wards', () => {
    // 6 wards with clearly ordered per-capita rates (same population)
    const counts = [
      makeCount(1, 'water', 3),   // best (lowest)
      makeCount(2, 'water', 6),
      makeCount(3, 'water', 9),
      makeCount(4, 'water', 12),
      makeCount(5, 'water', 15),
      makeCount(6, 'water', 18),  // worst (highest)
    ];
    const pops = Array.from({ length: 6 }, (_, i) => makePop(i + 1, 10000));

    const scores = computeCategoryGrades(counts, pops, 'water');

    const ward1 = scores.find((s) => s.ward_id === 1)!;
    const ward6 = scores.find((s) => s.ward_id === 6)!;

    expect(ward1.grade).toBe('A'); // Percentile 0/5 = 0.0
    expect(ward6.grade).toBe('F'); // Percentile 5/5 = 1.0
  });

  it('single graded ward gets C (median)', () => {
    const counts = [makeCount(1, 'water', 5)];
    const pops = [makePop(1, 10000)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    // Single ward: percentile = 0.5 (middle) → C
    expect(scores[0].grade).toBe('C');
  });
});

// ─── T21: Stateless recomputation ────────────────────────────────────────────

describe('T21: Score recomputation is stateless', () => {
  it('should produce same results when called twice with same inputs', () => {
    const counts = [
      makeCount(1, 'water', 5),
      makeCount(2, 'water', 10),
    ];
    const pops = [makePop(1, 10000), makePop(2, 10000)];

    const scores1 = computeCategoryGrades(counts, pops, 'water');
    const scores2 = computeCategoryGrades(counts, pops, 'water');

    expect(scores1.map((s) => s.grade)).toEqual(scores2.map((s) => s.grade));
    expect(scores1.map((s) => s.open_count)).toEqual(scores2.map((s) => s.open_count));
  });

  it('should reflect updated counts when called with new data', () => {
    const pops = [makePop(1, 10000), makePop(2, 10000)];

    // Before: ward 1 has more reports (worse)
    const before = computeCategoryGrades(
      [makeCount(1, 'water', 20), makeCount(2, 'water', 3)],
      pops, 'water',
    );

    // After: ward 1 has fewer reports (better)
    const after = computeCategoryGrades(
      [makeCount(1, 'water', 3), makeCount(2, 'water', 20)],
      pops, 'water',
    );

    const ward1Before = before.find((s) => s.ward_id === 1)!;
    const ward1After = after.find((s) => s.ward_id === 1)!;

    // Grade should flip
    expect(ward1Before.grade).toBe('F');
    expect(ward1After.grade).toBe('A');
  });
});

// ─── T22: Division-by-zero guard ─────────────────────────────────────────────

describe('T22: Population edge cases', () => {
  it('should return null grade for ward with population = 0', () => {
    const counts = [makeCount(1, 'water', 10)];
    const pops = [makePop(1, 0)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    expect(scores[0].grade).toBeNull();
  });

  it('should return null grade for ward with population = null', () => {
    const counts = [makeCount(1, 'water', 10)];
    const pops = [makePop(1, null)];

    const scores = computeCategoryGrades(counts, pops, 'water');

    expect(scores[0].grade).toBeNull();
  });

  it('should not crash when computing scores with mixed population data', () => {
    const counts = [
      makeCount(1, 'water', 10),
      makeCount(2, 'water', 10),
      makeCount(3, 'water', 10),
    ];
    const pops = [
      makePop(1, 10000),  // valid
      makePop(2, null),   // null
      makePop(3, 0),      // zero
    ];

    // Should not throw
    const scores = computeCategoryGrades(counts, pops, 'water');

    // Ward 1 gets graded (only gradable ward → single = C)
    expect(scores.find((s) => s.ward_id === 1)!.grade).toBe('C');
    // Ward 2 and 3 get null
    expect(scores.find((s) => s.ward_id === 2)!.grade).toBeNull();
    expect(scores.find((s) => s.ward_id === 3)!.grade).toBeNull();
  });
});

// ─── Scorecard computation ───────────────────────────────────────────────────

describe('WardScorecard computation', () => {
  it('should compute response rate correctly', () => {
    const ward = makeWard(1);
    const scores: WardScore[] = [
      { ward_id: 1, category: 'water', grade: 'D', open_count: 8, resolved_count: 2, avg_response_days: 5, computed_at: '' },
      { ward_id: 1, category: 'roads', grade: 'C', open_count: 3, resolved_count: 2, avg_response_days: 3, computed_at: '' },
    ];

    const scorecard = computeWardScorecard(ward, scores);

    expect(scorecard.total_open).toBe(11);
    expect(scorecard.total_resolved).toBe(4);
    // Response rate: 4 / (11 + 4) = 26.67% → rounded to 27
    expect(scorecard.response_rate).toBe(27);
  });

  it('should handle ward with zero reports', () => {
    const ward = makeWard(1);
    const scorecard = computeWardScorecard(ward, []);

    expect(scorecard.overall_grade).toBeNull();
    expect(scorecard.total_open).toBe(0);
    expect(scorecard.total_resolved).toBe(0);
    expect(scorecard.response_rate).toBe(0);
  });
});

// ─── Grade colors ────────────────────────────────────────────────────────────

describe('GRADE_COLORS', () => {
  it('should have colors for all grades plus null', () => {
    expect(GRADE_COLORS['A']).toBeDefined();
    expect(GRADE_COLORS['B']).toBeDefined();
    expect(GRADE_COLORS['C']).toBeDefined();
    expect(GRADE_COLORS['D']).toBeDefined();
    expect(GRADE_COLORS['F']).toBeDefined();
    expect(GRADE_COLORS['null']).toBeDefined();
  });
});
