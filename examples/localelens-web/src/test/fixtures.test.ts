import { describe, expect, it } from "vitest";

import {
  captureResponseSchema,
  reportSchema,
} from "@/src/features/capture/contracts";
import {
  sampleCaptureByCountry,
  sampleReport,
} from "@/src/test/fixtures";

describe("redacted regional fixtures", () => {
  it("conforms to the report contract", () => {
    expect(reportSchema.parse(sampleReport)).toEqual(sampleReport);
  });

  it("provides deterministic US, UK, and Germany captures", () => {
    expect(Object.keys(sampleCaptureByCountry)).toEqual(["us", "gb", "de"]);

    for (const capture of Object.values(sampleCaptureByCountry)) {
      expect(captureResponseSchema.parse(capture)).toEqual(capture);
    }
  });

  it("contains no provider secrets or session-control material", () => {
    expect(JSON.stringify(sampleReport)).not.toMatch(
      /slr_live_|apiKey|sessionId|replayUrl/i,
    );
  });
});
