import { describe, expect, it } from "vitest";

import { summarizeComparison } from "@/src/features/compare/summarize-comparison";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const failedRegion: RegionRunState = {
  country: "fr",
  stage: "failed",
  response: {
    ok: false,
    correlation: null,
    error: {
      code: "NAVIGATION_FAILED",
      message: "The target page could not be loaded.",
      retryable: true,
    },
  },
};

const regions: RegionRunState[] = [
  { country: "us", stage: "complete", response: sampleCaptureByCountry.us },
  { country: "gb", stage: "complete", response: sampleCaptureByCountry.gb },
  failedRegion,
];

describe("summarizeComparison", () => {
  it("returns stable decision categories and exact availability counts", () => {
    const signals = summarizeComparison(regions);

    expect(signals.map(({ category }) => category)).toEqual([
      "availability",
      "routing",
      "localization",
      "consent",
    ]);
    expect(signals[0]).toEqual({
      category: "availability",
      state: "attention",
      title: "Evidence availability",
      detail: "2 successful · 1 failed across 3 selected markets.",
    });
    expect(signals.find(({ category }) => category === "routing")?.state).toBe(
      "attention",
    );
    expect(
      signals.find(({ category }) => category === "localization")?.state,
    ).toBe("attention");
    expect(signals.find(({ category }) => category === "consent")?.state).toBe(
      "attention",
    );
  });

  it("is independent of input order and avoids unsupported verdict language", () => {
    const expected = summarizeComparison(regions);
    expect(summarizeComparison([...regions].reverse())).toEqual(expected);
    expect(JSON.stringify(expected).toLowerCase()).not.toMatch(
      /score|cause|compliance/,
    );
  });

  it("marks comparisons unavailable until two markets succeed", () => {
    const signals = summarizeComparison([regions[0]!, failedRegion]);

    expect(signals[0]).toMatchObject({
      category: "availability",
      state: "unavailable",
      detail: "1 successful · 1 failed across 2 selected markets.",
    });
    expect(signals.slice(1).every(({ state }) => state === "unavailable")).toBe(
      true,
    );
  });
});
