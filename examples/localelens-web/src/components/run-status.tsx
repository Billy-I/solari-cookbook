import {
  CircleCheck,
  CircleDashed,
  CircleSlash2,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

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

function StageIcon({ stage }: { stage: CaptureStage }) {
  if (stage === "complete") {
    return <CircleCheck aria-hidden="true" size={17} />;
  }
  if (stage === "failed") {
    return <TriangleAlert aria-hidden="true" size={17} />;
  }
  if (stage === "cancelled") {
    return <CircleSlash2 aria-hidden="true" size={17} />;
  }
  if (stage === "queued") {
    return <CircleDashed aria-hidden="true" size={17} />;
  }

  return <LoaderCircle aria-hidden="true" className="status-spinner" size={17} />;
}

export function RunStatus({ progress, regions }: RunStatusProps) {
  if (regions.length === 0) {
    return null;
  }

  const settled = progress ? progress.completed + progress.failed : 0;
  const finished = progress ? settled >= progress.selected : false;
  const completion = progress?.selected ? settled / progress.selected : 0;

  return (
    <section
      aria-label="Comparison status"
      aria-live="polite"
      className="run-status"
      role="status"
    >
      <div className="run-status-summary">
        <div>
          <h2 className="run-status-title">
            {progress
              ? finished
                ? "Comparison complete"
                : `Comparing ${progress.selected} markets`
              : "Comparison status"}
          </h2>
          {progress && progress.selected > 0 ? (
            <p className="run-progress">
              {settled} of {progress.selected} captures finished
              {progress.totalBatches > 0
                ? ` · Batch ${progress.batch} of ${progress.totalBatches}`
                : ""}
            </p>
          ) : null}
        </div>
        {progress && progress.selected > 0 ? (
          <span className="run-progress-percent">
            {Math.round(completion * 100)}%
          </span>
        ) : null}
      </div>
      {progress && progress.selected > 0 ? (
        <div
          aria-label="Comparison progress"
          aria-valuemax={progress.selected}
          aria-valuemin={0}
          aria-valuenow={settled}
          className="run-progress-track"
          role="progressbar"
        >
          <span
            className="run-progress-fill"
            style={{ transform: `scaleX(${completion})` }}
          />
        </div>
      ) : null}
      <ul>
        {regions.map((region) => (
          <li className={`run-status-item run-stage-${region.stage}`} key={region.country}>
            <StageIcon stage={region.stage} />
            <span className="run-market">
              <strong>{region.country.toUpperCase()}</strong>
              <span>{COUNTRY_NAMES[region.country]}</span>
            </span>
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
