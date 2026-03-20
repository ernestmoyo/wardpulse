# WardPulse — Data Pipeline

## Overview

Before WardPulse can run, ward boundary data and population figures must be loaded into the database. This document describes the data pipeline from raw shapefiles to a queryable PostGIS database and a lightweight GeoJSON file for the frontend map.

## Pipeline Steps

```
  RAW DATA                    PROCESSING                    OUTPUT
  ────────                    ──────────                    ──────

  Zimbabwe admin3         →   Filter to Harare        →   wards table
  ward shapefiles              + Chitungwiza                (PostGIS)
  (.shp, .dbf, .prj)

  2022 Census data        →   Extract ward-level      →   population column
  (.xlsx)                      population                   in wards table

  PostGIS wards table     →   ST_Simplify(0.001)      →   /public/wards.geojson
                               + ST_AsGeoJSON()              (~200KB, static file)
```

## Source Files

### Ward Boundaries
- **Path:** `Geographic Data/Administrative Units/Zimbabwe_admin3_wards/zwe_polbnda_adm3_250k_cso.*`
- **Format:** ESRI Shapefile (6 files: .shp, .dbf, .prj, .sbn, .sbx, .shp.xml)
- **CRS:** EPSG:4326 (WGS 84)
- **Content:** All 1,980 wards in Zimbabwe. Filter to Harare Province (78 wards).
- **Confirmed fields:** ZIMWARDSID, PROVINCE, DISTRICT, LOCAL_AUTH, WARDNUMBER, INTEGRITY, WARDAREASQ, PROVINCEPC, DISTRICTPC, DISTRICTTY, WARDPCODE, geometry
- **Filter:** `LOCAL_AUTH IN ('Harare City Council', 'Chitungwiza Municipality', 'Epworth Local Board')` → 78 wards
- **Ward counts:** Harare 46, Chitungwiza 25, Epworth 7
- **NOTE:** No ward NAME field — only WARDNUMBER. Area names (Glen View, Borrowdale, etc.) must be mapped manually.
- **INTEGRITY field:** Harare has 34 'Old ward', 10 'Boundary adjusted', 2 '?' status wards

### Population Data
- **Primary:** `Population Data/2022 Census data.xlsx` (2022 National Census)
- **Fallback:** `Population Data/ZW_census_2012_ward population estimates.xlsx` (2012 Census)
- **Content:** Population per ward. Needed for per-capita score normalization.

### Supporting Data
- **Districts:** `Geographic Data/Administrative Units/Zimbabwe_admin2_districts*/` — for ward-to-district mapping verification
- **Health facilities:** `Geographic Data/Health Facilities/` — optional overlay layer

## Database Schema

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Wards table
CREATE TABLE wards (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  ward_number   INTEGER NOT NULL,
  areas         TEXT,           -- e.g., 'Western Triangle, Glen View 7 & 8 Ext' (manual mapping)
  municipality  TEXT NOT NULL,  -- 'harare', 'chitungwiza', or 'epworth'
  district      TEXT,
  province      TEXT,
  population    INTEGER,
  councillor    TEXT,
  geom          GEOMETRY(MultiPolygon, 4326) NOT NULL
);

-- Spatial index for reverse geocoding (ST_Contains)
CREATE INDEX idx_wards_geom ON wards USING GIST(geom);

-- Reports table
CREATE TABLE reports (
  id              SERIAL PRIMARY KEY,
  ward_id         INTEGER REFERENCES wards(id) NOT NULL,
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

-- Index for dashboard queries
CREATE INDEX idx_reports_ward_status_cat ON reports(ward_id, status, category);

-- Ward scores cache
CREATE TABLE ward_scores (
  id                SERIAL PRIMARY KEY,
  ward_id           INTEGER REFERENCES wards(id) NOT NULL,
  category          TEXT NOT NULL,
  grade             CHAR(1),  -- A, B, C, D, F, or NULL for insufficient data
  open_count        INTEGER NOT NULL DEFAULT 0,
  resolved_count    INTEGER NOT NULL DEFAULT 0,
  avg_response_days DOUBLE PRECISION,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ward_id, category)
);
```

## Pipeline Script

### Python (geopandas)

```python
# scripts/load_wards.py
#
# Usage:
#   pip install geopandas sqlalchemy openpyxl psycopg2-binary
#   python load_wards.py
#
# Environment variables:
#   DATABASE_URL=postgresql://user:pass@host:port/dbname

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine
import os

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)

# 1. Load ward shapefiles
print("Loading ward shapefiles...")
wards = gpd.read_file(
    "Geographic Data/Administrative Units/Zimbabwe_admin3_wards/"
    "zwe_polbnda_adm3_250k_cso.shp"
)

