import type { SupportedCountry } from "@/src/features/capture/contracts";
import type {
  ComparisonRun,
  RegionRunState,
} from "@/src/features/run/use-comparison-run";
import { DifferenceTable } from "@/src/components/difference-table";
import { DecisionSummary } from "@/src/components/decision-summary";
import { compareEvidence } from "@/src/features/compare/compare-evidence";
import { summarizeComparison } from "@/src/features/compare/summarize-comparison";
import { RegionResult } from "@/src/components/region-result";

type ComparisonResultsProps = {
  mode: ComparisonRun["mode"];
  regions: RegionRunState[];
  onRetry: (country: SupportedCountry) => void;
};

export function ComparisonResults({ mode, regions, onRetry }: ComparisonResultsProps) {
  if (regions.length === 0) {
    return null;
  }

  const settledRegions = regions.filter(
    (region): region is RegionRunState & { response: NonNullable<RegionRunState["response"]> } =>
      region.response !== null,
  );
  const fields = compareEvidence(settledRegions);

  return (
    <section aria-label="Regional results" className="results-section">
      <DecisionSummary signals={summarizeComparison(regions)} />

      <details className="evidence-details">
        <summary>Screenshots and regional evidence</summary>
        <p className="details-intro">
          Evidence appears as each regional capture settles.
        </p>
        <div className="region-grid">
          {regions.map((region) => (
            <RegionResult
              key={region.country}
              mode={mode}
              onRetry={onRetry}
              region={region}
            />
          ))}
        </div>
      </details>

      <details className="evidence-details">
        <summary>Detailed field comparison</summary>
        <section aria-labelledby="differences-heading" className="differences-section">
          <div className="differences-heading-row">
            <div>
              <h2 id="differences-heading">Observed differences</h2>
            </div>
            <p>
              All fields use whitespace normalization. Language and currency
              comparisons also use locale-invariant lowercasing.
            </p>
          </div>
          <DifferenceTable
            countries={regions.map(({ country }) => country)}
            fields={fields}
          />
        </section>
      </details>
    </section>
  );
}
