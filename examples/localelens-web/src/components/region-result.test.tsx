import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegionResult } from "@/src/components/region-result";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      `data:image/jpeg;base64,${sampleCaptureByCountry.us.screenshot.base64}`,
    );
    expect(screen.getByText("Live evidence")).toBeVisible();
  });

  it("lets the user expand and collapse a regional screenshot inline", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: sampleCaptureByCountry.us,
    };

    render(<RegionResult onRetry={vi.fn()} region={region} />);

    const article = screen.getByRole("article", {
      name: "United States regional evidence",
    });
    const expand = screen.getByRole("button", {
      name: "View larger screenshot for United States",
    });

    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(article).not.toHaveClass("region-preview-expanded");

    fireEvent.click(expand);

    expect(
      screen.getByRole("button", {
        name: "Return United States screenshot to grid",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(article).toHaveClass("region-preview-expanded");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Return United States screenshot to grid",
      }),
    );
    expect(article).not.toHaveClass("region-preview-expanded");
  });

  it("uses bounded live screenshot bytes rather than a featured sample", () => {
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: {
        ...sampleCaptureByCountry.us,
        receipt: {
          ...sampleCaptureByCountry.us.receipt,
          sessionRef: "sol_dab46ee6c619545d0534",
        },
        screenshot: {
          ...sampleCaptureByCountry.us.screenshot,
          base64: "bGl2ZS1qcGVn",
        },
      },
    };

    render(<RegionResult onRetry={vi.fn()} region={region} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,bGl2ZS1qcGVn",
    );
    expect(screen.getByText("Live evidence")).toBeVisible();
  });

  it("keeps the page-load recording and session reference behind technical details", async () => {
    const sessionRef = "sol_dab46ee6c619545d0534";
    const fetchReplay = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchReplay);
    const region: RegionRunState = {
      country: "us",
      stage: "complete",
      response: {
        ...sampleCaptureByCountry.us,
        receipt: {
          ...sampleCaptureByCountry.us.receipt,
          sessionRef,
        },
      },
    };

    render(<RegionResult onRetry={vi.fn()} region={region} />);

    const summary = screen.getByText("Technical details", {
      selector: "summary",
    });
    expect(summary).toBeVisible();
    expect(screen.queryByText(sessionRef)).not.toBeInTheDocument();
    expect(screen.queryByText("Checking recording")).not.toBeInTheDocument();
    expect(fetchReplay).not.toHaveBeenCalled();

    fireEvent.click(summary);

    expect(await screen.findByText(sessionRef)).toBeVisible();
    expect(await screen.findByText("Recording pending")).toBeVisible();
    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(1));
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
        correlation: null,
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
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps a running card distinct from sample evidence", () => {
    render(
      <RegionResult
        onRetry={vi.fn()}
        region={{ country: "de", stage: "navigating", response: null }}
      />,
    );

    expect(screen.getByText("Loading page")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
