# WardPulse — Version 2 Roadmap

> This document outlines planned features and improvements for the next version of WardPulse, informed by the founding meeting between Ernest Moyo and Asher Munashe Mutandiro (2026-03-30).

---

## Current State (v1.0 — Demo/MVP)

What exists today:
- Interactive ward map with 78 wards (Harare 46 + Chitungwiza 25 + Epworth 7)
- Ward scorecards with A-F grades (per-capita normalized, category-weighted)
- 3-step citizen report form (category → ward → submit)
- Local JSON storage (no cloud database yet)
- Simulated seed data (408 reports across 26 wards)
- Public methodology page
- Grade legend and hover tooltips on map

What's missing:
- Real data from Asher's Resident Review investigations
- Infrastructure overlay layers (water pipes, sewer, roads, lighting)
- Admin panel for report moderation
- Ward comparison page
- Councillor response tracking
- Multi-language support (Shona/Ndebele)
- Mobile optimization / PWA

---

## Version 2.0 — Real Data + Infrastructure Layers

### Priority 1: Replace Simulated Data with Real Data

**Goal:** Load Asher's actual ward investigation data from his Google Forms/spreadsheet.

- [ ] Receive Google Forms link from Asher with existing ward survey data
- [ ] Create data import pipeline (Google Sheets → JSON → WardPulse)
- [ ] Map Asher's data fields to WardPulse categories (water, roads, sanitation, waste, infrastructure, health)
- [ ] Create historical timeline from Asher's 35 ward investigations (2024-2026)
- [ ] Preserve `source: 'resident_review'` vs `source: 'citizen'` distinction
- [ ] Display data provenance on each report ("Source: Resident Review, Ward 26 investigation, Jan 2025")

### Priority 2: Infrastructure Overlay Layers

**Goal:** Show what infrastructure EXISTS in each ward, not just complaints.

Data to request from Ministry of Local Government / City of Harare:
- Water pipe network shapefiles
- Sewer network shapefiles
- Road classification (tarred/gravel/unpaved)
- Street lighting locations and status
- Storm drainage network

Implementation:
- [ ] Toggle-able overlay layers on the map
- [ ] Layer legend showing pipe types, road classes, light status
- [ ] Per-ward infrastructure summary ("Ward 26: 12km water pipes, 3km sewer, 60% roads tarred, 0 working street lights")
- [ ] Infrastructure vs service delivery correlation view

```
MAP LAYER STACK:
  ┌─────────────────────────┐
  │ Ward labels (top)        │
  │ Report pins              │
  │ Street lighting points   │
  │ Sewer lines (blue)       │
  │ Water pipes (cyan)       │
  │ Road network (gray)      │
  │ Ward polygons (colored)  │
  │ OpenStreetMap base tiles  │
  └─────────────────────────┘
```

### Priority 3: Water Supply Frequency Tracking

**Goal:** Asher's key insight — track HOW OFTEN each ward gets water, not just complaints.

- [ ] New data field: `water_frequency` (daily, 3x/week, 2x/week, weekly, fortnightly, none)
- [ ] Visual indicator on ward scorecard: "Water supply: Once per week"
- [ ] Comparison view: side-by-side water frequency across wards
- [ ] Historical tracking: "Ward 26 water improved from 1x/week to 3x/week since March 2026"
- [ ] This directly supports Asher's argument: "it's not a Harare issue — it's specific to certain wards"

### Priority 4: Budget Allocation Transparency

**Goal:** Show how municipal budget correlates with service delivery quality.

- [ ] Ward-level budget allocation data (request from Council)
- [ ] Budget per capita calculation
- [ ] Correlation view: budget vs ward grade
- [ ] "Ward 35 (Grade F) receives $X per capita. Ward 18 (Grade B) receives $Y per capita."
- [ ] This supports Asher's policy advocacy: wards with worse infrastructure should get more budget

---

## Version 2.1 — Councillor Accountability

### Councillor Response Tracking

- [ ] Councillor profiles per ward (name, contact, term dates)
- [ ] Report acknowledgement/resolution tracking per councillor
- [ ] Response rate metric: "Councillor J. Moyo — 34% response rate, avg 12 days"
- [ ] Weekly councillor digest email (magic link, no login required)
- [ ] Public councillor leaderboard

