# WardPulse

**Ward-level civic service delivery intelligence platform for Zimbabwe.**

WardPulse turns anonymous citizen reports into public accountability. Citizens report service delivery failures — water, roads, sanitation, waste — directly from their phones. Reports are geotagged to wards, scored, graded, and displayed on public dashboards that councillors, journalists, NGOs, and donors can all see.

The core thesis: **when ignoring citizens has a measurable, public cost, service delivery improves.**

---

## How It Works

```
  CITIZEN                    WARDPULSE                     OUTCOME
  ───────                    ─────────                     ───────

  Opens wardpulse.org        GPS detects Ward 26           "Your ward: Grade D"
  on their phone             Shows their ward scorecard

  Taps "Report issue"        3-tap wizard:                 Report geotagged
  (water outage)             Category → Location → Submit  and stored

  Report appears on          Ward 26 scorecard updates     Public pressure
  public ward map            Grade recalculated            on councillor

  Councillor sees            Response tracked publicly     Accountability
  grade dropping             Response rate: 34%            loop closes

  Journalist (Asher)         Cites structured ward data    Informed advocacy
  writes Resident Review     in investigative journalism

  Donor sees impact          Ward 26 water resolution      Evidence-based
  metrics improving          rate: 12% → 47%               funding decisions
```

## The Accountability Loop

WardPulse is not a suggestion box. It's a civic accountability engine:

```
  Citizen reports issue
        │
        ▼
  Ward scorecard updates (public grade: A-F)
        │
        ▼
  Councillor sees grade dropping
        │
        ▼
  Councillor responds (tracked publicly)
        │
        ▼
  Journalist cites data in reporting
        │
        ▼
  Public pressure intensifies
        │
        ▼
  Service delivery improves (or doesn't — and everyone can see)
```

## Coverage

- **Harare** — 46 wards (Harare City Council)
- **Chitungwiza** — 25 wards (Chitungwiza Municipality)
- **Epworth** — 7 wards (Epworth Local Board)
- **Total: 78 wards** across Harare Province

Built on data from Zimbabwe's Central Statistical Office ward boundaries (admin3 shapefiles) and the 2022 National Census. Note: Asher's Resident Review references 45 Harare wards — the shapefile contains 46 (discrepancy under investigation with Asher).

## Features

### For Citizens
- **3-tap reporting** — Category → Location → Submit. Under 30 seconds on a slow phone.
- **"My Ward" homepage** — GPS auto-detects your ward. See your scorecard instantly.
- **Anonymous** — No signup, no account, no tracking. Your report, your voice.
- **Photo evidence** — Optional, compressed client-side to <200KB for low-bandwidth connections.

### Ward Scorecards
- **Per-capita normalized grades** — A through F, per category and overall.
- **Category breakdown** — Water, Roads, Sanitation, Waste, Infrastructure, Health.
- **Response tracking** — How many reports acknowledged or resolved, and how fast.
- **Transparent methodology** — Scoring formula published at `/methodology`. All math is public.

### Dashboards
- **Ward Dashboard** (`/ward/:id`) — Individual ward scorecard, report list, mini map.
- **Mayor Dashboard** (`/mayor/:city`) — City-wide aggregates, worst wards, category breakdown.
- **Compare Page** (`/compare?wards=26,37,6`) — Side-by-side ward comparison. Shareable URL.

### Public Map
- **Choropleth map** — Wards colored by grade. Click any ward to see its scorecard.
- **Report pins** — Individual reports plotted on the map with category filtering.
- **MapLibre GL JS** — Vector tiles, lightweight, fast on mobile.

### For Journalists & NGOs
- Public, structured, mapable evidence for advocacy and reporting.
- Compare wards side by side with shareable URLs.
- All data is public. No login required.

### For Donors
- Impact metrics tied to specific communities.
- Track improvement over time per ward and category.

## Scoring Methodology

Ward grades are computed using per-capita normalization:

```
Per category:
  raw_score = open_reports / (ward_population / 1000)
  percentile = rank among all wards
  grade = A (top 20%) | B | C | D | F (bottom 20%)

Overall ward grade:
  weighted_average =
    water_grade     × 0.30 +
    roads_grade     × 0.25 +
    sanitation_grade × 0.25 +
    waste_grade     × 0.20
```

