import { NextRequest, NextResponse } from 'next/server';
import { getReports, createReport, getWard } from '@/lib/db';
import type { ReportCategory } from '@/lib/types';

const VALID_CATEGORIES: ReportCategory[] = [
  'water', 'roads', 'sanitation', 'waste', 'infrastructure', 'health', 'other',
];

/** GET /api/reports?ward_id=26&category=water&status=open&municipality=harare */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const reports = getReports({
    ward_id: searchParams.get('ward_id') ? Number(searchParams.get('ward_id')) : undefined,
    category: searchParams.get('category') as ReportCategory | undefined,
    status: searchParams.get('status') as 'open' | 'acknowledged' | 'resolved' | undefined,
    municipality: searchParams.get('municipality') ?? undefined,
  });

  return NextResponse.json({ reports, count: reports.length });
}

/** POST /api/reports — submit a new report */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.ward_id || !body.category) {
      return NextResponse.json(
        { error: 'ward_id and category are required' },
        { status: 400 },
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate ward exists
    const ward = getWard(Number(body.ward_id));
    if (!ward) {
      return NextResponse.json(
        { error: `Ward ${body.ward_id} not found` },
        { status: 404 },
      );
    }

    const report = createReport({
      ward_id: Number(body.ward_id),
      category: body.category,
      description: body.description,
      lat: body.lat ? Number(body.lat) : undefined,
      lng: body.lng ? Number(body.lng) : undefined,
      source: body.source ?? 'citizen',
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
