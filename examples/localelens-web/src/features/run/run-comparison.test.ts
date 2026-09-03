import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditFormValue } from "@/src/components/audit-form";
import type { CaptureResponse } from "@/src/features/capture/contracts";
import {
  runComparison as runComparisonWithContext,
  runCountryCapture as runCountryCaptureWithContext,
  type CaptureTransportPool,
  type RunEvents,
  validateSelectedCountries,
} from "@/src/features/run/run-comparison";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const input: AuditFormValue = {
  url: " https://regional.example.test/pricing ",
  countries: ["us", "gb", "de"],
};
const runContext = {
  runId: "llr_123e4567-e89b-42d3-a456-426614174000",
  attempt: 1,
} as const;

function withRunContext(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("ok" in body)) return body;
  if (body.ok === false) {
    return Object.hasOwn(body, "correlation")
      ? body
      : { ...body, correlation: null };
  }
  if (
    body.ok === true &&
    "receipt" in body &&
    typeof body.receipt === "object" &&
    body.receipt !== null
  ) {
    return {
      ...body,
      receipt: {
        ...body.receipt,
        ...runContext,
        sessionRef: "sol_0123456789abcdefabcd",
      },
    };
  }
  return body;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(withRunContext(body)), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function liveCapture(body: CaptureResponse): CaptureResponse {
  return withRunContext(body) as CaptureResponse;
}

function runComparison(
  value: AuditFormValue,
  runEvents: RunEvents,
  signal: AbortSignal,
  transportPool?: CaptureTransportPool,
) {
  return runComparisonWithContext(
    value,
    runContext,
    runEvents,
    signal,
    transportPool,
  );
}

function runCountryCapture(
  country: AuditFormValue["countries"][number],
  url: string,
  runEvents: RunEvents,
  signal: AbortSignal,
  transportPool?: CaptureTransportPool,
) {
  return runCountryCaptureWithContext(
    country,
    url,
    runContext,
    runEvents,
    signal,
    transportPool,
  );
}

