// WardPulse Core Types

export type Municipality = 'harare' | 'chitungwiza' | 'epworth';

export type ReportCategory = 'water' | 'roads' | 'sanitation' | 'waste' | 'infrastructure' | 'health' | 'other';

export type ReportStatus = 'open' | 'acknowledged' | 'resolved';

export type ReportSource = 'citizen' | 'resident_review';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | null; // null = insufficient data

export interface Ward {
  id: number;
  name: string; // "Ward 26"
  ward_number: number;
  areas: string | null; // "Western Triangle, Glen View 7 & 8 Ext"
  municipality: Municipality;
  district: string;
  province: string;
  population: number | null;
  geom: GeoJSON.MultiPolygon;
}

export interface Report {
  id: number;
  ward_id: number;
  category: ReportCategory;
  description: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  status: ReportStatus;
  source: ReportSource;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface WardScore {
  ward_id: number;
  category: ReportCategory;
  grade: Grade;
  open_count: number;
  resolved_count: number;
  avg_response_days: number | null;
  computed_at: string;
}

export interface WardScorecard {
  ward: Ward;
  overall_grade: Grade;
  category_scores: WardScore[];
  total_open: number;
  total_resolved: number;
  response_rate: number; // 0-100
}

export const CATEGORY_WEIGHTS: Record<ReportCategory, number> = {
  water: 0.30,
  roads: 0.25,
  sanitation: 0.25,
  waste: 0.20,
  infrastructure: 0,  // tracked but not weighted in Phase 1
  health: 0,          // tracked but not weighted in Phase 1
  other: 0,           // never weighted
};

export const GRADE_VALUES: Record<string, number> = {
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  F: 0.0,
};

export const MIN_REPORTS_FOR_GRADE = 3;
