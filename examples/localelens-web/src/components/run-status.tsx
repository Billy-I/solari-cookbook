import type { CaptureStage, SupportedCountry } from "@/src/features/capture/contracts";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";

const countryNames: Record<SupportedCountry, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  au: "Australia",
};

const stageLabels: Record<CaptureStage, string> = {
  queued: "Queued",
  launching: "Launching browser",
  navigating: "Loading page",
  extracting: "Extracting evidence",
  closing: "Closing session",
  complete: "Complete",
  failed: "Failed",
};

type RunStatusProps = {
  regions: RegionRunState[];
};

export function RunStatus({ regions }: RunStatusProps) {
  if (regions.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Comparison status"
      aria-live="polite"
      className="run-status"
      role="status"
    >
      <p className="run-status-label">Status</p>
      <ul>
        {regions.map((region) => (
          <li key={region.country}>
            <strong>{region.country.toUpperCase()}</strong>
            <span>{countryNames[region.country]}</span>
            <span className={`stage-label stage-${region.stage}`}>
              {stageLabels[region.stage]}
            </span>
            {region.response && !region.response.ok ? (
              <span className="safe-error">{region.response.error.message}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
