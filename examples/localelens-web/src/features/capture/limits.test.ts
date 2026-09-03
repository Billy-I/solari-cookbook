import { describe, expect, it, vi } from "vitest";

import { CAPTURE_LIMITS } from "@/src/features/capture/limits";
import { runComparison } from "@/src/features/run/run-comparison";

describe("capture resource boundaries", () => {
  it("separates total market selection from provider concurrency", () => {
    expect(CAPTURE_LIMITS.maxSelectedCountries).toBe(15);
    expect(CAPTURE_LIMITS.maxConcurrentCaptures).toBe(3);
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
      const events = {
        batchStarted: vi.fn(),
        failed: vi.fn(),
        started: vi.fn(),
        succeeded: vi.fn(),
      };

      const run = runComparison(
        { url: "https://example.com/", countries: ["us", "gb"] },
        {
          runId: "llr_123e4567-e89b-42d3-a456-426614174000",
          attempt: 1,
        },
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
