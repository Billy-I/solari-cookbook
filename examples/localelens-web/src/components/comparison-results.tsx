import type { SupportedCountry } from "@/src/features/capture/contracts";
import type { RegionRunState } from "@/src/features/run/use-sample-run";
import {
  compareRegions,
  DifferenceTable,
} from "@/src/components/difference-table";
import { RegionResult } from "@/src/components/region-result";

type ComparisonResultsProps = {
  regions: RegionRunState[];
  onRetry: (country: SupportedCountry) => void;
};

export function ComparisonResults({ regions, onRetry }: ComparisonResultsProps) {
  const visibleRegions = regions.filter(({ response }) => response !== null);

  if (visibleRegions.length === 0) {
    return null;
  }

  return (
    <section aria-label="Regional results" className="results-section">
      <div className="results-heading-row">
        <div>
          <p className="eyebrow">Regional evidence</p>
          <h2 id="results-heading">What each market rendered</h2>
        </div>
        <p>Evidence appears as each sample capture settles.</p>
      </div>
      <div className="region-grid">
        {visibleRegions.map((region) => (
          <RegionResult key={region.country} onRetry={onRetry} region={region} />
        ))}
      </div>
      <section aria-labelledby="differences-heading" className="differences-section">
        <div className="differences-heading-row">
          <div>
            <p className="eyebrow">Aligned evidence</p>
            <h2 id="differences-heading">Observed differences</h2>
          </div>
          <p>Text is compared after whitespace normalization only.</p>
        </div>
        <DifferenceTable
          countries={visibleRegions.map(({ country }) => country)}
          fields={compareRegions(visibleRegions)}
        />
      </section>
    </section>
  );
}
