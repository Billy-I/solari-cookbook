import Image from "next/image";
import { CircleDashed, RotateCcw, TriangleAlert } from "lucide-react";

import type {
  CaptureCorrelation,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import { COUNTRY_NAMES } from "@/src/features/capture/countries";
import type {
  ComparisonRun,
  RegionRunState,
} from "@/src/features/run/use-comparison-run";
import { ReplayLink } from "@/src/components/replay-link";

const sampleImages: Partial<Record<SupportedCountry, string>> = {
  us: "/sample/us.jpg",
  gb: "/sample/gb.jpg",
  de: "/sample/de.jpg",
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${date.toISOString().slice(11, 19)} UTC`;
}

function displayValue(value: string | null): string {
  return value ?? "Not detected";
}

function stageLabel(stage: RegionRunState["stage"]): string {
  return stage === "queued"
    ? "Queued"
    : stage === "launching"
      ? "Launching browser"
      : stage === "navigating"
        ? "Loading page"
        : stage === "extracting"
          ? "Extracting evidence"
          : "Closing session";
}

type RegionResultProps = {
  mode: ComparisonRun["mode"];
  region: RegionRunState;
  onRetry: (country: SupportedCountry) => void;
};

export function RegionResult({ mode, region, onRetry }: RegionResultProps) {
  const countryName = COUNTRY_NAMES[region.country];

  if (!region.response) {
    return (
      <article
        aria-label={`${countryName} regional evidence in progress`}
        className="region-preview region-pending"
      >
        <header>
          <strong>{region.country.toUpperCase()}</strong>
          <span>{countryName}</span>
        </header>
        <p className="region-state">
          <CircleDashed aria-hidden="true" size={16} />
          {stageLabel(region.stage)}
        </p>
      </article>
    );
  }

  if (!region.response.ok) {
    return (
      <article
        aria-label={`${countryName} regional evidence failed`}
        className="region-preview region-failure"
      >
        <header>
          <strong>{region.country.toUpperCase()}</strong>
          <span>{countryName}</span>
        </header>
        <p className="region-state">
          <TriangleAlert aria-hidden="true" size={16} />
          Capture failed
        </p>
        <p className="error-code">{region.response.error.code}</p>
        <p>{region.response.error.message}</p>
        {region.response.correlation ? (
          <p className="session-reference">
            Solari reference {region.response.correlation.sessionRef}
          </p>
        ) : null}
        {region.response.error.retryable ? (
          <button
            className="secondary-action"
            onClick={() => onRetry(region.country)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Retry {countryName}
          </button>
        ) : null}
      </article>
    );
  }

  const { evidence } = region.response;
  const capturedAt = formatTimestamp(evidence.capturedAt);
  const host = new URL(evidence.requestedUrl).host;
  const sampleImage = mode === "sample"
    ? sampleImages[region.country]
    : undefined;
  const liveImage = `data:image/jpeg;base64,${region.response.screenshot.base64}`;
  const correlation: CaptureCorrelation | null =
    region.response.receipt.sessionRef === null
      ? null
      : {
          runId: region.response.receipt.runId,
          country: region.response.receipt.country,
          attempt: region.response.receipt.attempt,
          sessionRef: region.response.receipt.sessionRef,
        };

  return (
    <article
      aria-label={`${countryName} regional evidence`}
      className="region-preview"
    >
      <header>
        <strong>{region.country.toUpperCase()}</strong>
        <span>{countryName}</span>
      </header>
      <p className="capture-provenance">
        {mode === "sample" ? "Sample evidence" : "Live evidence"}
      </p>
      {sampleImage ? (
        <Image
          alt={`${countryName} evidence for ${host}, captured ${capturedAt}`}
          height={900}
          priority
          sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw"
          src={sampleImage}
          width={1280}
        />
      ) : (
        <Image
          alt={`${countryName} evidence for ${host}, captured ${capturedAt}`}
          height={900}
          src={liveImage}
          unoptimized
          width={region.response.screenshot.width}
        />
      )}
      <dl className="evidence-list">
        <div>
          <dt>Final URL</dt>
          <dd>{evidence.finalUrl}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{displayValue(evidence.documentLanguage)}</dd>
        </div>
        <div>
          <dt>Primary heading</dt>
          <dd>{displayValue(evidence.primaryHeading)}</dd>
        </div>
        <div>
          <dt>Primary action</dt>
          <dd>{displayValue(evidence.primaryAction)}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{evidence.currencies.join(", ") || "Not detected"}</dd>
        </div>
        <div>
          <dt>Consent</dt>
          <dd>{displayValue(evidence.consentText)}</dd>
        </div>
      </dl>
      <p className="capture-time">Captured {capturedAt}</p>
      {mode === "live" && correlation ? (
        <>
          <p className="session-reference">{correlation.sessionRef}</p>
          <ReplayLink correlation={correlation} />
        </>
      ) : null}
    </article>
  );
}
