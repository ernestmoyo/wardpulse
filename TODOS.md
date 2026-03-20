# WardPulse — TODOs

## Architecture Decisions (Locked In)
- **Stack:** Next.js (App Router + RSC streaming) + MapLibre GL JS + Supabase (PostGIS) + Vercel
- **Scoring:** Per-capita normalized, category-weighted (water 30%, roads 25%, sanitation 25%, waste 20%)
- **Auth:** Public dashboards. Admin password for Asher + Ernest. Councillor responses proxied by Asher.
- **Coverage:** Harare (46 wards) + Chitungwiza (25 wards) + Epworth (7 wards) = 78 total. Filtered by LOCAL_AUTH field in shapefile.
- **Scoring threshold:** MIN_REPORTS_FOR_GRADE = 3 (below that, show "Insufficient data")
- **Sprint plan:** Sprint 1 (demo-ready: TODOs 5,1,2,4 + map + scorecard), Sprint 2 (feature-complete: TODOs 3,6,7,8,9,10 + admin + mayor)
- **Domain:** wardpulse.org
- **Categories:** Data-driven from Resident Review (water, roads, sanitation, waste, infrastructure, health)
- **Photos:** Compressed client-side (<200KB), optional
- **Map tiles:** MapLibre + free OpenMapTiles vector tiles (from GeoBlackout pattern)
- **Analytics:** Self-hosted Umami
- **GeoJSON:** Pre-simplified static file on Vercel CDN
- **Geocoding:** PostGIS ST_Contains server-side

## Confirmed Shapefile Data (from inspection 2026-03-20)
- **Total Zimbabwe wards:** 1,980
- **Harare Province:** 78 wards (Harare 46 + Chitungwiza 25 + Epworth 7)
- **Filter field:** LOCAL_AUTH (not PROVINCE)
- **Filter values:** 'Harare City Council', 'Chitungwiza Municipality', 'Epworth Local Board'
- **Key fields:** WARDNUMBER (int), DISTRICT, LOCAL_AUTH, INTEGRITY, WARDAREASQ, geometry
- **NO ward names in shapefile** — must create manual WARDNUMBER → area name lookup
- **Harare ward count discrepancy:** Shapefile has 46, Asher references 45 — verify with Asher
- **Population = 0 guard:** Scoring engine must handle wards with missing population data (division by zero)

## Sprint Plan
```
SPRINT 1 — Demo Ready (3-4 days)
  Day 1: TODO 5 (categories) + TODO 1 (data pipeline)
  Day 2: TODO 2 (scoring engine) + Map page
  Day 3: TODO 4 (seed data) + Ward scorecard page
  Day 4: Mayor dashboard + buffer
  Tests: 22 (T1-T6, T12-T14, T15-T22, T23-T28)
  DELIVERABLE: wardpulse.org with map, scores, seeded data

SPRINT 2 — Feature Complete (5-7 days)
  TODO 3 (report wizard) + TODO 6 (My Ward) + TODO 7 (compare)
  TODO 8 (methodology) + TODO 9 (OG images) + TODO 10 (anti-spam)
  Admin panel + Mayor dashboard refinement
  Tests: 17 (T7-T11, T29-T39)
  DELIVERABLE: Full Phase 1 feature set, 39 tests
```

## Phase 1 — MVP Build

### TODO 1: Shapefile-to-PostGIS Data Pipeline [BLOCKER]
**What:** Script to load admin3 ward shapefiles into Supabase PostGIS, filter to Harare + Chitungwiza, join population data, and export simplified GeoJSON for frontend.

**Why:** No wards in DB = no app. Foundation for reverse geocoding, dashboards, scoring, and map view.

**Pros:** Unlocks all other development. Reusable for future city expansion.

**Cons:** Requires Supabase project to be created first. Census data may need manual ward-name matching.

**Context:**
- Input shapefiles: `Geographic Data/Administrative Units/Zimbabwe_admin3_wards/zwe_polbnda_adm3_250k_cso.*`
- Population data: `Population Data/2022 Census data.xlsx` (preferred) or `ZW_census_2012_ward population estimates.xlsx` (fallback)
- Output: `wards` table in PostGIS (with councillor_name column) + `public/wards.geojson` (simplified via ST_Simplify)
- Use Python (geopandas + sqlalchemy) or ogr2ogr CLI
- **Confirmed shapefile fields:** PROVINCE, DISTRICT, LOCAL_AUTH, WARDNUMBER, INTEGRITY, WARDAREASQ, geometry
- **Filter:** `LOCAL_AUTH.isin(['Harare City Council', 'Chitungwiza Municipality', 'Epworth Local Board'])` = 78 wards
- **Municipality mapping:** LOCAL_AUTH → municipality column (harare/chitungwiza/epworth)
- **Ward names:** NOT in shapefile. Must create manual lookup (WARDNUMBER → area names from Resident Review)
- **Ward counts:** Harare 46, Chitungwiza 25, Epworth 7 (Asher references 45 Harare — discrepancy to verify)
- Add GIST index on geom column for ST_Contains queries
- Validate geometries at load time (ST_IsValid) — shapefile has 10 'Boundary adjusted' + 2 '?' integrity status wards in Harare

