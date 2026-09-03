import type { ComparisonRun, RegionRunState } from "@/src/features/run/use-comparison-run";
import {
  compareEvidence,
  type DifferenceRow,
} from "@/src/features/compare/compare-evidence";
import type {
  AppRunId,
  CaptureCorrelation,
  PageEvidence,
  SafeCaptureErrorCode,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";

const limitations = [
  "Public pages only.",
  "Captured evidence is observational and is not a compliance verdict.",
  "Screenshot payloads, session identifiers, replay links, query strings, and URL fragments are excluded.",
] as const;

type SafeEvidence = Omit<PageEvidence, "requestedUrl" | "finalUrl"> & {
  finalUrl: string;
};

type SafeResult = {
  country: SupportedCountry;
  evidence: SafeEvidence;
  receipt: {
    runId: AppRunId;
    country: SupportedCountry;
    attempt: number;
    sessionRef: string | null;
    proxyCountry: SupportedCountry;
    proxyTier: "residential";
    timezoneId: string | null;
  };
};

type SafeFailure = {
  country: SupportedCountry;
  correlation: CaptureCorrelation | null;
  code: SafeCaptureErrorCode;
  message: string;
  retryable: boolean;
};

type JsonReport = {
  schemaVersion: 3;
  provenance: "live_solari";
  generatedAt: string;
  runId: AppRunId;
  status: "complete" | "partial";
  target: { hostname: string };
  countries: SupportedCountry[];
  results: SafeResult[];
  failures: SafeFailure[];
  comparisons: DifferenceRow[];
  limitations: typeof limitations;
};

export type JsonReportInput = {
  generatedAt: string;
  regions: RegionRunState[];
  runId: AppRunId;
  status: ComparisonRun["status"];
  target: string;
};

export type JsonReportOutput = {
  byteLength: number;
  filename: string;
  json: string;
};

function compareCountries(
  left: { country: SupportedCountry },
  right: { country: SupportedCountry },
): number {
  return left.country < right.country ? -1 : left.country > right.country ? 1 : 0;
}

function withoutQueryOrFragment(value: string): string {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function safeEvidence(evidence: PageEvidence): SafeEvidence {
  return {
    finalUrl: withoutQueryOrFragment(evidence.finalUrl),
    title: evidence.title,
    documentLanguage: evidence.documentLanguage,
    primaryHeading: evidence.primaryHeading,
    primaryAction: evidence.primaryAction,
    ctas: [...evidence.ctas],
    currencies: [...evidence.currencies],
    priceSnippets: [...evidence.priceSnippets],
    consentText: evidence.consentText,
    httpStatus: evidence.httpStatus,
    capturedAt: evidence.capturedAt,
  };
}

function safeCorrelation(
  correlation: CaptureCorrelation | null,
  runId: AppRunId,
  country: SupportedCountry,
): CaptureCorrelation | null {
  if (
    !correlation ||
    correlation.runId !== runId ||
    correlation.country !== country
  ) {
    return null;
  }

  return {
    runId: correlation.runId,
    country: correlation.country,
    attempt: correlation.attempt,
    sessionRef: correlation.sessionRef,
  };
}

function safeComparisons(regions: RegionRunState[]): DifferenceRow[] {
  return compareEvidence(
    regions
      .filter(
        (region): region is RegionRunState & {
          response: NonNullable<RegionRunState["response"]>;
        } => region.response !== null,
      )
      .map(({ country, response }) => ({ country, response })),
  ).map((row) => ({
    field: row.field,
    kind: row.kind,
    values: Object.fromEntries(
      Object.entries(row.values).map(([country, value]) => [
        country,
        row.field === "final_url" && value
          ? withoutQueryOrFragment(value)
          : value,
      ]),
    ),
  }));
}

function filenameFor(hostname: string, generatedAt: string): string {
  const safeHostname = hostname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safeTimestamp = generatedAt.replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/g, "");
  return `localelens-${safeHostname}-${safeTimestamp}.json`;
}

export function canExportReport(regions: RegionRunState[]): boolean {
  return regions.filter(({ response }) => response?.ok).length >= 2;
}

export function createJsonReport(input: JsonReportInput): JsonReportOutput {
  if (!canExportReport(input.regions)) {
    throw new Error("At least two successful regional captures are required.");
  }

  const generatedAt = new Date(input.generatedAt).toISOString();
  const hostname = new URL(input.target).hostname;
  const sortedRegions = [...input.regions].sort(compareCountries);
  const results: SafeResult[] = [];
  const failures: SafeFailure[] = [];

  for (const region of sortedRegions) {
    if (!region.response) continue;
    if (region.response.ok) {
      results.push({
        country: region.country,
        evidence: safeEvidence(region.response.evidence),
        receipt: {
          runId: input.runId,
          country: region.country,
          attempt: region.response.receipt.attempt,
          sessionRef: region.response.receipt.sessionRef,
          proxyCountry: region.response.receipt.proxyCountry,
          proxyTier: region.response.receipt.proxyTier,
          timezoneId: region.response.receipt.timezoneId,
        },
      });
    } else {
      failures.push({
        country: region.country,
        correlation: safeCorrelation(
          region.response.correlation,
          input.runId,
          region.country,
        ),
        code: region.response.error.code,
        message: region.response.error.message,
        retryable: region.response.error.retryable,
      });
    }
  }

  const report: JsonReport = {
    schemaVersion: 3,
    provenance: "live_solari",
    generatedAt,
    runId: input.runId,
    status:
      input.status === "complete" && results.length === sortedRegions.length
        ? "complete"
        : "partial",
    target: { hostname },
    countries: sortedRegions.map(({ country }) => country),
    results,
    failures,
    comparisons: safeComparisons(sortedRegions),
    limitations,
  };
  const json = JSON.stringify(report, null, 2);
  const byteLength = new TextEncoder().encode(json).byteLength;

  if (byteLength > CAPTURE_LIMITS.exportBytes) {
    throw new Error("Report exceeds the 256 KiB export limit.");
  }

  return {
    byteLength,
    filename: filenameFor(hostname, generatedAt),
    json,
  };
}
