import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegionResult } from "@/src/components/region-result";
import type { RegionRunState } from "@/src/features/run/use-sample-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

describe("RegionResult", () => {
  it("describes the screenshot with country, host, and timestamp", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: sampleCaptureByCountry.us,
    };

    render(<RegionResult onRetry={vi.fn()} region={region} />);

    expect(
      screen.getByRole("img", {
        name: /United States.*regional\.example\.test.*1 Sep 2026, 12:00:00 UTC/i,
      }),
    ).toBeVisible();
  });

  it("renders null consent as not detected", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: {
        ...sampleCaptureByCountry.us,
        evidence: {
          ...sampleCaptureByCountry.us.evidence,
          consentText: null,
        },
      },
    };

    render(<RegionResult onRetry={vi.fn()} region={region} />);

    expect(screen.getByText("Not detected")).toBeVisible();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("retains safe failure copy and offers an explicit retry", () => {
    const onRetry = vi.fn();
    const region: RegionRunState = {
      country: "de",
      stage: "failed",
      response: {
        ok: false,
        error: {
          code: "CAPTURE_FAILED",
          message: "Sample capture was unavailable.",
          retryable: true,
        },
      },
    };

    render(<RegionResult onRetry={onRetry} region={region} />);

    expect(screen.getByText("CAPTURE_FAILED")).toBeVisible();
    expect(screen.getByText("Sample capture was unavailable.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Germany" }));
    expect(onRetry).toHaveBeenCalledWith("de");
  });
});