**Effort:** M | **Priority:** P1
**Depends on:** Supabase project created
**Blocks:** Everything else

---

### TODO 2: Ward Scoring Engine
**What:** Compute per-capita normalized, category-weighted grades (A-F) for each ward.

**Why:** The scoring engine IS the product. It turns raw reports into accountability pressure. Without grades, WardPulse is just a suggestion box.

**Pros:** Creates the accountability loop. Makes wards comparable. Gives journalists and donors a single metric.

**Cons:** Requires population data (from TODO 1). Scoring formula needs to be defensible — publish on /methodology.

**Context:**
- Formula: `raw_score = open_reports / (population / 1000)` per category
- Percentile rank among all wards → grade (A=top 20%, F=bottom 20%)
- Overall grade: weighted average (water 30%, roads 25%, sanitation 25%, waste 20%)
- Store computed scores in `ward_scores` table: `ward_id, category, grade, open_count, resolved_count, avg_response_days, computed_at`
- Recompute on: new report submission, admin status change
- Handle edge cases: 0 reports → "Insufficient data" (no grade), 1 report → show data + "limited data" note

**Effort:** M | **Priority:** P1
**Depends on:** TODO 1 (wards table with population)
**Blocks:** Ward scorecards, mayor dashboard, compare page

---

### TODO 3: "Report in 3 Taps" Flow
**What:** Multi-step report wizard optimized for 30-second completion on slow mobile connections.

**Why:** Most civic apps fail because reporting is too much work. This succeeds by respecting citizens' time and data costs. The 3-tap flow is the first thing to demo to Asher.

**Pros:** Low friction = high adoption. Optional fields mean even a category + GPS = useful data.

**Cons:** Must work on low-end Android browsers (Samsung J-series, Tecno, Itel) common in Zimbabwe.

**Context:**
- Step 1: Category icon grid (big touch targets, 6 categories from Resident Review data)
- Step 2: Location auto-detected from GPS, confirm or change via ward dropdown
- Step 3: Submit button + optional description + optional photo (compressed <200KB)
- Disable submit button after first tap (prevent double-submit on slow connections)
- Auto-save draft to localStorage if user navigates away mid-upload
- Borrows multi-step modal pattern from GeoBlackout

**Effort:** M | **Priority:** P1
**Depends on:** Category taxonomy finalized (TODO 5)
**Blocks:** Nothing (can ship with traditional form, upgrade later)

---

### TODO 4: Seed Platform with Resident Review Data
**What:** Extract structured service delivery data from Asher's 35 Resident Review ward investigation posts and bulk-import as historical reports.

**Why:** Launching with empty dashboards undermines credibility. Asher has investigated 35/45 Harare wards. Also validates the category taxonomy (TODO 5).

**Pros:** Instant content. Makes scorecards immediately useful. Powerful demo for Asher meeting.

**Cons:** Mixing journalist-sourced and citizen-sourced reports — need `source` field to distinguish.

**Context:**
- Source: 35 LinkedIn Resident Review posts (archived in `asher_mutandiro_linkedin_posts.txt`)
- Extract per ward: categories mentioned, key issues, date
- Import as reports with `source='resident_review'`, `status='historical'`, `created_at=original post date`
- Requires Asher's explicit approval
- Use this extraction to validate/refine category taxonomy (TODO 5)

**Effort:** M | **Priority:** P1
**Depends on:** DB schema, Asher's approval, TODO 5 (categories)
**Blocks:** Nothing (nice-to-have for launch demo)

---

### TODO 5: Data-Driven Category Taxonomy
**What:** Derive report categories from Asher's actual 35-ward investigation data, not assumptions.

**Why:** The assumed 4 categories (water, roads, sanitation, waste) miss real recurring issues like street lighting, illegal dumping, and health facility access.

**Pros:** Categories match real Zimbabwean service delivery failures. More useful for councillors and NGOs.

**Cons:** Need to read and extract from 35 posts. Some issues may be too specific for categories (edge cases → "other").

