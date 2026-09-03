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

    fireEvent.click(screen.getByText("Detailed field comparison"));

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
      { country: "gb", stage: "complete", response: sampleCaptureByCountry.gb },
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

    const whatChanged = screen.getByRole("heading", { name: "What changed" });
    const screenshots = screen.getByText("Screenshots and regional evidence");
    expect(
      whatChanged.compareDocumentPosition(screenshots) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Evidence availability")).toBeVisible();
    expect(screen.getByText("Localization")).toBeVisible();

    const screenshotsDetails = screenshots.closest("details");
    const fieldDetails = screen.getByText("Detailed field comparison").closest("details");
    expect(screenshotsDetails).toBeInstanceOf(HTMLDetailsElement);
    expect(fieldDetails).toBeInstanceOf(HTMLDetailsElement);

    fireEvent.click(screen.getByText("Detailed field comparison"));
    expect(
      screen.getByRole("row", {
        name: /Title.*Synthetic plans — United States.*Synthetic plans — United Kingdom.*Different/,
      }),
    ).toBeVisible();
    fireEvent.click(screenshots);
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
          regions[1]!,
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
