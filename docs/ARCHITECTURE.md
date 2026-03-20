# WardPulse — Architecture Document

## Overview

WardPulse is a civic service delivery intelligence platform for Zimbabwe. It collects anonymous citizen reports about service delivery failures, geocodes them to administrative wards, scores each ward using per-capita normalized grades, and displays the results on public dashboards.

The system covers **78 wards** across Harare Province: Harare City Council (46 wards), Chitungwiza Municipality (25 wards), and Epworth Local Board (7 wards).

The system is designed for Zimbabwe's infrastructure constraints: mobile-first, low bandwidth, intermittent connectivity, expensive data costs.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CITIZEN (mobile browser)                      │
│                                                                     │
│  Homepage:     GPS → ward detected → scorecard shown                │
│  Report:       3-tap wizard (category → location → submit)          │
│  Evidence:     Optional photo, compressed <200KB client-side        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS (POST /api/reports)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS APP (Vercel)                          │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ React Server     │  │ API Routes       │  │ Edge Functions   │  │
│  │ Components       │  │                  │  │                  │  │
│  │                  │  │ POST /api/reports │  │ OG Image Gen     │  │
│  │ Pages streamed   │  │ GET  /api/reports │  │ (@vercel/og)     │  │
│  │ with data        │  │ GET  /api/wards   │  │                  │  │
│  │ embedded (RSC)   │  │ GET  /api/ward/   │  │ Dynamic per-ward │  │
│  │                  │  │      :id/score    │  │ social preview   │  │
│  │ No loading       │  │ PATCH /api/       │  │ cards            │  │
│  │ spinners on      │  │   reports/:id     │  │                  │  │
│  │ slow connections │  │                  │  │                  │  │
│  └──────────────────┘  └────────┬─────────┘  └──────────────────┘  │
│                                 │                                   │
│  ┌──────────────────────────────┴───────────────────────────────┐  │
│  │                    SCORING ENGINE (lib/scoring.ts)            │  │
│  │                                                               │  │
│  │  Per category (MIN_REPORTS_FOR_GRADE = 3):                     │  │
│  │    raw = open_reports / (population / 1000)                   │  │
│  │    percentile = rank among graded wards (>= 3 reports)        │  │
│  │    grade = A (top 20%) | B | C | D | F (bottom 20%)          │  │
│  │                                                               │  │
│  │  Overall:                                                     │  │
│  │    weighted_avg = water(0.30) + roads(0.25) +                 │  │
│  │                   sanitation(0.25) + waste(0.20)              │  │
│  │                                                               │  │
│  │  Triggers: new report, admin status change                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                   │
│                                                                     │
│  ┌─────────────────────────────────────┐  ┌──────────────────────┐ │
│  │ PostgreSQL + PostGIS                │  │ Supabase Storage     │ │
│  │                                     │  │                      │ │
│  │ wards                               │  │ report-photos/       │ │
│  │ ├── id          SERIAL PK           │  │   {report_id}.jpg    │ │
│  │ ├── name        TEXT                │  │                      │ │
│  │ ├── municipality TEXT               │  │ Max file: 200KB      │ │
│  │ ├── district    TEXT                │  │ (client-compressed)  │ │
│  │ ├── population  INT                 │  └──────────────────────┘ │
│  │ ├── councillor  TEXT                │                           │
│  │ └── geom        GEOMETRY(MultiPoly) │                           │
│  │     INDEX: GIST(geom)              │                           │
│  │                                     │                           │
│  │ reports                             │                           │
│  │ ├── id              SERIAL PK      │                           │
│  │ ├── ward_id         FK → wards.id  │                           │
│  │ ├── category        ENUM           │                           │
│  │ │   (water|roads|sanitation|       │                           │
│  │ │    waste|infrastructure|health)  │                           │
│  │ ├── description     TEXT           │                           │
│  │ ├── lat             FLOAT          │                           │
│  │ ├── lng             FLOAT          │                           │
│  │ ├── photo_url       TEXT NULL      │                           │
│  │ ├── status          ENUM           │                           │
│  │ │   (open|acknowledged|resolved)   │                           │
│  │ ├── source          ENUM           │                           │
│  │ │   (citizen|resident_review)      │                           │
│  │ ├── created_at      TIMESTAMPTZ    │                           │
│  │ ├── acknowledged_at TIMESTAMPTZ    │                           │
│  │ └── resolved_at     TIMESTAMPTZ    │                           │
│  │     INDEX: (ward_id, status, category)                         │
│  │                                     │                           │
│  │ ward_scores (computed cache)        │                           │
│  │ ├── ward_id         FK → wards.id  │                           │
│  │ ├── category        ENUM           │                           │
│  │ ├── grade           CHAR(1)        │                           │
│  │ ├── open_count      INT            │                           │
│  │ ├── resolved_count  INT            │                           │
│  │ ├── avg_response_days FLOAT        │                           │
│  │ └── computed_at     TIMESTAMPTZ    │                           │
│  └─────────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Data Flows

