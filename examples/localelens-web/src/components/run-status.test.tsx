import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunStatus } from "@/src/components/run-status";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";

const regions: RegionRunState[] = [
  { country: "us", stage: "complete", response: null },
  { country: "gb", stage: "navigating", response: null },
  {
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
  },
];

describe("RunStatus", () => {
  it("announces one live status region with exact text per country", () => {
    render(<RunStatus regions={regions} />);

    const status = screen.getByRole("status", { name: "Comparison status" });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(within(status).getByText("United States")).toBeVisible();
    expect(within(status).getByText("Complete")).toBeVisible();
    expect(within(status).getByText("United Kingdom")).toBeVisible();
    expect(within(status).getByText("Loading page")).toBeVisible();
    expect(within(status).getByText("Germany")).toBeVisible();
    expect(within(status).getByText("Failed")).toBeVisible();
    expect(within(status).getByText("Sample capture was unavailable.")).toBeVisible();
  });

  it("does not move focus when loading status is announced", () => {
    function StatusHarness({ showStatus }: { showStatus: boolean }) {
      return (
        <>
          <button type="button">Keep focus</button>
          {showStatus ? <RunStatus regions={regions} /> : null}
        </>
      );
    }

    const { rerender } = render(<StatusHarness showStatus={false} />);
    const control = screen.getByRole("button", { name: "Keep focus" });
    control.focus();

    rerender(<StatusHarness showStatus />);

    expect(document.activeElement).toBe(control);
  });

  it("summarizes aggregate progress and the active batch", () => {
    render(
      <RunStatus
        progress={{
          selected: 5,
          queued: 2,
          running: 1,
          completed: 1,
          failed: 1,
          batch: 1,
          totalBatches: 2,
        }}
        regions={regions}
      />,
    );

    expect(screen.getByRole("heading", { name: "Comparing 5 markets" })).toBeVisible();
    expect(screen.getByText("2 of 5 captures finished · Batch 1 of 2")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Comparison progress" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
  });
});
