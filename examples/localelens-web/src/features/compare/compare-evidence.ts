import type {
  ComparisonCapture,
  PageEvidence,
  SupportedCountry,
} from "@/src/features/capture/contracts";

export type DifferenceKind = "same" | "different" | "missing" | "unavailable";

export type DifferenceRow = {
  field:
    | "final_url"
    | "title"
    | "language"
    | "currency"
    | "price"
    | "heading"
    | "primary_action"
    | "consent";
  values: Partial<Record<SupportedCountry, string>>;
  kind: DifferenceKind;
};

export type { ComparisonCapture } from "@/src/features/capture/contracts";

type ComparedField = DifferenceRow["field"];

const FIELDS: readonly ComparedField[] = [
  "final_url",
  "title",
  "language",
  "currency",
  "price",
  "heading",
  "primary_action",
  "consent",
];

function valueFor(field: ComparedField, evidence: PageEvidence): string | null {
  switch (field) {
    case "final_url":
      return evidence.finalUrl;
    case "title":
      return evidence.title;
    case "language":
      return evidence.documentLanguage;
    case "currency":
      return evidence.currencies.join(", ");
    case "price":
      return evidence.priceSnippets.join(", ");
    case "heading":
      return evidence.primaryHeading;
    case "primary_action":
      return evidence.primaryAction;
    case "consent":
      return evidence.consentText;
  }
}

function normalizeForComparison(field: ComparedField, value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return field === "language" || field === "currency"
    ? normalized.toLocaleLowerCase()
    : normalized;
}

export function compareEvidence(captures: ComparisonCapture[]): DifferenceRow[] {
  const sortedCaptures = [...captures].sort((left, right) =>
    left.country.localeCompare(right.country),
  );
  const successfulCaptureCount = sortedCaptures.reduce(
    (count, capture) => count + Number(capture.response.ok),
    0,
  );
  const hasUnavailableCapture = successfulCaptureCount !== sortedCaptures.length;

  return FIELDS.map((field) => {
    const values: Partial<Record<SupportedCountry, string>> = {};
    const normalizedValues: string[] = [];

    for (const capture of sortedCaptures) {
      if (!capture.response.ok) continue;

      const value = valueFor(field, capture.response.evidence);
      if (value === null || normalizeForComparison(field, value) === "") continue;

      values[capture.country] = value;
      normalizedValues.push(normalizeForComparison(field, value));
    }

    const kind: DifferenceKind = hasUnavailableCapture
      ? "unavailable"
      : normalizedValues.length !== successfulCaptureCount
      ? "missing"
        : successfulCaptureCount < 2
          ? "unavailable"
          : normalizedValues.every((value) => value === normalizedValues[0])
            ? "same"
            : "different";

    return { field, values, kind };
  });
}
