import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditFormValue } from "@/src/components/audit-form";
import type { CaptureResponse } from "@/src/features/capture/contracts";
import {
  runComparison,
  runCountryCapture,
} from "@/src/features/run/run-comparison";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const input: AuditFormValue = {
  url: " https://regional.example.test/pricing ",
  countries: ["us", "gb", "de"],
};

function response(body: CaptureResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function events() {
  return {
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
        }),
      }),
    );
    expect(runEvents.started).toHaveBeenCalledWith("gb");
    expect(runEvents.succeeded).toHaveBeenCalledWith(
      "gb",
      sampleCaptureByCountry.gb,
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
        body: JSON.stringify({ country: "us", url: "https://regional.example.test/pricing" }),
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

    expect(runEvents.succeeded).toHaveBeenCalledWith("us", sampleCaptureByCountry.us);
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
    expect(fetch).toHaveBeenCalledTimes(3);
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
    expect(runEvents.succeeded).toHaveBeenCalledWith("gb", sampleCaptureByCountry.gb);
  });

  it.each([
    ["duplicate countries", ["us", "us"]],
    ["fewer than two countries", ["us"]],
    ["more than three countries", ["us", "gb", "de", "fr"]],
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
    ).rejects.toThrow("Select exactly 2 or 3 unique supported countries.");

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
    const runEvents = { failed: vi.fn(), started: vi.fn(), succeeded };
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
