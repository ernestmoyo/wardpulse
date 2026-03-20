#!/usr/bin/env python3
"""
WardPulse — Ward Shapefile Data Pipeline
=========================================

Loads Zimbabwe admin3 ward shapefiles, filters to Harare Province
(Harare + Chitungwiza + Epworth = 78 wards), and exports to:
  - public/wards.geojson   (simplified, for frontend MapLibre)
  - scripts/wards.sql      (INSERT statements for Supabase PostGIS)

Usage:
    pip install geopandas openpyxl
    python scripts/load_wards.py

No database connection required — outputs are files only.
"""

import json
import os
import sys
from pathlib import Path

try:
    import geopandas as gpd
    import pandas as pd
    from shapely.geometry import mapping, MultiPolygon
    from shapely import wkt
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Install with: pip install geopandas openpyxl")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths (auto-detect project root from script location)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

SHAPEFILE_PATH = (
    PROJECT_ROOT
    / "Geographic Data"
    / "Administrative Units"
    / "Zimbabwe_admin3_wards"
    / "zwe_polbnda_adm3_250k_cso.shp"
)

CENSUS_2022_PATH = PROJECT_ROOT / "Population Data" / "2022 Census data.xlsx"
CENSUS_2012_PATH = (
    PROJECT_ROOT / "Population Data" / "ZW_census_2012_ward population estimates.xlsx"
)

GEOJSON_OUTPUT = PROJECT_ROOT / "public" / "wards.geojson"
SQL_OUTPUT = SCRIPT_DIR / "wards.sql"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TARGET_LOCAL_AUTHS = [
    "Harare City Council",
    "Chitungwiza Municipality",
    "Epworth Local Board",
]

MUNICIPALITY_MAP = {
    "Harare City Council": "harare",
    "Chitungwiza Municipality": "chitungwiza",
    "Epworth Local Board": "epworth",
}

EXPECTED_COUNTS = {
    "harare": 46,
    "chitungwiza": 25,
    "epworth": 7,
}

SIMPLIFY_TOLERANCE = 0.001  # degrees (~111m at equator)


def ensure_output_dirs():
    """Create output directories if they don't exist."""
    GEOJSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    SQL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)


def load_shapefile():
    """Load and filter ward shapefile to target municipalities."""
    if not SHAPEFILE_PATH.exists():
        print(f"ERROR: Shapefile not found at {SHAPEFILE_PATH}")
        sys.exit(1)

    print(f"Loading shapefile: {SHAPEFILE_PATH.name}")
    wards = gpd.read_file(str(SHAPEFILE_PATH))
    print(f"  Total Zimbabwe wards loaded: {len(wards)}")

    # Filter to target municipalities
    filtered = wards[wards["LOCAL_AUTH"].isin(TARGET_LOCAL_AUTHS)].copy()
    print(f"  Filtered to Harare Province: {len(filtered)} wards (expected: 78)")

    if len(filtered) == 0:
        print("ERROR: No wards matched the filter. Check LOCAL_AUTH values.")
        print(f"  Available LOCAL_AUTH values: {wards['LOCAL_AUTH'].unique()[:10]}")
        sys.exit(1)

    return filtered


def map_fields(gdf):
    """Map shapefile fields to WardPulse schema."""
    gdf["municipality"] = gdf["LOCAL_AUTH"].map(MUNICIPALITY_MAP)
    gdf["name"] = gdf["WARDNUMBER"].apply(lambda n: f"Ward {n}")
    gdf = gdf.rename(columns={
        "WARDNUMBER": "ward_number",
        "DISTRICT": "district",
        "PROVINCE": "province",
        "WARDAREASQ": "area_sq_km",
    })
    return gdf


