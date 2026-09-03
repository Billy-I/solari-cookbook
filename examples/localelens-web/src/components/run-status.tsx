import type { CaptureStage } from "@/src/features/capture/contracts";
import { COUNTRY_NAMES } from "@/src/features/capture/countries";
import type {
  RegionRunState,
  RunProgress,
} from "@/src/features/run/use-comparison-run";

const stageLabels: Record<CaptureStage, string> = {
  queued: "Queued",
  launching: "Launching browser",
  navigating: "Loading page",
  extracting: "Extracting evidence",
  closing: "Closing session",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

type RunStatusProps = {
  progress?: RunProgress;
  regions: RegionRunState[];
};

export function RunStatus({ progress, regions }: RunStatusProps) {
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
      <div className="run-status-summary">
        <p className="run-status-label">Status</p>
        {progress && progress.selected > 0 ? (
          <p className="run-progress">
            {progress.completed + progress.failed} of {progress.selected} settled
            {progress.totalBatches > 0
              ? ` · Batch ${progress.batch} of ${progress.totalBatches}`
              : ""}
          </p>
        ) : null}
      </div>
      <ul>
        {regions.map((region) => (
          <li key={region.country}>
            <strong>{region.country.toUpperCase()}</strong>
            <span>{COUNTRY_NAMES[region.country]}</span>
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