Categories derived from [The Resident Review](https://www.linkedin.com/in/ashermunashemutandiro/)'s investigation of 35/45 Harare wards.

Full methodology published at `/methodology`.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js (App Router + RSC) | Server-rendered for low bandwidth. RSC streaming embeds data in HTML — no loading spinners on slow connections. |
| Map | MapLibre GL JS + OpenMapTiles | Free vector tiles. Lightweight. Works offline-ish. Borrowed from GeoBlackout architecture. |
| Database | PostgreSQL + PostGIS (Supabase) | Ward shapefiles load natively. Spatial queries (ST_Contains) for reverse geocoding. Free tier covers MVP. |
| Hosting | Vercel | Instant deploys. Edge functions for dynamic OG images. Free tier. |
| Photos | Supabase Storage | Comes with the database. Client-side compression to <200KB. |
| Analytics | Umami (self-hosted) | Privacy-friendly. No Google dependency. Open source. |
| Charts | Custom SVG (React) | No heavy chart library. Lightweight for mobile. |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CITIZEN (mobile browser)                      │
│                                                                     │
│  "My Ward" homepage → Ward scorecard → Report (3 taps) → Done     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS APP (Vercel)                          │
│                       RSC streaming                                 │
│                                                                     │
│  PUBLIC PAGES              DASHBOARDS              ADMIN            │
│  /                         /ward/:id               /admin           │
│  /map                      /mayor/:city            (password)       │
│  /report                   /compare                                 │
│  /methodology              /councillor/:id                          │
│                                                                     │
│  API ROUTES                     SCORING ENGINE                      │
│  POST /api/reports              Per-capita normalized               │
│  GET  /api/reports              Category-weighted grades            │
│  GET  /api/wards/geojson        Recomputed on report change         │
│  GET  /api/ward/:id/score                                           │
│  PATCH /api/reports/:id         OG IMAGE GENERATOR                  │
│                                 @vercel/og per ward                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                   │
│                                                                     │
│  PostgreSQL + PostGIS                    Supabase Storage            │
│  ┌────────────────────────────────┐     ┌──────────────────────┐   │
│  │ wards (id, name, municipality, │     │ report-photos/       │   │
│  │   district, population,        │     │   {report_id}.jpg    │   │
│  │   councillor_name, geom)       │     └──────────────────────┘   │
│  │ reports (id, ward_id, category,│                                 │
│  │   description, lat, lng,       │     Umami (self-hosted)        │
│  │   photo_url, status, source,   │     ┌──────────────────────┐   │
│  │   created_at, acknowledged_at, │     │ analytics.           │   │
│  │   resolved_at)                 │     │   wardpulse.org      │   │
│  │ ward_scores (ward_id, category,│     └──────────────────────┘   │
│  │   grade, open_count,           │                                 │
│  │   resolved_count,              │                                 │
│  │   avg_response_days,           │                                 │
│  │   computed_at)                 │                                 │
│  └────────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Sources

| Data | Source | Location in repo |
|------|--------|-----------------|
| Ward boundaries (admin3) | Zimbabwe Central Statistical Office | `Geographic Data/Administrative Units/Zimbabwe_admin3_wards/` |
| District boundaries (admin2) | Zimbabwe CSO | `Geographic Data/Administrative Units/Zimbabwe_admin2_districts*/` |
| Population (2022) | Zimbabwe National Census | `Population Data/2022 Census data.xlsx` |
| Population (2012, fallback) | Zimbabwe Census | `Population Data/ZW_census_2012_ward population estimates.xlsx` |
| Health facilities | Ministry of Health | `Geographic Data/Health Facilities/` |
| Seed data | The Resident Review by Asher Mutandiro | 35/45 Harare wards investigated |

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier)
- Python 3.9+ (for data pipeline)

### Setup

```bash
# Clone the repo
git clone https://github.com/7squareinc/wardpulse.git
cd wardpulse

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the data pipeline (load wards into PostGIS)
cd scripts
pip install geopandas sqlalchemy openpyxl
python load_wards.py

# Start the dev server
cd ..
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
NEXT_PUBLIC_MAPLIBRE_STYLE=https://openmaptiles.data.gouv.fr/styles/osm-bright/style.json
```

## Project Structure

