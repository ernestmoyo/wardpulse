# Contributing to WardPulse

WardPulse is an open-source civic service delivery intelligence platform for Zimbabwe. We welcome contributions from developers, designers, data analysts, translators, and anyone with knowledge of Zimbabwean local governance.

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/wardpulse.git
cd wardpulse

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials (see README for setup)

# Run dev server
npm run dev
```

## What We Need Help With

### High Priority
- **Frontend components** — React/Next.js, mobile-first responsive design
- **Geospatial** — PostGIS queries, shapefile processing, MapLibre visualization
- **Testing** — Unit, integration, and E2E tests (target: 33 tests before v1.0)

### Medium Priority
- **Design** — UI/UX for low-bandwidth, mobile-first civic tools on low-end Android devices
- **Data** — Census data processing, ward boundary verification, data quality
- **Translation** — Shona and Ndebele translations for the UI (~50-80 strings)

### Domain Expertise
- **Zimbabwe local governance** — If you understand ward-level governance, councillor roles, and service delivery in Harare or Chitungwiza, your input on categories, scoring, and user flows is invaluable
- **Civic tech** — Experience with civic reporting platforms, GovTech, or accountability tools

## How to Contribute

### 1. Find something to work on
- Check [TODOS.md](TODOS.md) for the development roadmap
- Look for issues tagged `good first issue` or `help wanted`
- If you have an idea not listed, open an issue to discuss before coding

### 2. Branch and develop
```bash
git checkout -b feature/your-feature
# Make your changes
npm run test  # Ensure tests pass
```

### 3. Submit a PR
- Write a clear description of what your PR does and why
- Reference the relevant TODO or issue
- Include screenshots for UI changes (especially mobile views)
- Ensure all tests pass

## Code Standards

### General
- **TypeScript** for all new code
- **Explicit over clever** — readable code over short code
- **Mobile-first** — every component must work on a 360px-wide screen
- **Minimal dependencies** — justify any new npm package

### Testing
- Tests are non-negotiable. Every new feature needs tests.
- Follow the test map in [TODOS.md](TODOS.md) — 33 tests are specified
- Test both happy paths and error paths

### Accessibility
- Large touch targets (min 44x44px) for mobile
- Works on low-end Android (Samsung J-series, Tecno, Itel)
- Minimal JavaScript — server-rendered HTML should be usable without JS
- Page weight matters — every KB costs citizens money on metered mobile data

### Naming
- Components: PascalCase (`WardScorecard.tsx`)
- Utilities: camelCase (`scoring.ts`)
- API routes: kebab-case paths (`/api/ward/:id/score`)

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design, data flow diagrams, and security model.

See [docs/SCORING.md](docs/SCORING.md) for the ward scoring methodology.

See [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) for how raw shapefiles become a queryable database.

## Environment Setup

### Supabase (Database)
1. Create a free Supabase project at supabase.com
2. Enable the PostGIS extension: SQL Editor → `CREATE EXTENSION IF NOT EXISTS postgis;`
3. Run the schema from [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md)
4. Copy your project URL and anon key to `.env.local`

### Data Pipeline (Ward Loading)
```bash
cd scripts
pip install geopandas sqlalchemy openpyxl psycopg2-binary
export DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_SUPABASE_HOST:5432/postgres
python load_wards.py
```

### MapLibre (Map Tiles)
No API key needed. We use free OpenMapTiles from the French government CDN. The style URL is configured in `.env.local`.

## Code of Conduct

WardPulse is a civic accountability tool. We hold ourselves to the same standard of transparency and respect that we ask of local government.

- Be respectful and constructive
- Focus on the work, not the person
- Remember that contributors come from different backgrounds, timezones, and contexts
- Zimbabwe-specific context matters — if you don't understand something about local governance, ask

## Questions?

Open an issue or reach out to the maintainers. We're happy to help you get started.