### 1. Report Submission

```
  CITIZEN PHONE
       │
       │ POST /api/reports
       │ { category, description?, lat?, lng?, ward_id?, photo? }
       ▼
  ┌─────────────────┐
  │ VALIDATE INPUT  │
  │                 │
  │ • category: required, must be valid enum
  │ • description: optional, min 0 chars, sanitized (DOMPurify)
  │ • location: lat/lng OR ward_id required (at least one)
  │ • photo: optional, max 200KB, image/* MIME type
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
  [has GPS]  [has ward_id only]
     │           │
     ▼           │
  ┌──────────┐   │
  │ REVERSE  │   │
  │ GEOCODE  │   │
  │          │   │
  │ SELECT id│   │
  │ FROM     │   │
  │ wards    │   │
  │ WHERE    │   │
  │ ST_Contains(geom, point)
  └────┬─────┘   │
       │         │
  ┌────┴────┐    │
  │         │    │
  [found] [not found]
  │         │
  │    ┌────┴──────────┐
  │    │ REJECT:       │
  │    │ "Location not │
  │    │ in Harare/    │
  │    │ Chitungwiza"  │
  │    └───────────────┘
  │
  ▼
  ┌──────────────────┐
  │ UPLOAD PHOTO     │ (if present)
  │ → Supabase       │
  │   Storage        │
  │ → Get public URL │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ INSERT REPORT    │
  │ → reports table  │
  │ → status='open'  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ RECOMPUTE SCORE  │
  │ → ward_scores    │
  │   table updated  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ RETURN 201       │
  │ { report_id,     │
  │   ward_name,     │
  │   status }       │
  └──────────────────┘
```

### 2. Ward Scorecard Computation

```
  TRIGGER: new report OR admin status change
       │
       ▼
  ┌──────────────────────────────────────────────────┐
  │ FOR EACH category IN ward:                       │
  │                                                  │
  │   open_count = COUNT(reports)                    │
  │                WHERE ward_id = X                 │
  │                AND category = Y                  │
  │                AND status = 'open'               │
  │                                                  │
  │   resolved_count = COUNT(reports)                │
  │                    WHERE status = 'resolved'     │
  │                                                  │
  │   avg_response = AVG(resolved_at - created_at)   │
  │                  WHERE status = 'resolved'       │
  │                                                  │
  │   raw_score = open_count / (population / 1000)   │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │ RANK all wards by raw_score per category         │
  │                                                  │
  │   percentile = ward_rank / total_wards           │
  │                                                  │
  │   grade = CASE                                   │
  │     WHEN percentile <= 0.20 THEN 'A'  (best)    │
  │     WHEN percentile <= 0.40 THEN 'B'            │
  │     WHEN percentile <= 0.60 THEN 'C'            │
  │     WHEN percentile <= 0.80 THEN 'D'            │
  │     ELSE 'F'                         (worst)    │
  │   END                                            │
  │                                                  │
  │   SPECIAL CASE: 0 reports → 'N/A' (no grade)    │
  │   SPECIAL CASE: 1 report → show grade + "limited │
  │                             data" note           │
  └──────────────────────┬───────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────┐
  │ UPSERT ward_scores table                         │
  │                                                  │
  │ Overall grade = weighted average:                │
  │   water(0.30) + roads(0.25) +                    │
  │   sanitation(0.25) + waste(0.20)                 │
  └──────────────────────────────────────────────────┘
```

### 3. Map Data Delivery

```
  BUILD TIME (data pipeline):
  ┌────────────────────┐
  │ Shapefiles         │
  │ (admin3 wards)     │
  └────────┬───────────┘
           │ ogr2ogr / geopandas
           ▼
  ┌────────────────────┐
  │ PostGIS            │
  │ ST_Simplify(0.001) │  ← Reduce vertex count
  │ ST_AsGeoJSON()     │
  └────────┬───────────┘
           │ Export
           ▼
  ┌────────────────────┐
  │ /public/wards.     │  ← Static file, ~200KB
  │ geojson            │     Deployed to Vercel CDN
  └────────┬───────────┘
           │
  RUNTIME:
           │ Browser fetches from CDN (cached)
           ▼
  ┌────────────────────┐
  │ MapLibre GL JS     │
  │                    │
  │ Choropleth:        │
  │ ward fill color =  │
  │   grade → color    │
  │   A → green        │
  │   B → light green  │
  │   C → yellow       │
  │   D → orange       │
  │   F → red          │
  │   N/A → gray       │
  └────────────────────┘
```

