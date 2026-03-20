/**
 * Methodology Page — /methodology
 *
 * Transparent scoring formula. Published for credibility.
 * "All data is public. All formulas are open. Challenge us."
 */

import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Home
        </Link>

        <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 prose prose-gray max-w-none">
          <h1>Scoring Methodology</h1>

          <p>
            WardPulse grades each ward on a scale from <strong>A</strong> (best) to <strong>F</strong> (worst)
            based on citizen-reported service delivery issues. The scoring system is designed to be fair,
            transparent, and actionable.
          </p>

          <h2>Categories</h2>
          <table>
            <thead>
              <tr><th>Category</th><th>Weight</th><th>Examples</th></tr>
            </thead>
            <tbody>
              <tr><td>Water Supply</td><td>30%</td><td>Outages, contamination, borehole issues</td></tr>
              <tr><td>Roads</td><td>25%</td><td>Potholes, unpaved roads, road damage</td></tr>
              <tr><td>Sanitation</td><td>25%</td><td>Sewage leaks, blocked drains, open sewers</td></tr>
              <tr><td>Waste</td><td>20%</td><td>Uncollected refuse, illegal dumping</td></tr>
            </tbody>
          </table>
          <p>
            Additional categories (Infrastructure, Health) are tracked but not yet weighted in the overall grade.
          </p>

          <h2>Per-Category Scoring</h2>
          <h3>Step 1: Count open reports</h3>
          <p>For each ward and category, count reports with status = &quot;open&quot;.</p>

          <h3>Step 2: Normalize per capita</h3>
          <p>
            Divide by ward population (per 1,000 residents) to ensure fairness. A ward with 50,000 residents
            and 25 reports has the same score as a ward with 10,000 residents and 5 reports.
          </p>
          <pre>raw_score = open_reports / (population / 1,000)</pre>

          <h3>Step 3: Rank and grade</h3>
          <p>Rank all wards by their score. Assign grades by percentile:</p>
          <ul>
            <li><strong>Grade A:</strong> Top 20% (fewest problems per capita)</li>
            <li><strong>Grade B:</strong> 20-40%</li>
            <li><strong>Grade C:</strong> 40-60%</li>
            <li><strong>Grade D:</strong> 60-80%</li>
            <li><strong>Grade F:</strong> Bottom 20% (most problems per capita)</li>
          </ul>

          <h3>Minimum threshold</h3>
          <p>
            Wards require at least <strong>3 reports</strong> in a category to receive a grade.
            Below that threshold, the ward displays &quot;Limited data&quot; instead of a potentially misleading grade.
          </p>

          <h2>Overall Ward Grade</h2>
          <pre>{`overall = water × 0.30 + roads × 0.25 + sanitation × 0.25 + waste × 0.20`}</pre>
          <p>Only categories with a grade contribute. Weights are re-normalized if some categories lack data.</p>

          <h2>Data Sources</h2>
          <ul>
            <li><strong>Ward boundaries:</strong> Zimbabwe Central Statistical Office (admin3 shapefiles)</li>
            <li><strong>Population:</strong> 2022 Zimbabwe National Census</li>
            <li><strong>Reports:</strong> Anonymous citizen submissions via wardpulse.org</li>
            <li><strong>Seed data:</strong> The Resident Review by Asher Mutandiro (35 Harare wards)</li>
          </ul>

          <h2>Limitations</h2>
          <ol>
            <li>Reporting bias: wards with higher smartphone penetration may generate more reports.</li>
            <li>Population data from 2022 census — urban migration may have shifted numbers.</li>
            <li>Anonymous reporting means reports could be fabricated. Rate limiting and admin review mitigate this.</li>
          </ol>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 font-semibold">
              All data is public. All formulas are open. Challenge us.
            </p>
            <p className="text-blue-600 text-sm mt-1">
              If you believe the scoring is unfair or incomplete, open an issue on GitHub.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
