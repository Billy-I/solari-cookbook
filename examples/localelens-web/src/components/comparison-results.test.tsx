import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComparisonResults } from "@/src/components/comparison-results";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

describe("ComparisonResults", () => {
  it("describes the exact deterministic comparison normalization rules", () => {
    render(
      <ComparisonResults
        mode="sample"
        onRetry={() => undefined}
        regions={[
          {
            country: "us",
            stage: "complete",
            response: sampleCaptureByCountry.us,
          },
          {
            country: "gb",
            stage: "complete",
            response: sampleCaptureByCountry.gb,
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "All fields use whitespace normalization. Language and currency comparisons also use locale-invariant lowercasing.",
      ),
    ).toBeVisible();
  });

  it("preserves settled evidence when Germany fails and retries only Germany", () => {
    const onRetry = vi.fn();
    const regions: RegionRunState[] = [
      { country: "us", stage: "complete", response: sampleCaptureByCountry.us },
      {
        country: "de",
        stage: "failed",
        response: {
          ok: false,
          correlation: null,
          error: {
            code: "CAPTURE_FAILED",
            message: "Capture was unavailable.",
            retryable: true,
          },
        },
      },
    ];

    const { rerender } = render(
      <ComparisonResults mode="sample" onRetry={onRetry} regions={regions} />,
    );

    expect(screen.getByRole("article", { name: "United States regional evidence" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Germany" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith("de");

    rerender(
      <ComparisonResults
        mode="sample"
        onRetry={onRetry}
        regions={[
          regions[0]!,
          { country: "de", stage: "navigating", response: null },
        ]}
      />,
    );
    expect(screen.getByRole("article", { name: "United States regional evidence" })).toBeVisible();
    expect(
      screen.getByRole("article", { name: "Germany regional evidence in progress" }),
    ).toBeVisible();
  });
});
