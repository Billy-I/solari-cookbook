import Image from "next/image";
import { RotateCcw } from "lucide-react";

import type { SupportedCountry } from "@/src/features/capture/contracts";
import type { RegionRunState } from "@/src/features/run/use-sample-run";

const countryNames: Record<SupportedCountry, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  au: "Australia",
};

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

type RegionResultProps = {
  region: RegionRunState;
  onRetry: (country: SupportedCountry) => void;
};

export function RegionResult({ region, onRetry }: RegionResultProps) {
  const countryName = countryNames[region.country];

  if (region.response && !region.response.ok) {
    return (
      <article
        aria-label={`${countryName} regional evidence failed`}
        className="region-preview region-failure"
      >
        <header>
          <strong>{region.country.toUpperCase()}</strong>
          <span>{countryName}</span>
        </header>
        <p className="error-code">{region.response.error.code}</p>
        <p>{region.response.error.message}</p>
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

  if (!region.response?.ok) {
    return null;
  }

  const { evidence } = region.response;
  const capturedAt = formatTimestamp(evidence.capturedAt);
  const host = new URL(evidence.requestedUrl).host;
  const image = sampleImages[region.country];

  return (
    <article
      aria-label={`${countryName} regional evidence`}
      className="region-preview"
    >
      <header>
        <strong>{region.country.toUpperCase()}</strong>
        <span>{countryName}</span>
      </header>
      {image ? (
        <Image
          alt={`${countryName} evidence for ${host}, captured ${capturedAt}`}
          height={900}
          priority
          sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw"
          src={image}
          width={1280}
        />
      ) : null}
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
    </article>
  );
}
