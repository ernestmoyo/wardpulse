/**
 * Local JSON File Database
 *
 * Stores reports in data/reports.json for local development.
 * No external dependencies. Zero config.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  MIGRATION NOTE                                         │
 * │                                                         │
 * │  This module is a LOCAL-ONLY stand-in for Supabase.     │
 * │  When migrating to Supabase:                            │
 * │                                                         │
 * │  1. Run scripts/schema.sql in Supabase SQL Editor       │
 * │  2. Run scripts/wards.sql to load ward data             │
 * │  3. Replace this module's exports with Supabase client  │
 * │     queries (see src/lib/supabase.ts)                   │
 * │  4. Import data/reports.json into the reports table      │
 * │  5. Delete this file                                    │
 * │                                                         │
 * │  All API routes import from this file — single swap.    │
 * └─────────────────────────────────────────────────────────┘
 */

import fs from 'fs';
import path from 'path';
import type { Report, Ward, ReportCategory, ReportStatus, WardScore } from './types';
import { computeAllScores, computeWardScorecard } from './scoring';

// ─── File paths ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const WARDS_GEOJSON = path.join(process.cwd(), 'public', 'wards.geojson');
const WARD_NAMES_FILE = path.join(DATA_DIR, 'ward_names.json');

// ─── Ward data (from GeoJSON, read-only) ─────────────────────────────────────

let wardsCache: Ward[] | null = null;

export function getWards(): Ward[] {
  if (wardsCache) return wardsCache;

  const raw = JSON.parse(fs.readFileSync(WARDS_GEOJSON, 'utf-8'));
  let wardNames: Record<string, Record<string, string[]>> = {};
  try {
    wardNames = JSON.parse(fs.readFileSync(WARD_NAMES_FILE, 'utf-8'));
  } catch {
    // ward names file optional
  }

  wardsCache = raw.features.map((f: { properties: Record<string, unknown>; geometry: unknown }) => {
    const p = f.properties;
    const muni = String(p.municipality || 'harare');
    const wardNum = String(p.ward_number);
    const areaNames = wardNames[muni]?.[wardNum];
    const areas = areaNames ? areaNames.join(', ') : null;

    return {
      id: Number(p.ward_number),
      name: String(p.name || `Ward ${p.ward_number}`),
      ward_number: Number(p.ward_number),
      areas,
      municipality: muni,
      district: String(p.district || ''),
      province: String(p.province || 'Harare'),
      population: p.population ? Number(p.population) : null,
      geom: f.geometry,
    } as Ward;
  });

  return wardsCache!;
}

export function getWard(wardNumber: number): Ward | null {
  return getWards().find((w) => w.ward_number === wardNumber) ?? null;
}

export function getWardsByMunicipality(municipality: string): Ward[] {
  return getWards().filter((w) => w.municipality === municipality);
}

// ─── Reports (JSON file, read-write) ─────────────────────────────────────────

function readReports(): Report[] {
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeReports(reports: Report[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
}

export function getReports(filters?: {
  ward_id?: number;
  category?: ReportCategory;
  status?: ReportStatus;
  municipality?: string;
}): Report[] {
  let reports = readReports();

  if (filters?.ward_id) {
    reports = reports.filter((r) => r.ward_id === filters.ward_id);
  }
  if (filters?.category) {
    reports = reports.filter((r) => r.category === filters.category);
  }
  if (filters?.status) {
    reports = reports.filter((r) => r.status === filters.status);
  }
  if (filters?.municipality) {
    const wardIds = getWardsByMunicipality(filters.municipality).map((w) => w.id);
    reports = reports.filter((r) => wardIds.includes(r.ward_id));
  }

  return reports.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getReport(id: number): Report | null {
  return readReports().find((r) => r.id === id) ?? null;
}

export function createReport(data: {
  ward_id: number;
  category: ReportCategory;
  description?: string;
  lat?: number;
  lng?: number;
  photo_url?: string;
  source?: 'citizen' | 'resident_review';
}): Report {
  const reports = readReports();
  const maxId = reports.length > 0 ? Math.max(...reports.map((r) => r.id)) : 0;

  const report: Report = {
    id: maxId + 1,
    ward_id: data.ward_id,
    category: data.category,
    description: data.description ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    photo_url: data.photo_url ?? null,
    status: 'open',
    source: data.source ?? 'citizen',
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
  };

  reports.push(report);
  writeReports(reports);
  return report;
}

export function updateReportStatus(
  id: number,
  status: ReportStatus,
): Report | null {
  const reports = readReports();
  const report = reports.find((r) => r.id === id);
  if (!report) return null;

  // Validate transition
  const validTransitions: Record<ReportStatus, ReportStatus[]> = {
    open: ['acknowledged', 'resolved'],
    acknowledged: ['resolved'],
    resolved: [], // no reopening in Phase 1
  };

  if (!validTransitions[report.status]?.includes(status)) {
    return null; // invalid transition
  }

  report.status = status;
  if (status === 'acknowledged') report.acknowledged_at = new Date().toISOString();
  if (status === 'resolved') report.resolved_at = new Date().toISOString();

  writeReports(reports);
  return report;
}

// ─── Scoring (computed from reports + wards) ─────────────────────────────────

export function getWardScores(): WardScore[] {
  const reports = readReports();
  const wards = getWards();
  const populations = wards.map((w) => ({ ward_id: w.id, population: w.population }));

  // Aggregate report counts per ward × category
  const countMap = new Map<string, {
    ward_id: number;
    category: ReportCategory;
    open_count: number;
    resolved_count: number;
    acknowledged_count: number;
    avg_response_days: number | null;
  }>();

  for (const report of reports) {
    const key = `${report.ward_id}:${report.category}`;
    if (!countMap.has(key)) {
      countMap.set(key, {
        ward_id: report.ward_id,
        category: report.category,
        open_count: 0,
        resolved_count: 0,
        acknowledged_count: 0,
        avg_response_days: null,
      });
    }
    const entry = countMap.get(key)!;
    if (report.status === 'open') entry.open_count++;
    if (report.status === 'resolved') entry.resolved_count++;
    if (report.status === 'acknowledged') entry.acknowledged_count++;
  }

  // Compute avg response days for resolved reports
  for (const [key, entry] of countMap) {
    const resolvedReports = reports.filter(
      (r) => r.ward_id === entry.ward_id && r.category === entry.category && r.resolved_at
    );
    if (resolvedReports.length > 0) {
      const totalDays = resolvedReports.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime();
        const resolved = new Date(r.resolved_at!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      entry.avg_response_days = Math.round((totalDays / resolvedReports.length) * 10) / 10;
    }
  }

  return computeAllScores(Array.from(countMap.values()), populations);
}

export function getWardScorecard(wardNumber: number) {
  const ward = getWard(wardNumber);
  if (!ward) return null;

  const allScores = getWardScores();
  return computeWardScorecard(ward, allScores);
}
