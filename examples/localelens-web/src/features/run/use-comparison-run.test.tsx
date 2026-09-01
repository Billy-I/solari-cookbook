import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditFormValue } from "@/src/components/audit-form";
import type {
  CaptureFailure,
  CaptureResponse,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import type {
  PublicCaptureError,
  RunEvents,
} from "@/src/features/run/run-comparison";
import {
  type ComparisonRunner,
  type CountryRunner,
  useComparisonRun,
} from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const value: AuditFormValue = {
  url: "https://regional.example.test/pricing",
  countries: ["us", "gb", "de"],
};

const retryableFailure: CaptureFailure = {
  ok: false,
  error: {
    code: "NAVIGATION_TIMEOUT",
    message: "The target did not load within the capture limit.",
    retryable: true,
  },
};

type ComparisonCall = {
  events: RunEvents;
  input: AuditFormValue;
  reject: (reason?: unknown) => void;
  resolve: () => void;
  signal: AbortSignal;
};

type CountryCall = {
  country: SupportedCountry;
  events: RunEvents;
  reject: (reason?: unknown) => void;
  resolve: () => void;
  signal: AbortSignal;
  url: string;
};

function deferredComparisonRunner() {
  const calls: ComparisonCall[] = [];
  const runner: ComparisonRunner = vi.fn((input, events, signal) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ events, input, reject, resolve, signal });
    }),
  );

  return { calls, runner };
}

function deferredCountryRunner() {
  const calls: CountryCall[] = [];
  const runner: CountryRunner = vi.fn((country, url, events, signal) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ country, events, reject, resolve, signal, url });
    }),
  );

  return { calls, runner };
}

function fail(events: RunEvents, country: SupportedCountry, error: PublicCaptureError) {
  act(() => events.failed(country, error));
}

function succeed(
  events: RunEvents,
  country: SupportedCountry,
  response: CaptureResponse,
) {
  act(() => events.succeeded(country, response));
}