**Context:**
- Known recurring issues from posts: water supply, roads/potholes, sewage/sanitation, waste collection, street lighting (defunct), illegal dumping, land/housing, health facility access
- Proposed taxonomy: Water | Roads | Sanitation | Waste | Infrastructure | Health
- Each category can have sub-categories for detail (e.g., Infrastructure → street lighting, public buildings)
- Category weights for scoring: water(30%) > roads(25%) > sanitation(25%) > waste(20%) — adjust if new categories warrant it

**Effort:** S | **Priority:** P1
**Depends on:** Reading Asher's posts (already archived)
**Blocks:** TODO 2 (scoring), TODO 3 (report form), TODO 4 (seed data)

---

### TODO 5b: Ward Name Lookup Table (Non-Blocking)
**What:** Manual mapping of WARDNUMBER → residential area names for all 78 wards.

**Why:** The shapefile has NO ward names — only numbers. Citizens know "Glen View" not "Ward 26". Without area names, the map is less useful.

**Pros:** Makes the platform citizen-friendly. Enables GPS auto-detect to show "You're in Glen View (Ward 26)" instead of "You're in Ward 26".

**Cons:** Manual data entry for 78 wards. Harare (~35 known from Resident Review), Chitungwiza and Epworth need research or Asher's input.

**Context:**
- Known from Resident Review: Ward 26 → 'Western Triangle, Glen View 7 & 8 Ext', Ward 18 → 'Borrowdale, Greystone Park, Mandara', Ward 37 → 'Kuwadzana', Ward 6 → 'Southlea Park, Amsterdam Park', Ward 13 → 'Lochinvar, Southerton', Ward 7 → 'Chisipiti, Ballantyne Park, Colne Valley'
- Output: `ward_names.json` or `areas` column in wards table
- Ask Asher to fill in gaps during/after the meeting
- Sprint 1 ships with "Ward N" display; area names added progressively

**Effort:** S | **Priority:** P2
**Depends on:** TODO 1 (wards loaded), Asher's input
**Blocks:** Nothing (progressive enhancement)

---

### TODO 6: "My Ward" Homepage (GPS Auto-Detect)
**What:** Homepage detects citizen's GPS location, shows their ward's scorecard immediately. localStorage remembers for return visits.

**Why:** Makes WardPulse feel personal. Citizens open the site and see THEIR ward, not a generic map. Difference between a tool people use once and one they check weekly.

**Pros:** Instant relevance. No navigation needed. Return visitors see their ward immediately.

**Cons:** Requires GPS permission (fallback: ward dropdown or city-wide map).

**Context:**
- First visit: request GPS → PostGIS reverse geocode → show ward scorecard → save to localStorage
- Return visit: load ward from localStorage → show scorecard instantly → [Change ward] link
- Fallback if GPS denied: show city-wide map with "Select your ward" prompt
- No account, no signup

**Effort:** S | **Priority:** P1
**Depends on:** TODO 1 (wards in DB), TODO 2 (scoring engine)
**Blocks:** Nothing

---

### TODO 7: Ward Comparison Page
**What:** Select 2-5 wards for side-by-side scorecard + category breakdown comparison. Shareable URL.

