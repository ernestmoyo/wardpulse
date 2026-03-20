import { NextRequest, NextResponse } from 'next/server';
import { getWardScorecard } from '@/lib/db';

/** GET /api/ward/26/score — returns scorecard for a ward */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const wardNumber = Number(id);

  if (isNaN(wardNumber)) {
    return NextResponse.json({ error: 'Invalid ward number' }, { status: 400 });
  }

  const scorecard = getWardScorecard(wardNumber);

  if (!scorecard) {
    return NextResponse.json({ error: `Ward ${id} not found` }, { status: 404 });
  }

  // Strip geometry from response
  const { geom, ...wardWithoutGeom } = scorecard.ward;

  return NextResponse.json({
    ...scorecard,
    ward: wardWithoutGeom,
  });
}