## Report Status Lifecycle

```
                    ┌──────────┐
  citizen submits → │   OPEN   │
                    └────┬─────┘
                         │
              admin marks acknowledged
                         │
                    ┌────▼─────────┐
                    │ ACKNOWLEDGED │
                    └────┬─────────┘
                         │
              admin marks resolved
                         │
                    ┌────▼─────┐
                    │ RESOLVED │
                    └──────────┘

  Valid transitions:
    open → acknowledged
    open → resolved        (can skip acknowledged)
    acknowledged → resolved

  Invalid transitions (rejected with 400):
    resolved → open        (no reopening in Phase 1)
    resolved → acknowledged
    acknowledged → open
```

## Security Model

```
  ┌──────────────────────────────────────────────────────────────┐
  │                     ACCESS CONTROL                           │
  │                                                              │
  │  PUBLIC (no auth):                                           │
  │  ├── GET  /                     Homepage                     │
  │  ├── GET  /map                  Public map                   │
  │  ├── GET  /ward/:id             Ward scorecard               │
  │  ├── GET  /mayor/:city          Mayor dashboard              │
  │  ├── GET  /compare              Ward comparison              │
  │  ├── GET  /methodology          Scoring methodology          │
  │  ├── POST /api/reports          Submit report (anonymous)    │
  │  ├── GET  /api/reports          List reports (filtered)      │
  │  ├── GET  /api/wards/geojson    Ward boundaries              │
  │  └── GET  /api/ward/:id/score   Ward score                   │
  │                                                              │
  │  ADMIN (password in header):                                 │
  │  ├── GET  /admin                Admin panel                  │
  │  └── PATCH /api/reports/:id     Update report status         │
  │                                                              │
  │  Rate limiting:                                              │
  │  ├── POST /api/reports          10 per hour per IP           │
  │  └── POST /admin/login          5 per minute per IP          │
  │                                                              │
  │  Input sanitization:                                         │
  │  ├── Report description         DOMPurify (strip HTML/XSS)  │
  │  └── All query params           Parameterized queries (SQL)  │
  └──────────────────────────────────────────────────────────────┘
```

## Zimbabwe-Specific Design Constraints

| Constraint | Impact | Solution |
|-----------|--------|---------|
| Expensive mobile data ($1-2/GB) | Minimize page weight | RSC streaming (no JS-heavy SPA), compressed photos (<200KB), static GeoJSON on CDN (~200KB) |
| Intermittent connectivity | Pages must load fast or fail gracefully | Server-rendered HTML streams immediately. Map tiles cached. Report form saves draft to localStorage. |
| Low-end Android phones | Must work on Samsung J-series, Tecno, Itel | Large touch targets (3-tap wizard), minimal JavaScript, no heavy animations |
| 15% Digital Services Tax | Cloud costs inflated | Supabase + Vercel free tiers cover MVP. Optimize before hitting paid tiers. |
| Political sensitivity | Civic accountability can provoke government pressure | Anonymous reporting. No user accounts. Public methodology. Transparent data. |
| Shona/Ndebele speakers | English-only excludes many citizens | Phase 1: translatable string keys (not hardcoded). Phase 1.1: Shona translations. |

## Error Handling Strategy

Every API route follows this pattern:

```typescript
// Pseudocode — consistent error handling
try {
  // Validate input (return 400 with field-level errors)
  // Process request
  // Return success
} catch (error) {
  if (error instanceof ValidationError) return 400 + field errors
  if (error instanceof NotFoundError)   return 404 + "not found"
  if (error instanceof RateLimitError)  return 429 + retry-after
  if (error instanceof AuthError)       return 401 + "unauthorized"
  // Unexpected error:
  console.error({ route, method, error, timestamp })
  return 503 + "Service temporarily unavailable"
}
```

No silent failures. Every error either returns a user-visible message or logs enough context to debug.

## Deployment

```
  LOCAL DEV          STAGING              PRODUCTION
  ──────────         ───────              ──────────
  npm run dev   →    Vercel Preview  →    wardpulse.org
  localhost:3000     (auto per PR)        (main branch)

  Supabase local →   Supabase dev   →    Supabase prod
  (docker)           project              project
```

Rollback: Vercel instant rollback to any previous deployment. No destructive DB migrations.