async function settle(promise: Promise<void>, resolve: () => void) {
  resolve();
  await act(async () => promise);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useComparisonRun", () => {
  it("starts idle and reports the configured provenance mode", () => {
    const { result } = renderHook(() => useComparisonRun({ mode: "live" }));

    expect(result.current.mode).toBe("live");
    expect(result.current.status).toBe("idle");
    expect(result.current.regions).toEqual([]);
  });

  it("loads countries independently and exposes the first result before all settle", async () => {
    const comparison = deferredComparisonRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ comparisonRunner: comparison.runner, mode: "live" }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });

    expect(result.current.status).toBe("running");
    expect(result.current.regions.map(({ stage }) => stage)).toEqual([
      "queued",
      "queued",
      "queued",
    ]);

    act(() => {
      comparison.calls[0]!.events.started("us");
      comparison.calls[0]!.events.started("gb");
    });
    expect(result.current.regions.map(({ stage }) => stage)).toEqual([
      "launching",
      "launching",
      "queued",
    ]);

    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    expect(result.current.status).toBe("partial");
    expect(result.current.regions[0]).toMatchObject({
      country: "us",
      response: sampleCaptureByCountry.us,
      stage: "complete",
    });
    expect(result.current.regions[1]!.response).toBeNull();

    succeed(comparison.calls[0]!.events, "gb", sampleCaptureByCountry.gb);
    succeed(comparison.calls[0]!.events, "de", sampleCaptureByCountry.de);
    await settle(run, comparison.calls[0]!.resolve);

    expect(result.current.status).toBe("complete");
    expect(result.current.regions.every(({ stage }) => stage === "complete")).toBe(
      true,
    );
  });

  it("keeps successful countries when one country fails", async () => {
    const comparison = deferredComparisonRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ comparisonRunner: comparison.runner, mode: "live" }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    succeed(comparison.calls[0]!.events, "de", sampleCaptureByCountry.de);
    await settle(run, comparison.calls[0]!.resolve);

    expect(result.current.status).toBe("partial");
    expect(result.current.regions.find(({ country }) => country === "gb")).toEqual({
      country: "gb",
      response: retryableFailure,
      stage: "failed",
    });
    expect(result.current.regions.find(({ country }) => country === "us")?.stage).toBe(
      "complete",
    );
  });

  it("retries exactly one currently failed retryable country and preserves siblings", async () => {
    const comparison = deferredComparisonRunner();
    const country = deferredCountryRunner();
    const { result } = renderHook(() =>
      useComparisonRun({
        comparisonRunner: comparison.runner,
        countryRunner: country.runner,
        mode: "live",
      }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    succeed(comparison.calls[0]!.events, "de", sampleCaptureByCountry.de);
    await settle(run, comparison.calls[0]!.resolve);

    let retry!: Promise<void>;
    act(() => {
      retry = result.current.retry("gb");
    });

    expect(country.calls).toHaveLength(1);
    expect(country.calls[0]).toMatchObject({
      country: "gb",
      url: "https://regional.example.test/pricing",
    });
    expect(result.current.regions.find(({ country: code }) => code === "gb")).toMatchObject(
      { response: null, stage: "queued" },
    );
    expect(result.current.regions.find(({ country: code }) => code === "us")).toMatchObject(
      { response: sampleCaptureByCountry.us, stage: "complete" },
    );

    succeed(country.calls[0]!.events, "gb", sampleCaptureByCountry.gb);
    await settle(retry, country.calls[0]!.resolve);

    expect(result.current.status).toBe("complete");
    expect(comparison.calls).toHaveLength(1);
    expect(country.calls).toHaveLength(1);
  });

  it("ignores retry requests for countries that are not failed and retryable", async () => {
    const country = deferredCountryRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ countryRunner: country.runner, mode: "live" }),
    );

    await act(async () => result.current.retry("us"));

    expect(country.calls).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("cancels active work and ignores every late callback", async () => {
    const comparison = deferredComparisonRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ comparisonRunner: comparison.runner, mode: "live" }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    act(() => result.current.cancel());

    expect(comparison.calls[0]!.signal.aborted).toBe(true);
    expect(result.current.status).toBe("cancelled");

    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    await settle(run, comparison.calls[0]!.resolve);

    expect(result.current.status).toBe("cancelled");
    expect(result.current.regions.every(({ response }) => response === null)).toBe(true);
  });

  it("a second start aborts and replaces the first run while ignoring its stale results", async () => {
    const comparison = deferredComparisonRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ comparisonRunner: comparison.runner, mode: "live" }),
    );
    const replacement: AuditFormValue = {
      url: "https://second.example.test/",
      countries: ["jp", "au"],
    };

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.start(value);
    });
    act(() => {
      second = result.current.start(replacement);
    });

    expect(comparison.calls[0]!.signal.aborted).toBe(true);
    expect(result.current.regions.map(({ country }) => country)).toEqual(["jp", "au"]);

    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    expect(result.current.regions.map(({ country }) => country)).toEqual(["jp", "au"]);

    fail(comparison.calls[1]!.events, "jp", retryableFailure.error);
    fail(comparison.calls[1]!.events, "au", retryableFailure.error);
    await settle(second, comparison.calls[1]!.resolve);
    await settle(first, comparison.calls[0]!.resolve);

    expect(result.current.status).toBe("partial");
    expect(result.current.regions.map(({ country }) => country)).toEqual(["jp", "au"]);
  });

  it("ignores stale callbacks from an earlier retry attempt", async () => {
    const comparison = deferredComparisonRunner();
    const country = deferredCountryRunner();
    const { result } = renderHook(() =>
      useComparisonRun({
        comparisonRunner: comparison.runner,
        countryRunner: country.runner,
        mode: "live",
      }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    succeed(comparison.calls[0]!.events, "de", sampleCaptureByCountry.de);
    await settle(run, comparison.calls[0]!.resolve);

    let firstRetry!: Promise<void>;
    act(() => {
      firstRetry = result.current.retry("gb");
    });
    fail(country.calls[0]!.events, "gb", retryableFailure.error);
    await settle(firstRetry, country.calls[0]!.resolve);

    let secondRetry!: Promise<void>;
    act(() => {
      secondRetry = result.current.retry("gb");
    });
    succeed(country.calls[0]!.events, "gb", sampleCaptureByCountry.gb);

    expect(result.current.regions.find(({ country: code }) => code === "gb")).toMatchObject(
      { response: null, stage: "queued" },
    );

    succeed(country.calls[1]!.events, "gb", sampleCaptureByCountry.gb);
    await settle(secondRetry, country.calls[1]!.resolve);
    expect(result.current.status).toBe("complete");
  });

  it("uses deterministic fixture timing in sample mode without calling the live runner", async () => {
    vi.useFakeTimers();
    const comparison = deferredComparisonRunner();
    const country = deferredCountryRunner();
    const { result } = renderHook(() =>
      useComparisonRun({
        comparisonRunner: comparison.runner,
        countryRunner: country.runner,
        mode: "sample",
      }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
      await run;
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.regions.map(({ response }) => response)).toEqual([
      sampleCaptureByCountry.us,
      sampleCaptureByCountry.gb,
      sampleCaptureByCountry.de,
    ]);
    expect(comparison.calls).toHaveLength(0);
    expect(country.calls).toHaveLength(0);
  });
});