function events() {
  return {
    batchStarted: vi.fn(),
    failed: vi.fn(),
    started: vi.fn(),
    succeeded: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("runComparison", () => {
  it("runs selected markets in deterministic batches of at most three transports", async () => {
    const selected = ["us", "gb", "de", "fr", "jp", "au"] as const;
    const pending: Array<{
      country: (typeof selected)[number];
      resolve: () => void;
    }> = [];
    let active = 0;
    let maximumActive = 0;
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        country: (typeof selected)[number];
        runId: string;
        attempt: number;
      };
      active += 1;
      maximumActive = Math.max(maximumActive, active);

      return new Promise<Response>((resolve) => {
        pending.push({
          country: request.country,
          resolve: () => {
            active -= 1;
            const fixture = sampleCaptureByCountry.us;
            resolve(
              response({
                ...fixture,
                receipt: {
                  ...fixture.receipt,
                  country: request.country,
                  proxyCountry: request.country,
                  runId: request.runId,
                  attempt: request.attempt,
                },
              }),
            );
          },
        });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    const run = runComparisonWithContext(
      {
        url: "https://regional.example.test/pricing",
        countries: [...selected],
      },
      runContext,
      runEvents,
      new AbortController().signal,
    );

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(pending.map(({ country }) => country)).toEqual(["us", "gb", "de"]);
    expect(runEvents.batchStarted).toHaveBeenNthCalledWith(1, 1, 2);

    for (const request of pending.slice(0, 3)) request.resolve();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
    expect(pending.map(({ country }) => country)).toEqual([...selected]);
    expect(runEvents.batchStarted).toHaveBeenNthCalledWith(2, 2, 2);

    for (const request of pending.slice(3)) request.resolve();
    await run;

    expect(maximumActive).toBe(3);
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body))))
      .toEqual(selected.map((country) => ({ country, ...runContext, url: input.url.trim() })));
  });

  it("accepts four markets and rejects selections beyond the verified catalogue", () => {
    expect(
      validateSelectedCountries({ ...input, countries: ["us", "gb", "de", "fr"] }),
    ).toEqual(["us", "gb", "de", "fr"]);
    expect(() =>
      validateSelectedCountries({
        ...input,
        countries: [
          "au", "br", "ca", "de", "es", "fr", "gb", "in",
          "it", "jp", "kr", "mx", "nl", "sg", "us", "us",
        ],
      }),
    ).toThrow("Select 2 to 15 unique supported countries.");
  });

  it("does not start a later batch after cancellation", async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const abort = new DOMException("cancelled", "AbortError");
    const runEvents = events();

    const run = runComparisonWithContext(
      {
        url: "https://regional.example.test/pricing",
        countries: ["us", "gb", "de", "fr"],
      },
      runContext,
      runEvents,
      controller.signal,
    );

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    controller.abort(abort);

    await expect(run).rejects.toBe(abort);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(runEvents.batchStarted).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a top-level success apiKey", { ...sampleCaptureByCountry.us, apiKey: "not-allowed" }],
    [
      "an evidence extra field",
      {
        ...sampleCaptureByCountry.us,
        evidence: { ...sampleCaptureByCountry.us.evidence, extra: "not-allowed" },
      },
    ],
    [
      "a receipt extra field",
      {
        ...sampleCaptureByCountry.us,
        receipt: { ...sampleCaptureByCountry.us.receipt, extra: "not-allowed" },
      },
    ],
    [
      "a screenshot extra field",
      {
        ...sampleCaptureByCountry.us,
        screenshot: { ...sampleCaptureByCountry.us.screenshot, extra: "not-allowed" },
      },
    ],
    [
      "a top-level failure extra field",
      {
        ok: false,
        error: {
          code: "NAVIGATION_TIMEOUT",
          message: "The target did not load within the capture limit.",
          retryable: true,
        },
        extra: "not-allowed",
      },
    ],
    [
      "a failure error extra field",
      {
        ok: false,
        error: {
          code: "NAVIGATION_TIMEOUT",
          message: "The target did not load within the capture limit.",
          retryable: true,
          extra: "not-allowed",
        },
      },
    ],
  ])("fails closed for %s", async (_case, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
    const runEvents = events();

    await runCountryCapture(
      "us",
      "https://regional.example.test/pricing",
      runEvents,
      new AbortController().signal,
    );

    expect(runEvents.succeeded).not.toHaveBeenCalled();
    expect(runEvents.failed).toHaveBeenCalledWith(
      "us",
      expect.objectContaining({ code: "CAPTURE_FAILED", retryable: true }),
    );
  });

  it("fails closed for a non-ISO-offset capture timestamp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ...sampleCaptureByCountry.us,
          evidence: {
            ...sampleCaptureByCountry.us.evidence,
            capturedAt: "1 September 2026",
          },
        }),
      ),
    );
    const runEvents = events();

    await runCountryCapture(
      "us",
      "https://regional.example.test/pricing",
      runEvents,
      new AbortController().signal,
    );

    expect(runEvents.succeeded).not.toHaveBeenCalled();
    expect(runEvents.failed).toHaveBeenCalledWith(
      "us",
      expect.objectContaining({ code: "CAPTURE_FAILED", retryable: true }),
    );
  });

  it("fails closed when both receipt countries differ from the requested fan-out country", async () => {
    const mismatchedResponse: CaptureResponse = {
      ...sampleCaptureByCountry.gb,
      receipt: {
        ...sampleCaptureByCountry.gb.receipt,
        country: "gb",
        proxyCountry: "gb",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(mismatchedResponse)),
    );
    const runEvents = events();

    await runCountryCapture(
      "us",
      "https://regional.example.test/pricing",
      runEvents,
      new AbortController().signal,
    );

    expect(runEvents.succeeded).not.toHaveBeenCalled();
    expect(runEvents.failed).toHaveBeenCalledWith(
      "us",
      expect.objectContaining({
        code: "SOLARI_PROXY_MISMATCH",
        retryable: false,
      }),
    );
  });

  it("runs exactly one normalized country request for an explicit retry", async () => {
    const fetch = vi.fn().mockResolvedValue(response(sampleCaptureByCountry.gb));
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    await runCountryCapture(
      "gb",
      " https://regional.example.test/pricing ",
      runEvents,
      new AbortController().signal,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/captures",
      expect.objectContaining({
        body: JSON.stringify({
          country: "gb",
          url: "https://regional.example.test/pricing",
          ...runContext,
        }),
      }),
    );
    expect(runEvents.started).toHaveBeenCalledWith("gb");
    expect(runEvents.succeeded).toHaveBeenCalledWith(
      "gb",
      liveCapture(sampleCaptureByCountry.gb),
    );
  });

  it("posts one normalized request per selected country and emits results as each settles", async () => {
    let resolveUs: ((value: Response) => void) | undefined;
    const us = new Promise<Response>((resolve) => {
      resolveUs = resolve;
    });
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => us)
      .mockResolvedValueOnce(response(sampleCaptureByCountry.gb))
      .mockResolvedValueOnce(response(sampleCaptureByCountry.de));
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    const run = runComparison(input, runEvents, new AbortController().signal);
    await vi.waitFor(() => expect(runEvents.succeeded).toHaveBeenCalledTimes(2));

    expect(runEvents.started.mock.calls).toEqual([["us"], ["gb"], ["de"]]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/captures",
      expect.objectContaining({
        body: JSON.stringify({
          country: "us",
          url: "https://regional.example.test/pricing",
          ...runContext,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/captures",
      expect.objectContaining({ body: expect.stringContaining('"country":"fr"') }),
    );

    resolveUs?.(response(sampleCaptureByCountry.us));
    await run;

    expect(runEvents.succeeded.mock.calls.map(([country]) => country)).toEqual([
      "gb",
      "de",
      "us",
    ]);
    expect(runEvents.failed).not.toHaveBeenCalled();
  });

  it("preserves successful countries while emitting safe failed events for malformed and failed responses", async () => {
    const apiFailure: CaptureResponse = {
      ok: false,
      correlation: null,
      error: {
        code: "NAVIGATION_TIMEOUT",
        message: "The target did not load within the capture limit.",
        retryable: true,
      },
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(sampleCaptureByCountry.us))
      .mockResolvedValueOnce(response(apiFailure, 504))
      .mockResolvedValueOnce(new Response("not json", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    await runComparison(input, runEvents, new AbortController().signal);

    expect(runEvents.succeeded).toHaveBeenCalledWith(
      "us",
      liveCapture(sampleCaptureByCountry.us),
    );
    expect(runEvents.failed).toHaveBeenCalledTimes(2);
    expect(runEvents.failed.mock.calls).toEqual([
      [
        "gb",
        expect.objectContaining({ code: "NAVIGATION_TIMEOUT", retryable: true }),
      ],
      [
        "de",
        expect.objectContaining({ code: "CAPTURE_FAILED", retryable: true }),
      ],
    ]);
  });

  it("does not retry and propagates a user abort", async () => {
    const controller = new AbortController();
    const abort = new DOMException("cancelled", "AbortError");
    const fetch = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    controller.abort(abort);

    await expect(runComparison(input, runEvents, controller.signal)).rejects.toBe(abort);
    expect(fetch).not.toHaveBeenCalled();
    expect(runEvents.failed).not.toHaveBeenCalled();
    expect(runEvents.succeeded).not.toHaveBeenCalled();
  });

  it("settles an internally timed out country with the established navigation timeout", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    const run = runComparison(
      { ...input, countries: ["us", "gb"] },
      runEvents,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(45_000);
    await run;

    expect(runEvents.failed.mock.calls).toEqual([
      ["us", expect.objectContaining({ code: "NAVIGATION_TIMEOUT", retryable: true })],
      ["gb", expect.objectContaining({ code: "NAVIGATION_TIMEOUT", retryable: true })],
    ]);
  });

  it("bounds body parsing with the same navigation timeout after headers resolve", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new ReadableStream<Uint8Array>({ start: () => undefined })),
      )
      .mockResolvedValueOnce(response(sampleCaptureByCountry.gb));
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    const run = runComparison(
      { ...input, countries: ["us", "gb"] },
      runEvents,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(45_000);
    await run;

    expect(runEvents.failed.mock.calls).toEqual([
      ["us", expect.objectContaining({ code: "NAVIGATION_TIMEOUT" })],
    ]);
    expect(runEvents.succeeded).toHaveBeenCalledWith(
      "gb",
      liveCapture(sampleCaptureByCountry.gb),
    );
  });

  it.each([
    ["duplicate countries", ["us", "us"]],
    ["fewer than two countries", ["us"]],
    [
      "more than fifteen countries",
      [
        "au", "br", "ca", "de", "es", "fr", "gb", "in",
        "it", "jp", "kr", "mx", "nl", "sg", "us", "us",
      ],
    ],
    ["unsupported country", ["us", "zz"]],
  ])("rejects %s before starting any request", async (_case, countries) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const runEvents = events();

    await expect(
      runComparison(
        { ...input, countries: countries as AuditFormValue["countries"] },
        runEvents,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Select 2 to 15 unique supported countries.");

    expect(fetch).not.toHaveBeenCalled();
    expect(runEvents.started).not.toHaveBeenCalled();
    expect(runEvents.succeeded).not.toHaveBeenCalled();
    expect(runEvents.failed).not.toHaveBeenCalled();
  });

  it("settles other countries then propagates a terminal callback exception once", async () => {
    const callbackError = new Error("render failure");
    const succeeded = vi.fn((country: string) => {
      if (country === "us") throw callbackError;
    });
    const runEvents = {
      batchStarted: vi.fn(),
      failed: vi.fn(),
      started: vi.fn(),
      succeeded,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(sampleCaptureByCountry.us))
        .mockResolvedValueOnce(response(sampleCaptureByCountry.gb)),
    );

    await expect(
      runComparison(
        { ...input, countries: ["us", "gb"] },
        runEvents,
        new AbortController().signal,
      ),
    ).rejects.toBe(callbackError);

    expect(succeeded).toHaveBeenCalledTimes(2);
    expect(runEvents.failed).not.toHaveBeenCalled();
  });
});
