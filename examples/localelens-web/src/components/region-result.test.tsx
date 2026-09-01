import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegionResult } from "@/src/components/region-result";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

describe("RegionResult", () => {
  it("describes the screenshot with country, host, and timestamp", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: sampleCaptureByCountry.us,
    };

    render(<RegionResult mode="sample" onRetry={vi.fn()} region={region} />);

    expect(
      screen.getByRole("img", {
        name: /United States.*regional\.example\.test.*1 Sep 2026, 12:00:00 UTC/i,
      }),
    ).toBeVisible();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("%2Fsample%2Fus.jpg"),
    );
    expect(screen.getByText("Sample evidence")).toBeVisible();
  });

  it("uses bounded live screenshot bytes rather than a featured sample", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: {
        ...sampleCaptureByCountry.us,
        screenshot: {
          ...sampleCaptureByCountry.us.screenshot,
          base64: "bGl2ZS1qcGVn",
        },
      },
    };

    render(<RegionResult mode="live" onRetry={vi.fn()} region={region} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,bGl2ZS1qcGVn",
    );
    expect(screen.getByText("Live evidence")).toBeVisible();
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

    render(<RegionResult mode="sample" onRetry={vi.fn()} region={region} />);

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

    render(<RegionResult mode="sample" onRetry={onRetry} region={region} />);

    expect(screen.getByText("CAPTURE_FAILED")).toBeVisible();
    expect(screen.getByText("Sample capture was unavailable.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Germany" }));
    expect(onRetry).toHaveBeenCalledWith("de");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps a running card distinct from sample evidence", () => {
    render(
      <RegionResult
        mode="live"
        onRetry={vi.fn()}
        region={{ country: "de", stage: "navigating", response: null }}
      />,
    );

    expect(screen.getByText("Loading page")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