**Why:** This is what Asher was already doing manually (Post #6 — water supply bar chart across 8 wards). We automate it. Journalists and NGOs use this for advocacy.

**Pros:** Killer feature for journalism. Shareable URLs drive organic traffic. Validates ward-level policy design advocacy.

**Cons:** Needs enough data to be meaningful. Empty wards in comparison = awkward.

**Context:**
- URL: /compare?wards=26,37,6 (shareable, bookmarkable)
- Side-by-side: grade, category breakdowns, response rate
- Min 2 wards, max 5 (screen real estate)
- Handle: invalid ward IDs → skip gracefully, all wards "Insufficient data" → show empty state message

**Effort:** M | **Priority:** P1
**Depends on:** TODO 2 (scoring engine)
**Blocks:** Nothing

---

### TODO 8: /methodology Page
**What:** Static page explaining scoring formula, data sources, and methodology in plain language.

**Why:** Credibility. Journalists cite it because it's transparent. Government can't dismiss it because the math is public. Donors fund it because it's rigorous.

**Pros:** 1 hour to write. Worth 10x in credibility.

**Cons:** None.

**Context:**
- Explain: per-capita normalization, category weights, grade thresholds, data sources (census, ward boundaries)
- Include: "All data is public. All formulas are open. Challenge us."
- Link from every ward scorecard

**Effort:** S | **Priority:** P1
**Depends on:** Scoring formula finalized (TODO 2)
**Blocks:** Nothing

---

### TODO 9: Dynamic OG Images Per Ward
**What:** Generate dynamic Open Graph preview cards per ward using @vercel/og. When ward links are shared on LinkedIn/WhatsApp/Twitter, they show a visual scorecard card.

**Why:** Every link Asher shares becomes a visual, clickable, data-rich card. Free marketing on every share. This is how civic data goes viral — same pattern as GeoBlackout.

**Pros:** Organic sharing amplification. Asher shares ward links weekly to 5,350 followers.

**Cons:** @vercel/og has some rendering limitations (limited CSS subset).

**Context:**
- Use @vercel/og Edge function
- Dynamic per ward: name, grade (color-coded), category mini-stats, report count
- Cached at Vercel CDN (regenerate on score change)
- Also set for /compare page (show compared wards in card)

**Effort:** S | **Priority:** P1
**Depends on:** TODO 2 (scoring data to display)
**Blocks:** Nothing

---

### TODO 10: Anti-Spam / Abuse Protection
**What:** Rate limiting, honeypot fields, and admin review queue to protect against spam and political manipulation.

**Why:** Anonymous reporting in Zimbabwe's political climate could be weaponized with fake reports.

**Pros:** Protects data integrity, builds government trust.

**Cons:** Over-aggressive filtering could suppress legitimate reports.

**Context:**
- Layer 1: Rate limit — 10 reports/hour per IP (Vercel edge middleware)
- Layer 2: Honeypot — hidden form field that bots fill
- Layer 3: Admin review — Asher reviews flagged/suspicious reports via /admin
- No CAPTCHA (bad UX on low-end mobile)
- Discuss with Asher: publish immediately + flag for review, or queue for review first?

**Effort:** S | **Priority:** P2
**Depends on:** Admin panel built
**Blocks:** Nothing (can retrofit post-launch)

---

## Phase 1.1 — Post-Launch (1-2 months)

### TODO 11: "Ward of the Week" Auto-Generated Social Cards
**What:** Auto-generate weekly shareable cards for worst-performing and most-improved wards. Asher posts on LinkedIn.

**Why:** Free marketing. Drives report submissions. Creates councillor pressure. Automates what Asher already does manually.

**Effort:** S | **Priority:** P2
**Depends on:** Scoring engine + OG image infrastructure

---

### TODO 12: Shona/Ndebele Language Support (i18n)
**What:** Set up next-intl, build all UI with translatable keys, add Shona translations via Asher's network.

**Effort:** M | **Priority:** P2
**Depends on:** UI built

---

### TODO 13: PWA / Offline-First
**What:** Service worker + PWA manifest for offline access and home screen install.

**Effort:** S | **Priority:** P2

---

## MIGRATION: Local JSON → Supabase (when ready to go online)

**Current state:** All data stored locally in JSON files (`data/reports.json`, `public/wards.geojson`, `data/ward_names.json`). The `src/lib/db.ts` module is the single abstraction layer — all API routes and pages import from it.

**When to migrate:** When you're ready to deploy publicly, need multi-user writes, or want real-time updates.

**Migration steps:**
1. Create a Supabase project at supabase.com
2. Enable PostGIS: SQL Editor → `CREATE EXTENSION IF NOT EXISTS postgis;`
3. Run `scripts/schema.sql` in Supabase SQL Editor (creates wards, reports, ward_scores tables)
4. Run `scripts/wards.sql` in Supabase SQL Editor (loads 78 wards with geometry + population)
5. Import `data/reports.json` into the reports table (write a small migration script or use Supabase CSV import)
6. Add credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```
7. Replace `src/lib/db.ts` with Supabase queries (the interface stays the same — `getWards()`, `getReports()`, `createReport()`, etc.)
8. The `src/lib/supabase.ts` client is already set up and ready to use
9. Delete `src/lib/db.ts` after migration is confirmed working
10. Deploy to Vercel, point wardpulse.org DNS

**What changes:** Only `src/lib/db.ts` gets replaced. All API routes, pages, and components stay the same because they import from `db.ts` not directly from file system or Supabase.

**What doesn't change:** Scoring engine (`scoring.ts`), types (`types.ts`), components, pages, API route signatures.

---

## Phase 2 — Scale (3-6 months)

- Migrate from local JSON to Supabase (see migration guide above)
- Councillor magic link emails (weekly digest + response portal)
- WhatsApp bot for citizen reporting
- SMS/USSD reporting channel
- Donor impact dashboard
- Multi-city expansion (Bulawayo, Mutare, Masvingo)
- NGO data export API
- Automated data backups to separate jurisdiction
- EXIF metadata stripping on photo uploads
- Per-user admin accounts with audit log
