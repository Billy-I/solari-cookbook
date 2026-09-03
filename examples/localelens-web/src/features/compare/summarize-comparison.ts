import type { RegionRunState } from "@/src/features/run/use-comparison-run";

import { compareEvidence, type DifferenceRow } from "./compare-evidence";

export type DecisionSignal = {
  category: "availability" | "routing" | "localization" | "consent";
  state: "consistent" | "attention" | "unavailable";
  title: string;
  detail: string;
};

function comparisonState(
  rows: DifferenceRow[],
  fields: DifferenceRow["field"][],
): DecisionSignal["state"] {
  const selected = rows.filter(({ field }) => fields.includes(field));
  if (selected.some(({ kind }) => kind === "unavailable")) return "unavailable";
  if (selected.some(({ kind }) => kind === "different" || kind === "missing")) {
    return "attention";
  }
  return "consistent";
}

export function summarizeComparison(
  regions: RegionRunState[],
): DecisionSignal[] {
  const settled = regions
    .filter(
      (region): region is RegionRunState & {
        response: NonNullable<RegionRunState["response"]>;
      } => region.response !== null,
    )
    .sort((left, right) => left.country.localeCompare(right.country));
  const successful = settled.filter(({ response }) => response.ok);
  const failed = settled.length - successful.length;
  const rows = compareEvidence(settled);
  const comparable = successful.length >= 2;
  const availabilityState: DecisionSignal["state"] = !comparable
    ? "unavailable"
    : failed > 0 || settled.length < regions.length
      ? "attention"
      : "consistent";
  const routingState = comparisonState(rows, ["final_url"]);
  const localizationState = comparisonState(rows, [
    "language",
    "currency",
    "price",
    "heading",
    "primary_action",
  ]);
  const consentState = comparisonState(rows, ["consent"]);

  return [
    {
      category: "availability",
      state: availabilityState,
      title: "Evidence availability",
      detail: `${successful.length} successful · ${failed} failed across ${regions.length} selected markets.`,
    },
    {
      category: "routing",
      state: routingState,
      title: "Routing",
      detail:
        routingState === "unavailable"
          ? "At least two successful captures are needed to compare routing."
          : routingState === "attention"
            ? "Successful markets resolved to different or missing final URLs."
            : "Successful markets resolved to the same final URL.",
    },
    {
      category: "localization",
      state: localizationState,
      title: "Localization",
      detail:
        localizationState === "unavailable"
          ? "At least two successful captures are needed to compare localization."
          : localizationState === "attention"
            ? "Successful markets differ in language, currency, price, heading, or primary action evidence."
            : "Successful markets show the same localization evidence.",
    },
    {
      category: "consent",
      state: consentState,
      title: "Consent",
      detail:
        consentState === "unavailable"
          ? "At least two successful captures are needed to compare consent."
          : consentState === "attention"
            ? "Successful markets show different or missing consent evidence."
            : "Successful markets show the same consent evidence.",
    },
  ];
}