### Ward Comparison Page

- [ ] Select 2-5 wards for side-by-side comparison
- [ ] Shareable URL (/compare?wards=26,37,18)
- [ ] Category breakdown bars
- [ ] Infrastructure comparison
- [ ] Budget comparison (when data available)

---

## Version 2.2 — Community Engagement

### Multi-Language Support

- [ ] Shona translation of all UI text
- [ ] Ndebele translation
- [ ] Language toggle in header
- [ ] Use next-intl framework

### PWA / Offline Support

- [ ] Service worker for offline access
- [ ] PWA manifest for "Add to Home Screen"
- [ ] Offline report queue (submit when back online)
- [ ] Cached ward data for low-connectivity areas

### Social Sharing & Launch Campaign

- [ ] Dynamic OG images per ward (share on LinkedIn/WhatsApp shows ward grade card)
- [ ] "Ward of the Week" auto-generated social card (worst + most improved)
- [ ] Countdown launch campaign (10 days to go → launch)
- [ ] WardPulse social media page (LinkedIn, Twitter/X)

---

## Version 3.0 — Platform Scale

### AI Integration

- [ ] AI-powered report categorization (citizen types free text → auto-categorized)
- [ ] Anomaly detection (sudden spike in reports for a ward)
- [ ] Natural language summary generation ("Ward 26 summary: Water supply has been non-existent for 3 weeks. 15 new reports this week, up 200% from last week.")
- [ ] Environmental scanning: auto-extract service delivery mentions from newspapers, social media, council minutes

### Data Export & API

- [ ] Public API for NGOs and researchers
- [ ] CSV/PDF export for reports and scorecards
- [ ] Quarterly impact report auto-generation for donors
- [ ] Embeddable ward scorecard widget for news sites

### Multi-City Expansion

- [ ] Bulawayo (first expansion city)
- [ ] Mutare, Masvingo, Gweru
- [ ] Configurable municipality setup (admin can add new cities)
- [ ] National dashboard aggregating all cities

### Monetization Features

- [ ] Training/capacity building modules for local government staff
- [ ] Premium analytics dashboard for councillors
- [ ] Sponsored data collection campaigns (NGOs fund data collection in specific wards)
- [ ] Consulting reports for policy organizations

---

## Database Migration (Local JSON → Supabase)

**When:** Before public launch or when citizen report volume exceeds what JSON files can handle.

Current: All data in `data/reports.json` + `public/wards.geojson`
Target: Supabase (PostgreSQL + PostGIS)

Steps documented in [TODOS.md](../TODOS.md#migration-local-json--supabase-when-ready-to-go-online)

---

## Technical Debt to Address

- [ ] Ward ID collision: ward_number is not unique across municipalities (Ward 1 exists in Harare, Chitungwiza, and Epworth). Need composite key (municipality + ward_number) or unique sequential IDs.
- [ ] Population data from 2012 census — need 2022 census data when available
- [ ] Ward 46 discrepancy: shapefile has 46 Harare wards, Asher references 45 — verify
- [ ] EXIF metadata stripping on photo uploads (safety concern for anonymous reporters)
- [ ] Admin panel authentication (currently single shared password)
- [ ] Rate limiting on report submission API

---

## Success Metrics

| Metric | Target (3 months) | Target (12 months) |
|--------|-------------------|---------------------|
| Wards with real data | 35 (Asher's coverage) | 78 (all wards) |
| Citizen reports | 500 | 5,000 |
| Active reporting wards | 15 | 50 |
| Councillor response rate | 10% | 40% |
| Media citations | 5 | 25 |
| Partner organizations | 2 | 10 |

---

## Timeline

```
2026 Q2 (Apr-Jun)     2026 Q3 (Jul-Sep)     2026 Q4 (Oct-Dec)
────────────────────   ────────────────────   ────────────────────
v2.0 Real data +       v2.1 Councillor       v3.0 AI + API +
     Infrastructure          accountability         multi-city
     layers                  + comparison
                        v2.2 PWA + i18n +     Company registered
Company registration         social launch     Revenue generation
                                               starts
Replace simulated      Public launch with
data with Asher's      countdown campaign
real data
                        First external
Ministry data           partners onboarded
requests fulfilled
```
