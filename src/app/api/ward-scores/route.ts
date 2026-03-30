import { NextResponse } from 'next/server';
import { getWards, getWardScorecard } from '@/lib/db';
import { computeOverallGrade } from '@/lib/scoring';

/**
 * GET /api/ward-scores
 * Returns { grades: { "26": "D", "37": "F", "18": "B", ... } }
 * Used by MapView to color ward polygons.
 */
export async function GET() {
  const wards = getWards();
  const grades: Record<string, string | null> = {};

  for (const ward of wards) {
    const scorecard = getWardScorecard(ward.ward_number);
    if (scorecard) {
      grades[String(ward.ward_number)] = scorecard.overall_grade;
    }
  }

  return NextResponse.json({ grades });
}