```
wardpulse/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # "My Ward" homepage
│   ├── map/page.tsx              # Public ward map
│   ├── report/page.tsx           # 3-tap report wizard
│   ├── ward/[id]/page.tsx        # Ward scorecard + dashboard
│   ├── mayor/[city]/page.tsx     # Mayor dashboard
│   ├── compare/page.tsx          # Ward comparison
│   ├── methodology/page.tsx      # Scoring methodology
│   ├── admin/page.tsx            # Admin panel
│   └── api/
│       ├── reports/route.ts      # Report CRUD
│       ├── wards/route.ts        # Ward data + GeoJSON
│       ├── ward/[id]/score/route.ts  # Ward score
│       └── og/route.tsx          # Dynamic OG images
├── components/
│   ├── MapView.tsx               # MapLibre map component
│   ├── ReportWizard.tsx          # 3-tap report flow
│   ├── WardScorecard.tsx         # Grade + category breakdown
│   ├── CompareTable.tsx          # Side-by-side comparison
│   └── ReportChart.tsx           # SVG bar chart
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── scoring.ts                # Ward scoring engine
│   └── geocode.ts                # PostGIS reverse geocoding
├── public/
│   └── wards.geojson             # Pre-simplified ward boundaries
├── scripts/
│   ├── load_wards.py             # Shapefile → PostGIS pipeline
│   └── seed_reports.py           # Import Resident Review data
├── Geographic Data/              # Raw shapefiles (not in app bundle)
├── Population Data/              # Census data (not in app bundle)
├── TODOS.md                      # Development roadmap
└── README.md
```

## Roadmap

### Phase 1 — MVP (Current)
- [x] Architecture and plan review
- [ ] Data pipeline: shapefiles → PostGIS
- [ ] Ward scoring engine
- [ ] 3-tap citizen report flow
- [ ] Public ward map (MapLibre + choropleth)
- [ ] Ward scorecard pages
- [ ] Mayor dashboard
- [ ] Ward comparison page
- [ ] Admin panel (report moderation)
- [ ] "My Ward" GPS auto-detect homepage
- [ ] /methodology page
- [ ] Dynamic OG images per ward
- [ ] Seed data from The Resident Review
- [ ] 33 tests covering all codepaths

### Phase 1.1 — Post-Launch
- [ ] "Ward of the Week" auto-generated social cards
- [ ] Shona language support (i18n)
- [ ] PWA / offline-first
- [ ] Anti-spam hardening

### Phase 2 — Scale
- [ ] Councillor magic link emails + response portal
- [ ] WhatsApp bot for citizen reporting
- [ ] SMS/USSD reporting channel
- [ ] Donor impact dashboard
- [ ] Multi-city expansion (Bulawayo, Mutare, Masvingo)
- [ ] NGO data export API

## Background

WardPulse builds on the work of [The Resident Review](https://www.linkedin.com/in/ashermunashemutandiro/), an investigative journalism project by **Asher Munashe Mutandiro** that has covered 35 of 45 Harare wards. The Resident Review, a product of the Penn State University and Club of Rome's 50 Percent Storytelling Fellowship, examines governance practices and service delivery ward by ward through direct engagement with residents.

WardPulse systematizes and scales this work — turning investigative journalism into a living civic intelligence platform.

## Team

- **Ernest Moyo** — Technical architecture, geospatial stack, product. Co-founder of [7Square Inc](https://7squareinc.com), Vector Atlas PhD researcher at NM-AIST.
- **Asher Munashe Mutandiro** — Civic engagement, community relationships, storytelling. Creator of The Resident Review. McKinsey Forward Alumni, YALI Alumnus, WEF Global Shaper.

## Contributing

WardPulse is open source. Contributions are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

See [TODOS.md](TODOS.md) for the current development roadmap and open tasks.

### Areas Where We Need Help
- **Frontend** — React/Next.js components, mobile-first responsive design
- **Geospatial** — PostGIS queries, shapefile processing, map visualization
- **Design** — UI/UX for low-bandwidth mobile-first civic tools
- **Data** — Census data processing, ward boundary verification
- **Translation** — Shona and Ndebele translations for i18n
- **Testing** — Unit, integration, and E2E test coverage
- **Zimbabwe context** — If you live in Harare or Chitungwiza and understand ward-level governance, your input is invaluable

## License

MIT

