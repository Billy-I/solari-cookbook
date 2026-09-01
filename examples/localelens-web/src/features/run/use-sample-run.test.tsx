import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditFormValue } from "@/src/components/audit-form";
import type {
  CaptureFailure,
  CaptureResponse,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import { useSampleRun } from "@/src/features/run/use-sample-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const value: AuditFormValue = {
  url: "https://regional.example.test/pricing",
  countries: ["us", "gb", "de"],
};

const safeFailure: CaptureFailure = {
  ok: false,
  error: {
    code: "CAPTURE_FAILED",
    message: "Sample capture was unavailable. No provider detail was exposed.",
    retryable: true,
  },
};

function fixtureLookup(country: SupportedCountry): CaptureResponse {
  if (country === "us" || country === "gb" || country === "de") {
    return sampleCaptureByCountry[country];
  }

  return safeFailure;
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe("useSampleRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("progresses countries independently and exposes the first result early", async () => {
    const { result } = renderHook(() => useSampleRun(fixtureLookup));

    let run: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });

    expect(result.current.status).toBe("running");
    expect(result.current.regions.map((region) => region.stage)).toEqual([
      "queued",
      "queued",
      "queued",
    ]);

    await advance(250);

    expect(result.current.regions[0]).toMatchObject({
      country: "us",
      stage: "complete",
    });
    expect(result.current.regions[0]!.response?.ok).toBe(true);
    expect(result.current.regions[2]!.stage).not.toBe("complete");

    await advance(100);
    await act(async () => run);

    expect(result.current.status).toBe("complete");
    expect(result.current.regions.every(({ stage }) => stage === "complete")).toBe(
      true,
    );
  });

  it("retries only the requested country", async () => {
    const lookup = vi.fn(fixtureLookup);
    const { result } = renderHook(() => useSampleRun(lookup));

    let run: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    await advance(400);
    await act(async () => run);

    lookup.mockClear();
    let retry: Promise<void>;
    act(() => {
      retry = result.current.retry("gb");
    });

    expect(result.current.regions.find(({ country }) => country === "gb")?.stage).toBe(
      "queued",
    );
    expect(result.current.regions.find(({ country }) => country === "us")?.stage).toBe(
      "complete",
    );

    await advance(300);
    await act(async () => retry);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("gb");
    expect(result.current.status).toBe("complete");
  });

  it("finishes partial when one country has a safe failure", async () => {
    const lookup = (country: SupportedCountry): CaptureResponse =>
      country === "gb" ? safeFailure : fixtureLookup(country);
    const { result } = renderHook(() => useSampleRun(lookup));

    let run: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    await advance(400);
    await act(async () => run);

    expect(result.current.status).toBe("partial");
    expect(result.current.regions.find(({ country }) => country === "gb")).toMatchObject(
      {
        stage: "failed",
        response: safeFailure,
      },
    );
  });
});
