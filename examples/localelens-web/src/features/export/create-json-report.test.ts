import { describe, expect, it } from "vitest";

import {
  createJsonReport,
  type JsonReportInput,
} from "@/src/features/export/create-json-report";
import type { RegionRunState } from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const generatedAt = "2026-09-02T08:09:10.000Z";

function successfulRegion(
  country: "us" | "de",
  additions: Record<string, unknown> = {},
): RegionRunState {
  return {
    country,
    response: {
      ...sampleCaptureByCountry[country],
      ...additions,
      evidence: {
        ...sampleCaptureByCountry[country].evidence,
        finalUrl: `https://user:password@regional.example.test/${country}/pricing?token=temporary#offer`,
      },
    },
    stage: "complete",
  };
}

function partialInput(): JsonReportInput {
  return {
    generatedAt,
    mode: "live",
    regions: [
      successfulRegion("us", {
        apiKey: "SECRET-API-KEY",
        replayUrl: "https://replay.example.test/temporary-session",
      }),
      {
        country: "gb",
        response: {
          error: {
            code: "SOLARI_CAPACITY",
            message: "Regional capacity was unavailable.",
            retryable: true,
          },
          ok: false,
        },
        stage: "failed",
      },
      successfulRegion("de"),
    ],
    // The report must derive an honest outcome even if a caller supplies a stale status.
    status: "complete",
    target: "https://regional.example.test/pricing?apiKey=SECRET#fragment",
  };
}

describe("createJsonReport", () => {
  it("builds a deterministic partial report from allowlisted redacted evidence", () => {
    const output = createJsonReport(partialInput());
    const report = JSON.parse(output.json);

    expect(report).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        generatedAt,
        mode: "live",
        status: "partial",
        target: { hostname: "regional.example.test" },
        countries: ["de", "gb", "us"],
      }),
    );
    expect(report.results.map(({ country }: { country: string }) => country)).toEqual([
      "de",
      "us",
    ]);
    expect(report.failures).toEqual([
      {
        country: "gb",
        code: "SOLARI_CAPACITY",
        message: "Regional capacity was unavailable.",
        retryable: true,
      },
    ]);
    expect(report.comparisons.map(({ field }: { field: string }) => field)).toEqual([
      "final_url",
      "title",
      "language",
      "currency",
      "price",
      "heading",
      "primary_action",
      "consent",
    ]);
    expect(report.results[0]).toEqual(
      expect.objectContaining({
        country: "de",
        receipt: {
          proxyCountry: "de",
          proxyTier: "residential",
          timezoneId: "Europe/Berlin",
        },
      }),
    );
    expect(report.results[0].evidence.finalUrl).toBe(
      "https://regional.example.test/de/pricing",
    );
    expect(report.limitations).toEqual([
      "Public pages only.",
      "Captured evidence is observational and is not a compliance verdict.",
      "Screenshot payloads, session identifiers, replay links, query strings, and URL fragments are excluded.",
    ]);
    expect(output.filename).toBe(
      "localelens-regional-example-test-2026-09-02T08-09-10-000Z.json",
    );
    expect(output.byteLength).toBe(new TextEncoder().encode(output.json).byteLength);
    expect(output.byteLength).toBeLessThanOrEqual(256 * 1024);
    expect(output.json).not.toContain("synthetic-local-fixture");
    expect(output.json).not.toContain("c3ludGhldGlj");
    expect(output.json).not.toContain("SECRET");
    expect(output.json).not.toContain("password");
    expect(output.json).not.toContain("replay.example.test");
    expect(output.json).not.toContain("?token=");
    expect(output.json).not.toContain("#offer");
  });

  it("labels a report complete only when every selected region succeeded", () => {
    const input = partialInput();
    const report = JSON.parse(
      createJsonReport({
        ...input,
        regions: [successfulRegion("us"), successfulRegion("de")],
        status: "complete",
      }).json,
    );

    expect(report.status).toBe("complete");
    expect(report.failures).toEqual([]);
  });

  it("fails closed when UTF-8 JSON serialization exceeds 256 KiB", () => {
    const input = partialInput();
    const oversized = successfulRegion("us");
    if (!oversized.response?.ok) throw new Error("Expected a successful fixture.");
    oversized.response.evidence.title = "é".repeat(140_000);

    expect(() =>
      createJsonReport({ ...input, regions: [oversized, successfulRegion("de")] }),
    ).toThrow("Report exceeds the 256 KiB export limit.");
  });
});
