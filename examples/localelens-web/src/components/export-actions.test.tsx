import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExportActions } from "@/src/components/export-actions";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const completeRegions: RegionRunState[] = ["us", "gb", "de"].map((country) => ({
  country: country as "us" | "gb" | "de",
  response: sampleCaptureByCountry[country as "us" | "gb" | "de"],
  stage: "complete",
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ExportActions", () => {
  it("keeps download and print disabled until two regional receipts succeed", () => {
    render(
      <ExportActions
        mode="live"
        regions={completeRegions.slice(0, 1)}
        status="partial"
        target="https://regional.example.test/pricing"
      />,
    );

    expect(screen.getByRole("button", { name: "Download JSON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Print evidence" })).toBeDisabled();
    expect(screen.getByText("Available after 2 regional captures succeed.")).toBeVisible();
  });

  it("exports an honest partial report after two successes and revokes its object URL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T08:09:10.000Z"));
    const NativeURL = URL;
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:localelens-report";
    });
    const revokeObjectURL = vi.fn((url: string) => {
      void url;
    });
    class TestURL extends NativeURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", TestURL);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const regions: RegionRunState[] = [
      ...completeRegions.slice(0, 2),
      {
        country: "de",
        response: {
          correlation: null,
          error: {
            code: "SOLARI_CAPACITY",
            message: "Regional capacity was unavailable.",
            retryable: true,
          },
          ok: false,
        },
        stage: "failed",
      },
    ];

    render(
      <ExportActions
        mode="live"
        regions={regions}
        status="partial"
        target="https://regional.example.test/pricing"
      />,
    );

    expect(screen.getByText("Partial report: 2 of 3 captures succeeded.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(anchorClick.mock.instances[0]).toEqual(
      expect.objectContaining({
        download: "localelens-regional-example-test-2026-09-02T08-09-10-000Z.json",
        href: "blob:localelens-report",
      }),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:localelens-report");
  });

  it("prints the existing report without generating a second document", () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);

    render(
      <ExportActions
        mode="sample"
        regions={completeRegions.slice(0, 2)}
        status="complete"
        target="https://regional.example.test/pricing"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Print evidence" }));

    expect(print).toHaveBeenCalledOnce();
  });
});
