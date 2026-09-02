import { describe, expect, it, vi } from "vitest";

import type { AuditFormValue } from "@/src/components/audit-form";
import {
  runComparison,
  validateSelectedCountries,
} from "@/src/features/run/run-comparison";

describe("capture resource boundaries", () => {
  it.each([
    ["two countries", ["us", "gb"]],
    ["three countries", ["us", "gb", "de"]],
  ] as const)("accepts %s", (_case, countries) => {
    expect(
      validateSelectedCountries({
        url: "https://example.com/",
        countries: [...countries],
      }),
    ).toEqual(countries);
  });

  it.each([
    ["one country", ["us"]],
    ["four countries", ["us", "gb", "de", "fr"]],
  ] as const)("rejects %s", (_case, countries) => {
    expect(() =>
      validateSelectedCountries({
        url: "https://example.com/",
        countries: [...countries] as AuditFormValue["countries"],
      }),
    ).toThrow("Select exactly 2 or 3 unique supported countries.");
  });

  it("rejects a response one byte above 3 MB before the navigation timeout", async () => {
    vi.useFakeTimers();
    try {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(3_000_001));
        },
      });
      const fetch = vi.fn().mockResolvedValue(
        new Response(stream, { headers: { "Content-Type": "application/json" } }),
      );
      vi.stubGlobal("fetch", fetch);
      const events = { failed: vi.fn(), started: vi.fn(), succeeded: vi.fn() };

      const run = runComparison(
        { url: "https://example.com/", countries: ["us", "gb"] },
        events,
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(45_000);
      await run;

      expect(events.failed).toHaveBeenCalledWith(
        "us",
        expect.objectContaining({ code: "CAPTURE_FAILED" }),
      );
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
