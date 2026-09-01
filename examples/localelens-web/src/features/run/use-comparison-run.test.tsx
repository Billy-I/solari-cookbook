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

function response(body: CaptureResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
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

  it("rejects a cached retry after a replacement run starts", async () => {
    const comparison = deferredComparisonRunner();
    const country = deferredCountryRunner();
    const { result } = renderHook(() =>
      useComparisonRun({
        comparisonRunner: comparison.runner,
        countryRunner: country.runner,
        mode: "live",
      }),
    );
    const replacement: AuditFormValue = {
      url: "https://second.example.test/",
      countries: ["gb", "jp"],
    };

    let first!: Promise<void>;
    act(() => {
      first = result.current.start(value);
    });
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    const cachedRetry = result.current.retry;

    let second!: Promise<void>;
    act(() => {
      second = result.current.start(replacement);
    });
    act(() => {
      void cachedRetry("gb");
    });

    expect(country.calls).toHaveLength(0);
    expect(result.current.value).toEqual(replacement);
    expect(result.current.regions.map(({ country: code }) => code)).toEqual([
      "gb",
      "jp",
    ]);

    succeed(comparison.calls[1]!.events, "gb", sampleCaptureByCountry.gb);
    fail(comparison.calls[1]!.events, "jp", retryableFailure.error);
    await settle(second, comparison.calls[1]!.resolve);
    await settle(first, comparison.calls[0]!.resolve);

    expect(result.current.regions.find(({ country: code }) => code === "gb")).toMatchObject(
      { response: sampleCaptureByCountry.gb, stage: "complete" },
    );
  });

  it("rejects a cached retry after cancellation", async () => {
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
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    const cachedRetry = result.current.retry;

    act(() => result.current.cancel());
    act(() => {
      void cachedRetry("gb");
    });

    expect(country.calls).toHaveLength(0);
    expect(result.current.status).toBe("cancelled");
    await settle(run, comparison.calls[0]!.resolve);
  });

  it("reserves a failed country synchronously so same-tick retries issue one request", async () => {
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
    let secondRetry!: Promise<void>;
    act(() => {
      firstRetry = result.current.retry("gb");
      secondRetry = result.current.retry("gb");
    });

    expect(country.calls).toHaveLength(1);
    succeed(country.calls[0]!.events, "gb", sampleCaptureByCountry.gb);
    await settle(firstRetry, country.calls[0]!.resolve);
    await act(async () => secondRetry);
    expect(result.current.status).toBe("complete");
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

  it("retains timed-out transport ownership and permits retry only after that transport settles", async () => {
    vi.useFakeTimers();
    const transports: Array<{ resolve(response: Response): void }> = [];
    const fetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Promise<Response>((resolve) => {
          transports.push({ resolve });
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const { result, unmount } = renderHook(() =>
      useComparisonRun({ mode: "live" }),
    );

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    const initialSignal = (fetch.mock.calls[0]![1] as RequestInit)
      .signal as AbortSignal;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
      await run;
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.regions.every(({ stage }) => stage === "failed")).toBe(
      true,
    );

    act(() => {
      void result.current.retry("us");
    });
    expect(fetch).toHaveBeenCalledTimes(3);

    await act(async () => {
      transports[0]!.resolve(response(sampleCaptureByCountry.us));
      await Promise.resolve();
      await Promise.resolve();
    });

    let retry!: Promise<void>;
    act(() => {
      retry = result.current.retry("us");
    });
    expect(fetch).toHaveBeenCalledTimes(4);
    transports[3]!.resolve(response(sampleCaptureByCountry.us));
    await act(async () => retry);

    unmount();
    expect(initialSignal.aborted).toBe(true);
  });

  it("hands released transport capacity to an abort-and-replace run", async () => {
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        const onAbort = () => reject(signal.reason);

        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useComparisonRun({ mode: "live" }));

    let first!: Promise<void>;
    act(() => {
      first = result.current.start(value);
    });
    expect(fetch).toHaveBeenCalledTimes(3);

    let replacement!: Promise<void>;
    act(() => {
      replacement = result.current.start({
        url: "https://second.example.test/",
        countries: ["fr", "jp"],
      });
    });
    expect(fetch).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    });
    expect(
      fetch.mock.calls.slice(3).map(([, init]) =>
        JSON.parse(String(init?.body)),
      ),
    ).toEqual([
      { country: "fr", url: "https://second.example.test/" },
      { country: "jp", url: "https://second.example.test/" },
    ]);

    act(() => result.current.cancel());
    await act(async () => Promise.all([first, replacement]));
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("fails closed at three unresolved transports when a timed-out run is replaced", async () => {
    vi.useFakeTimers();
    const transports: Array<{ resolve(response: Response): void }> = [];
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          transports.push({ resolve });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useComparisonRun({ mode: "live" }));

    let first!: Promise<void>;
    act(() => {
      first = result.current.start(value);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
      await first;
    });
    expect(fetch).toHaveBeenCalledTimes(3);

    let replacement!: Promise<void>;
    act(() => {
      replacement = result.current.start({
        url: "https://second.example.test/",
        countries: ["fr", "jp", "au"],
      });
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    act(() => result.current.cancel());
    await act(async () => replacement);

    await act(async () => {
      for (const transport of transports) {
        transport.resolve(response(sampleCaptureByCountry.us));
      }
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["duplicate", ["us", "us"]],
    ["fewer than two", ["us"]],
    ["more than three", ["us", "gb", "de", "fr"]],
    ["unsupported", ["us", "zz"]],
  ])("rejects %s countries before sample or live work starts", async (_case, countries) => {
    for (const mode of ["sample", "live"] as const) {
      vi.useFakeTimers();
      const comparisonRunner = vi.fn<ComparisonRunner>(async () => undefined);
      const countryRunner = vi.fn<CountryRunner>(async () => undefined);
      const { result, unmount } = renderHook(() =>
        useComparisonRun({ comparisonRunner, countryRunner, mode }),
      );
      const invalidValue = {
        ...value,
        countries: countries as AuditFormValue["countries"],
      };
      let rejection: unknown;

      await act(async () => {
        const run = result.current.start(invalidValue).catch((error: unknown) => {
          rejection = error;
        });
        await vi.runAllTimersAsync();
        await run;
      });

      expect(rejection).toEqual(
        new Error("Select exactly 2 or 3 unique supported countries."),
      );
      expect(result.current.status).toBe("idle");
      expect(result.current.regions).toEqual([]);
      expect(comparisonRunner).not.toHaveBeenCalled();
      expect(countryRunner).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      unmount();
      vi.useRealTimers();
    }
  });

  it("rejects an invalid replacement without aborting or changing the current run", async () => {
    const comparison = deferredComparisonRunner();
    const { result } = renderHook(() =>
      useComparisonRun({ comparisonRunner: comparison.runner, mode: "live" }),
    );
    const invalidValue: AuditFormValue = {
      ...value,
      countries: ["us", "us"],
    };

    let run!: Promise<void>;
    act(() => {
      run = result.current.start(value);
    });
    act(() => comparison.calls[0]!.events.started("us"));
    let rejection: unknown;
    void result.current.start(invalidValue).catch((error: unknown) => {
      rejection = error;
    });
    await act(async () => Promise.resolve());

    expect(rejection).toEqual(
      new Error("Select exactly 2 or 3 unique supported countries."),
    );
    expect(comparison.calls).toHaveLength(1);
    expect(comparison.calls[0]!.signal.aborted).toBe(false);
    expect(result.current.value).toEqual(value);
    expect(result.current.regions[0]).toMatchObject({
      country: "us",
      stage: "launching",
    });

    act(() => result.current.cancel());
    await settle(run, comparison.calls[0]!.resolve);
  });

  it("invalidates cached retries and abort-ignoring callbacks when unmounted", async () => {
    const comparison = deferredComparisonRunner();
    const country = deferredCountryRunner();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() =>
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
    fail(comparison.calls[0]!.events, "gb", retryableFailure.error);
    const cachedRetry = result.current.retry;
    const snapshot = result.current.regions;

    unmount();
    succeed(comparison.calls[0]!.events, "us", sampleCaptureByCountry.us);
    void cachedRetry("gb");
    await settle(run, comparison.calls[0]!.resolve);

    expect(comparison.calls[0]!.signal.aborted).toBe(true);
    expect(country.calls).toHaveLength(0);
    expect(snapshot.find(({ country }) => country === "us")?.response).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