def validate_geometries(gdf):
    """Check and fix invalid geometries using buffer(0)."""
    invalid_mask = ~gdf.geometry.is_valid
    invalid_count = invalid_mask.sum()

    if invalid_count > 0:
        print(f"  WARNING: {invalid_count} invalid geometries found. Fixing with buffer(0)...")
        gdf.loc[invalid_mask, "geometry"] = gdf.loc[invalid_mask].geometry.buffer(0)

        # Verify fix
        still_invalid = (~gdf.geometry.is_valid).sum()
        if still_invalid > 0:
            print(f"  ERROR: {still_invalid} geometries still invalid after fix!")
        else:
            print(f"  All geometries now valid.")
    else:
        print(f"  All {len(gdf)} geometries are valid.")

    # Ensure all geometries are MultiPolygon (PostGIS schema expects it)
    def to_multi(geom):
        if geom.geom_type == "Polygon":
            return MultiPolygon([geom])
        return geom

    gdf["geometry"] = gdf["geometry"].apply(to_multi)
    return gdf


def join_population(gdf):
    """Attempt to join 2022 Census population data. Gracefully handle failures."""
    population_joined = False

    # Try 2022 Census first
    if CENSUS_2022_PATH.exists():
        print(f"\n  Loading 2022 Census: {CENSUS_2022_PATH.name}")
        try:
            pop_2022 = pd.read_excel(str(CENSUS_2022_PATH))
            print(f"    Columns: {list(pop_2022.columns)}")
            print(f"    Rows: {len(pop_2022)}")

            # Try to find matching columns (census format varies)
            # Look for ward number and population columns
            col_lower = {c.lower().strip(): c for c in pop_2022.columns}

            ward_col = None
            pop_col = None
            district_col = None

            for key, orig in col_lower.items():
                if "ward" in key and ("num" in key or "no" in key or key == "ward"):
                    ward_col = orig
                if "pop" in key and "total" in key.lower():
                    pop_col = orig
                elif "pop" in key and pop_col is None:
                    pop_col = orig
                if "district" in key:
                    district_col = orig

            if ward_col and pop_col:
                print(f"    Matching on: ward={ward_col}, population={pop_col}")
                merge_left = ["ward_number"]
                merge_right = [ward_col]

                if district_col:
                    merge_left.append("district")
                    merge_right.append(district_col)
                    print(f"    Also matching on district={district_col}")

                pop_subset = pop_2022[merge_right + [pop_col]].copy()
                pop_subset = pop_subset.rename(columns={pop_col: "population"})

                # Ensure ward number types match
                pop_subset[merge_right[0]] = pd.to_numeric(
                    pop_subset[merge_right[0]], errors="coerce"
                )

                gdf = gdf.merge(
                    pop_subset,
                    left_on=merge_left,
                    right_on=merge_right,
                    how="left",
                )

                matched = gdf["population"].notna().sum()
                print(f"    Population matched for {matched}/{len(gdf)} wards")
                population_joined = matched > 0
            else:
                print(f"    Could not identify ward/population columns.")
                print(f"    Available: {list(pop_2022.columns)}")
        except Exception as e:
            print(f"    Failed to load 2022 Census: {e}")
    else:
        print(f"  2022 Census file not found at {CENSUS_2022_PATH}")

    # Try 2012 Census as fallback
    if not population_joined and CENSUS_2012_PATH.exists():
        print(f"\n  Trying fallback: 2012 Census ({CENSUS_2012_PATH.name})")
        try:
            pop_2012 = pd.read_excel(str(CENSUS_2012_PATH))
            print(f"    Columns: {list(pop_2012.columns)}")
            print(f"    Rows: {len(pop_2012)}")

            # Known columns: District, Code, Ward , Males, Females, TotalPop, NumberofHH, Average HH size
            # Strip whitespace from column names
            pop_2012.columns = pop_2012.columns.str.strip()

            if "Ward" in pop_2012.columns and "TotalPop" in pop_2012.columns:
                print(f"    Found Ward and TotalPop columns. Attempting join...")

                pop_subset = pop_2012[["District", "Ward", "TotalPop"]].copy()
                pop_subset = pop_subset.rename(columns={"TotalPop": "population"})
                pop_subset["Ward"] = pd.to_numeric(pop_subset["Ward"], errors="coerce")

                # District names in census vs shapefile may differ — try ward number + district
                gdf = gdf.merge(
                    pop_subset,
                    left_on=["ward_number", "district"],
                    right_on=["Ward", "District"],
                    how="left",
                    suffixes=("", "_census"),
                )

                matched = gdf["population"].notna().sum()
                print(f"    Matched {matched}/{len(gdf)} wards by ward_number + district")

                # If district names don't match well, try ward_number + municipality mapping
                if matched < len(gdf) * 0.5:
                    print(f"    Low match rate. Trying ward_number-only join for unmatched...")
                    # Drop failed join columns
                    gdf = gdf.drop(columns=["population", "Ward", "District"], errors="ignore")

                    # Filter census to Harare-area districts
                    harare_districts = gdf["district"].unique().tolist()
                    pop_harare = pop_subset[
                        pop_subset["District"].str.contains(
                            "|".join(["Harare", "Chitungwiza", "Epworth"]),
                            case=False, na=False,
                        )
                    ].copy()
                    print(f"    Census districts matching Harare area: {pop_harare['District'].unique().tolist()}")

                    if len(pop_harare) > 0:
                        # Deduplicate by ward number (take first match)
                        pop_harare = pop_harare.drop_duplicates(subset=["Ward"], keep="first")
                        gdf = gdf.merge(
                            pop_harare[["Ward", "population"]],
                            left_on="ward_number",
                            right_on="Ward",
                            how="left",
                        )
                        matched = gdf["population"].notna().sum()
                        print(f"    Matched {matched}/{len(gdf)} wards (ward number only)")
                        # Clean up extra columns
                        gdf = gdf.drop(columns=["Ward"], errors="ignore")

                    population_joined = matched > 0
                else:
                    population_joined = True
                    # Clean up extra merge columns
                    gdf = gdf.drop(columns=["Ward", "District"], errors="ignore")
            else:
                print(f"    Could not find Ward/TotalPop columns after stripping whitespace.")
        except Exception as e:
            print(f"    Failed to load 2012 Census: {e}")

    # Ensure population column exists even if join failed
    if "population" not in gdf.columns:
        gdf["population"] = None
        print("  Population column set to NULL (no census data joined).")

    return gdf, population_joined


