# WardPulse — Scoring Methodology

## Purpose

WardPulse grades each ward on a scale from A (best) to F (worst) based on citizen-reported service delivery issues. The scoring system is designed to be:

- **Fair** — Normalized per capita so high-population wards aren't penalized for having more reports.
- **Transparent** — Every formula is published. Anyone can verify or challenge the math.
- **Actionable** — Grades are simple enough for citizens, councillors, journalists, and donors to understand and act on.

## Categories

Report categories are derived from The Resident Review's investigation of 35/45 Harare wards:

| Category | Weight | Examples |
|----------|--------|---------|
| Water | 30% | Water supply outages, contamination, borehole issues |
| Roads | 25% | Potholes, unpaved roads, road damage |
| Sanitation | 25% | Sewage leaks, blocked drains, open sewers |
| Waste | 20% | Uncollected refuse, illegal dumping, missing bins |

Additional categories tracked but not yet weighted:
- **Infrastructure** — Street lighting, public buildings, community facilities
- **Health** — Clinic access, facility conditions

Weights reflect the frequency and severity of issues found in The Resident Review data. Water is weighted highest because it is the most frequently reported issue across all wards and has the most direct impact on public health.

## Per-Category Scoring

### Step 1: Count open reports

For each ward and category, count the number of reports with status = "open":

```
open_count(ward, category) = COUNT(reports)
  WHERE ward_id = ward
  AND category = category
  AND status = 'open'
```

### Step 2: Normalize per capita

Divide by ward population (per 1,000 residents) to ensure fairness:

```
raw_score(ward, category) = open_count / (population / 1000)
```

This means a ward with 50,000 residents and 25 open water reports has the same raw score (0.5 per 1,000) as a ward with 10,000 residents and 5 open water reports.

### Step 3: Rank and grade

Rank all wards by their raw score for each category. Assign grades based on percentile:

```
Grade A: Top 20%    (lowest report rate — fewest problems)
Grade B: 20-40%
Grade C: 40-60%
Grade D: 60-80%
Grade F: Bottom 20% (highest report rate — most problems)
```

### Minimum Report Threshold

Wards require a minimum of **3 reports** in a category to receive a grade (`MIN_REPORTS_FOR_GRADE = 3`). This prevents misleading grades from sparse data — particularly important at launch when many wards will have limited citizen reports.

### Special Cases

- **0 reports:** Ward displays "No data yet" (gray, no grade)
- **1-2 reports:** Ward displays "Limited data" with report details but no grade
- **3+ reports:** Full grading (A-F)
- **All graded wards tied:** All receive grade C (median)

## Overall Ward Grade

The overall grade is a weighted average of category grades:

```
overall = water_grade × 0.30
        + roads_grade × 0.25
        + sanitation_grade × 0.25
        + waste_grade × 0.20
```

Letter grades are mapped to numbers for the weighted average:
```
A = 4.0, B = 3.0, C = 2.0, D = 1.0, F = 0.0
```

The resulting number maps back to a letter grade using the same scale.

## Response Metrics

In addition to grades, each ward tracks:

- **Response rate:** Percentage of reports that have been acknowledged or resolved
- **Average response time:** Mean days between report submission and acknowledgment
- **Resolution rate:** Percentage of reports fully resolved

These metrics are displayed on ward scorecards but do not currently factor into the grade. They may be incorporated in future scoring versions.

## Data Sources

| Data | Source | Update Frequency |
|------|--------|-----------------|
| Ward boundaries | Zimbabwe Central Statistical Office (admin3 shapefiles) | Static (boundaries rarely change) |
| Population | 2022 Zimbabwe National Census | Static (next census TBD) |
| Reports | Anonymous citizen submissions via wardpulse.org | Real-time |
| Seed data | The Resident Review by Asher Mutandiro (35/45 Harare wards) | Historical import |

## Limitations

1. **Reporting bias:** Wards with higher smartphone penetration may generate more reports, not necessarily have more problems. Per-capita normalization helps but doesn't eliminate this bias.
2. **Population data currency:** Using 2022 census data. Informal settlements and urban migration may have changed ward populations.
3. **Category completeness:** The 6 categories don't cover all service delivery issues. The "other" option captures edge cases but doesn't contribute to scoring.
4. **Anonymous reporting:** No identity verification means reports could be fabricated. Rate limiting and admin review mitigate this.

## Versioning

This is Scoring Methodology v1.0. Changes to the scoring formula will be documented with version numbers and rationale. Historical scores are preserved — formula changes are not applied retroactively.

## Challenge Us

If you believe the scoring methodology is unfair, biased, or incomplete, we want to hear from you. The strength of WardPulse depends on the integrity of its data. Open an issue or contact us.
