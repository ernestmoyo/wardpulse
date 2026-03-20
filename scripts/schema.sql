-- WardPulse — Supabase PostGIS Schema
-- ====================================
-- Run this BEFORE loading wards.sql
--
-- Usage (Supabase SQL Editor):
--   1. Paste this entire file and run
--   2. Then run wards.sql to insert ward data

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Wards table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wards (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,                    -- 'Ward 1', 'Ward 2', etc.
    ward_number   INTEGER NOT NULL,
    areas         TEXT,                             -- Manual mapping: 'Glen View, Budiriro' etc.
    municipality  TEXT NOT NULL CHECK (municipality IN (
                      'harare', 'chitungwiza', 'epworth'
                  )),
    district      TEXT,
    province      TEXT,
    population    INTEGER,                          -- From 2022 Census (NULL if unavailable)
    councillor    TEXT,                             -- Councillor name (added manually)
    geom          GEOMETRY(MultiPolygon, 4326) NOT NULL
);

-- Spatial index for reverse geocoding (ST_Contains lookups)
CREATE INDEX IF NOT EXISTS idx_wards_geom
    ON wards USING GIST(geom);

-- Index for filtering by municipality
CREATE INDEX IF NOT EXISTS idx_wards_municipality
    ON wards(municipality);

-- Unique constraint: one ward number per municipality
ALTER TABLE wards
    ADD CONSTRAINT uq_wards_municipality_number
    UNIQUE (municipality, ward_number);

-- ---------------------------------------------------------------------------
-- Reports table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    ward_id         INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    category        TEXT NOT NULL CHECK (category IN (
                        'water', 'roads', 'sanitation', 'waste',
                        'infrastructure', 'health', 'other'
                    )),
    description     TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    photo_url       TEXT,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                        'open', 'acknowledged', 'resolved'
                    )),
    source          TEXT NOT NULL DEFAULT 'citizen' CHECK (source IN (
                        'citizen', 'resident_review'
                    )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ
);

-- Composite index for dashboard queries (ward + status + category)
CREATE INDEX IF NOT EXISTS idx_reports_ward_status_cat
    ON reports(ward_id, status, category);

-- Index for time-based queries (recent reports, trend analysis)
CREATE INDEX IF NOT EXISTS idx_reports_created_at
    ON reports(created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_reports_status
    ON reports(status);

-- ---------------------------------------------------------------------------
-- Ward scores cache table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ward_scores (
    id                SERIAL PRIMARY KEY,
    ward_id           INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    category          TEXT NOT NULL CHECK (category IN (
                          'water', 'roads', 'sanitation', 'waste',
                          'infrastructure', 'health', 'other', 'overall'
                      )),
    grade             CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F') OR grade IS NULL),
    open_count        INTEGER NOT NULL DEFAULT 0,
    resolved_count    INTEGER NOT NULL DEFAULT 0,
    avg_response_days DOUBLE PRECISION,
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One score per ward per category
    CONSTRAINT uq_ward_scores_ward_category
        UNIQUE (ward_id, category)
);

-- Index for leaderboard queries (sort by grade)
CREATE INDEX IF NOT EXISTS idx_ward_scores_grade
    ON ward_scores(category, grade);

-- Index for ward detail page (all scores for a ward)
CREATE INDEX IF NOT EXISTS idx_ward_scores_ward_id
    ON ward_scores(ward_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (Supabase)
-- ---------------------------------------------------------------------------
-- Public read access, authenticated write

ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_scores ENABLE ROW LEVEL SECURITY;

-- Everyone can read wards
CREATE POLICY "Wards are publicly readable"
    ON wards FOR SELECT
    USING (true);

-- Everyone can read reports
CREATE POLICY "Reports are publicly readable"
    ON reports FOR SELECT
    USING (true);

-- Anyone can submit a report (citizen submissions)
CREATE POLICY "Anyone can submit reports"
    ON reports FOR INSERT
    WITH CHECK (true);

-- Only authenticated users (admins) can update reports
CREATE POLICY "Admins can update reports"
    ON reports FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Ward scores are publicly readable
CREATE POLICY "Ward scores are publicly readable"
    ON ward_scores FOR SELECT
    USING (true);

-- Only service role can modify ward scores (computed by backend)
CREATE POLICY "Service role manages ward scores"
    ON ward_scores FOR ALL
    USING (auth.role() = 'service_role');
