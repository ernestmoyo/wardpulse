import { NextRequest, NextResponse } from 'next/server';
import { getWards, getWardsByMunicipality } from '@/lib/db';

/** GET /api/wards?municipality=harare */
export async function GET(request: NextRequest) {
  const municipality = request.nextUrl.searchParams.get('municipality');

  const wards = municipality
    ? getWardsByMunicipality(municipality)
    : getWards();

  // Strip geometry for lightweight responses
  const wardsWithoutGeom = wards.map(({ geom, ...rest }) => rest);

  return NextResponse.json({ wards: wardsWithoutGeom, count: wardsWithoutGeom.length });
}