def export_geojson(gdf):
    """Export simplified GeoJSON for frontend map."""
    print(f"\nExporting GeoJSON to {GEOJSON_OUTPUT}")

    simplified = gdf.copy()
    simplified["geometry"] = simplified.geometry.simplify(SIMPLIFY_TOLERANCE)

    # Select only frontend-relevant columns
    export_cols = ["name", "ward_number", "municipality", "district", "population", "geometry"]
    available_cols = [c for c in export_cols if c in simplified.columns]
    simplified = simplified[available_cols]

    simplified.to_file(str(GEOJSON_OUTPUT), driver="GeoJSON")

    size_kb = GEOJSON_OUTPUT.stat().st_size / 1024
    print(f"  Written: {GEOJSON_OUTPUT} ({size_kb:.1f} KB)")
    return size_kb


def escape_sql_string(value):
    """Escape a string for SQL insertion."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def export_sql(gdf):
    """Export SQL INSERT statements for Supabase PostGIS."""
    print(f"\nExporting SQL to {SQL_OUTPUT}")

    lines = []
    lines.append("-- WardPulse: Ward data INSERT statements")
    lines.append("-- Generated by scripts/load_wards.py")
    lines.append("-- Load into Supabase after running schema.sql")
    lines.append("")
    lines.append("-- Clear existing ward data (if re-running)")
    lines.append("DELETE FROM ward_scores;")
    lines.append("DELETE FROM reports;")
    lines.append("DELETE FROM wards;")
    lines.append("")
    lines.append("-- Reset sequence")
    lines.append("ALTER SEQUENCE wards_id_seq RESTART WITH 1;")
    lines.append("")

    for _, row in gdf.iterrows():
        geom_wkt = row.geometry.wkt
        name = escape_sql_string(row["name"])
        ward_number = int(row["ward_number"])
        municipality = escape_sql_string(row["municipality"])
        district = escape_sql_string(row.get("district"))
        province = escape_sql_string(row.get("province"))

        pop_val = row.get("population")
        if pop_val is not None and not (isinstance(pop_val, float) and pd.isna(pop_val)):
            population = str(int(pop_val))
        else:
            population = "NULL"

        lines.append(
            f"INSERT INTO wards (name, ward_number, municipality, district, province, population, geom) "
            f"VALUES ({name}, {ward_number}, {municipality}, {district}, {province}, {population}, "
            f"ST_SetSRID(ST_GeomFromText('{geom_wkt}'), 4326));"
        )

    lines.append("")
    lines.append("-- Verify")
    lines.append("SELECT municipality, COUNT(*) FROM wards GROUP BY municipality ORDER BY municipality;")
    lines.append("")

    sql_content = "\n".join(lines)
    SQL_OUTPUT.write_text(sql_content, encoding="utf-8")

    size_kb = SQL_OUTPUT.stat().st_size / 1024
    print(f"  Written: {SQL_OUTPUT} ({size_kb:.1f} KB)")
    print(f"  Total INSERT statements: {len(gdf)}")
    return size_kb


def print_summary(gdf, geojson_kb, sql_kb, population_joined):
    """Print verification summary."""
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)

    # Ward counts per municipality
    print("\nWard counts per municipality:")
    counts = gdf.groupby("municipality").size()
    all_match = True
    for muni, expected in EXPECTED_COUNTS.items():
        actual = counts.get(muni, 0)
        status = "OK" if actual == expected else "MISMATCH"
        if actual != expected:
            all_match = False
        print(f"  {muni:15s}: {actual:3d}  (expected {expected}) [{status}]")
    total = len(gdf)
    print(f"  {'TOTAL':15s}: {total:3d}  (expected 78) [{'OK' if total == 78 else 'MISMATCH'}]")

    # Geometry validity
    invalid_count = (~gdf.geometry.is_valid).sum()
    print(f"\nGeometry validity: {len(gdf) - invalid_count}/{len(gdf)} valid")

    # Geometry types
    geom_types = gdf.geometry.geom_type.value_counts()
    print(f"Geometry types: {dict(geom_types)}")

    # Population coverage
    if "population" in gdf.columns:
        pop_filled = gdf["population"].notna().sum()
        print(f"\nPopulation coverage: {pop_filled}/{len(gdf)} wards have population data")
        if pop_filled > 0:
            total_pop = gdf["population"].sum()
            print(f"Total population (covered wards): {total_pop:,.0f}")
    else:
        print("\nPopulation: No population data joined")

    # File sizes
    print(f"\nOutput files:")
    print(f"  GeoJSON: {GEOJSON_OUTPUT} ({geojson_kb:.1f} KB)")
    print(f"  SQL:     {SQL_OUTPUT} ({sql_kb:.1f} KB)")

    # CRS
    print(f"\nCRS: {gdf.crs}")

    print("\n" + "=" * 60)
    if all_match and total == 78 and invalid_count == 0:
        print("STATUS: ALL CHECKS PASSED")
    else:
        print("STATUS: SOME CHECKS NEED ATTENTION (see above)")
    print("=" * 60)


def main():
    print("=" * 60)
    print("WardPulse — Ward Data Pipeline")
    print("=" * 60)

    ensure_output_dirs()

    # Step 1-2: Load and filter shapefile
    print("\n[1/6] Loading and filtering shapefile...")
    gdf = load_shapefile()

    # Step 3: Map fields
    print("\n[2/6] Mapping fields to WardPulse schema...")
    gdf = map_fields(gdf)

    # Step 4: Validate geometries
    print("\n[3/6] Validating geometries...")
    gdf = validate_geometries(gdf)

    # Step 5: Join population
    print("\n[4/6] Joining population data...")
    gdf, population_joined = join_population(gdf)

    # Prepare final columns (keep only what we need)
    keep_cols = [
        "name", "ward_number", "municipality", "district", "province",
        "population", "geometry",
    ]
    available = [c for c in keep_cols if c in gdf.columns]
    gdf = gdf[available].copy()

    # Step 6: Export GeoJSON
    print("\n[5/6] Exporting GeoJSON...")
    geojson_kb = export_geojson(gdf)

    # Step 7: Export SQL
    print("\n[6/6] Exporting SQL...")
    sql_kb = export_sql(gdf)

    # Summary
    print_summary(gdf, geojson_kb, sql_kb, population_joined)


if __name__ == "__main__":
    main()
