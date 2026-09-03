import { describe, expect, it, vi } from "vitest";

import {
  compareEvidence,
  type ComparisonCapture,
} from "@/src/features/compare/compare-evidence";
import type {
  CaptureResponse,
  PageEvidence,
} from "@/src/features/capture/contracts";

function evidence(overrides: Partial<PageEvidence> = {}): PageEvidence {
  return {
    requestedUrl: "https://example.com/pricing",
    finalUrl: "https://example.com/pricing",
    title: "Regional plans",
    documentLanguage: "en-GB",
    primaryHeading: "Choose a plan",
    primaryAction: "Start now",
    ctas: ["Start now"],
    currencies: ["GBP"],
    priceSnippets: ["GBP 24 per month"],
    consentText: "Cookie choices",
    httpStatus: 200,
    capturedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function success(overrides: Partial<PageEvidence> = {}): CaptureResponse {
  return {
    ok: true,
    evidence: evidence(overrides),
    receipt: {
      runId: "llr_123e4567-e89b-42d3-a456-426614174000",
      country: "gb",
      attempt: 1,
      sessionRef: null,
      proxyCountry: "gb",
      proxyTier: "residential",
      timezoneId: "Europe/London",
      recordingRequested: true,
    },
    screenshot: {
      mediaType: "image/jpeg",
      base64: "c3ludGhldGlj",
      width: 1280,
    },
  };
}

function failed(): CaptureResponse {
  return {
    ok: false,
    correlation: null,
    error: {
      code: "CAPTURE_FAILED",
      message: "Capture failed safely",
      retryable: false,
    },
  };
}

describe("compareEvidence", () => {
  it("returns stable field order and normalizes whitespace only for equality", () => {
    const captures: ComparisonCapture[] = [
      {
        country: "gb",
        response: success({
          title: "  Regional   plans  ",
          primaryHeading: "  Choose\n a plan ",
        }),
      },
      {
        country: "us",
        response: success({
          title: "Regional plans",
          primaryHeading: "Choose a plan",
        }),
      },
    ];

    expect(compareEvidence(captures)).toMatchObject([
      { field: "final_url", kind: "same" },
      {
        field: "title",
        kind: "same",
        values: { gb: "  Regional   plans  ", us: "Regional plans" },
      },
      { field: "language", kind: "same" },
      { field: "currency", kind: "same" },
      { field: "price", kind: "same" },
      {
        field: "heading",
        kind: "same",
        values: { gb: "  Choose\n a plan ", us: "Choose a plan" },
      },
      { field: "primary_action", kind: "same" },
      { field: "consent", kind: "same" },
    ]);
  });

  it("compares language and currency case-insensitively while preserving price text", () => {
    const rows = compareEvidence([
      {
        country: "us",
        response: success({
          documentLanguage: "EN-gb",
          currencies: ["gbp"],
          priceSnippets: ["GBP 24 per month"],
        }),
      },
      {
        country: "gb",
        response: success({
          documentLanguage: "en-GB",
          currencies: ["GBP"],
          priceSnippets: ["GBP 24 per Month"],
        }),
      },
    ]);

    expect(rows.find((row) => row.field === "language")).toMatchObject({
      kind: "same",
    });
    expect(rows.find((row) => row.field === "currency")).toMatchObject({
      kind: "same",
    });
    expect(rows.find((row) => row.field === "price")).toEqual({
      field: "price",
      kind: "different",
      values: { us: "GBP 24 per month", gb: "GBP 24 per Month" },
    });
  });

  it("uses locale-invariant lowercasing for language and currency equality", () => {
    const localeLowercase = vi
      .spyOn(String.prototype, "toLocaleLowerCase")
      .mockImplementation(() => {
        throw new Error("locale-sensitive lowering must not be used");
      });

    try {
      const rows = compareEvidence([
        {
          country: "us",
          response: success({ documentLanguage: "EN-gb", currencies: ["gbp"] }),
        },
        {
          country: "gb",
          response: success({ documentLanguage: "en-GB", currencies: ["GBP"] }),
        },
      ]);

      expect(rows.find((row) => row.field === "language")).toMatchObject({
        kind: "same",
      });
      expect(rows.find((row) => row.field === "currency")).toMatchObject({
        kind: "same",
      });
    } finally {
      localeLowercase.mockRestore();
    }
  });

  it("marks successful empty evidence as missing", () => {
    const rows = compareEvidence([
      { country: "us", response: success({ title: null }) },
      { country: "gb", response: success() },
    ]);

    expect(rows.find((row) => row.field === "title")).toEqual({
      field: "title",
      kind: "missing",
      values: { gb: "Regional plans" },
    });
  });

  it("preserves comparisons between two successes when a sibling fails", () => {
    const rows = compareEvidence([
      {
        country: "us",
        response: success({ title: "US plans", documentLanguage: "en" }),
      },
      {
        country: "gb",
        response: success({ title: "GB plans", documentLanguage: "en" }),
      },
      { country: "de", response: failed() },
    ]);

    expect(rows.find(({ field }) => field === "title")).toEqual({
      field: "title",
      kind: "different",
      values: { gb: "GB plans", us: "US plans" },
    });
    expect(rows.find(({ field }) => field === "language")?.kind).toBe("same");
  });

  it("marks every row unavailable with fewer than two successful captures", () => {
    const rows = compareEvidence([
      { country: "us", response: success() },
      { country: "gb", response: failed() },
    ]);

    expect(rows).toHaveLength(8);
    expect(rows.every(({ kind }) => kind === "unavailable")).toBe(true);
  });

  it("does not change results when captures arrive in a different order", () => {
    const us = {
      country: "us" as const,
      response: success({ title: "<img src=x onerror=alert(1)> US" }),
    };
    const gb = {
      country: "gb" as const,
      response: success({ title: "<img src=x onerror=alert(1)> GB" }),
    };

    expect(compareEvidence([us, gb])).toEqual(compareEvidence([gb, us]));
    expect(compareEvidence([us, gb]).find((row) => row.field === "title")).toEqual({
      field: "title",
      kind: "different",
      values: {
        gb: "<img src=x onerror=alert(1)> GB",
        us: "<img src=x onerror=alert(1)> US",
      },
    });
  });

  it("is independent of all three-country input permutations", () => {
    const us = { country: "us" as const, response: success({ title: "US plans" }) };
    const gb = { country: "gb" as const, response: success({ title: "GB plans" }) };
    const de = { country: "de" as const, response: success({ title: "DE plans" }) };
    const expected = compareEvidence([us, gb, de]);

    for (const captures of [
      [us, de, gb],
      [gb, us, de],
      [gb, de, us],
      [de, us, gb],
      [de, gb, us],
    ]) {
      expect(compareEvidence(captures)).toEqual(expected);
    }
  });
});