# 2. Filter to Harare Province (Harare + Chitungwiza + Epworth)
# Confirmed fields: PROVINCE, DISTRICT, LOCAL_AUTH, WARDNUMBER, INTEGRITY, geometry
# LOCAL_AUTH values: 'Harare City Council', 'Chitungwiza Municipality', 'Epworth Local Board'
MUNICIPALITIES = [
    'Harare City Council',
    'Chitungwiza Municipality',
    'Epworth Local Board',
]
harare_chit = wards[wards["LOCAL_AUTH"].isin(MUNICIPALITIES)].copy()
print(f"Filtered to {len(harare_chit)} wards (expected: 78)")

# Map LOCAL_AUTH to municipality slug
MUNICIPALITY_MAP = {
    'Harare City Council': 'harare',
    'Chitungwiza Municipality': 'chitungwiza',
    'Epworth Local Board': 'epworth',
}
harare_chit["municipality"] = harare_chit["LOCAL_AUTH"].map(MUNICIPALITY_MAP)

# 3. Validate geometries (10 'Boundary adjusted' + 2 '?' in Harare)
invalid = harare_chit[~harare_chit.geometry.is_valid]
if len(invalid) > 0:
    print(f"WARNING: {len(invalid)} invalid geometries. Fixing with buffer(0)...")
    harare_chit.loc[~harare_chit.geometry.is_valid, "geometry"] = (
        harare_chit[~harare_chit.geometry.is_valid].geometry.buffer(0)
    )

# 4. Join population data
print("Loading population data...")
pop = pd.read_excel("Population Data/2022 Census data.xlsx")
# Join on ward number + district — ward names are NOT in the shapefile
# (Inspect columns: print(pop.columns))
harare_chit = harare_chit.merge(
    pop[["ward_number", "district", "population"]],  # Adjust column names to census format
    left_on=["WARDNUMBER", "DISTRICT"],
    right_on=["ward_number", "district"],
    how="left"
)

# 5. Prepare for PostGIS
# Generate display name from ward number (no ward names in shapefile)
harare_chit["name"] = harare_chit.apply(
    lambda r: f"Ward {r['WARDNUMBER']}", axis=1
)
harare_chit = harare_chit.rename(columns={
    "WARDNUMBER": "ward_number",
    "DISTRICT": "district",
    "PROVINCE": "province",
})
# municipality already set in step 2
harare_chit = harare_chit[["name", "ward_number", "municipality", "district",
                            "province", "population", "geometry"]]

# 6. Load into PostGIS
print("Loading into PostGIS...")
harare_chit.to_postgis("wards", engine, if_exists="replace", index=True)

# 7. Export simplified GeoJSON for frontend
print("Exporting simplified GeoJSON...")
simplified = harare_chit.copy()
simplified["geometry"] = simplified.geometry.simplify(0.001)
simplified.to_file("public/wards.geojson", driver="GeoJSON")

print(f"Done. {len(harare_chit)} wards loaded.")
print(f"GeoJSON exported to public/wards.geojson")
```

### Alternative: ogr2ogr (command-line)

```bash
# Load shapefile into PostGIS
ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost dbname=wardpulse user=postgres password=xxx" \
  "Geographic Data/Administrative Units/Zimbabwe_admin3_wards/zwe_polbnda_adm3_250k_cso.shp" \
  -nln wards \
  -where "LOCAL_AUTH IN ('Harare City Council', 'Chitungwiza Municipality', 'Epworth Local Board')" \
  -lco GEOMETRY_NAME=geom \
  -lco FID=id \
  -t_srs EPSG:4326

# Export simplified GeoJSON
ogr2ogr -f "GeoJSON" \
  public/wards.geojson \
  PG:"host=localhost dbname=wardpulse user=postgres password=xxx" \
  -sql "SELECT name, municipality, ST_Simplify(geom, 0.001) as geom FROM wards"
```

## Verification Checklist

After running the pipeline:

- [ ] Ward count matches expected: Harare 46 + Chitungwiza 25 + Epworth 7 = 78 total
- [ ] All geometries valid: `SELECT COUNT(*) FROM wards WHERE NOT ST_IsValid(geom)` = 0
- [ ] GIST index exists: `SELECT indexname FROM pg_indexes WHERE tablename = 'wards'`
- [ ] Population data joined: `SELECT COUNT(*) FROM wards WHERE population IS NULL` = 0 (ideally)
- [ ] Reverse geocoding works: `SELECT name FROM wards WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(31.05, -17.83), 4326))` returns a ward name
- [ ] GeoJSON file size: `ls -lh public/wards.geojson` should be ~100-300KB
- [ ] GeoJSON loads in a browser: open the file in geojson.io to visually verify
