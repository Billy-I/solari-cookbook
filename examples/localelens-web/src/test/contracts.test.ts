import { describe, expect, it } from "vitest";

import {
  captureRequestSchema,
  captureResponseSchema,
  pageEvidenceSchema,
  reportSchema,
} from "@/src/features/capture/contracts";

const validEvidence = {
  requestedUrl: "https://example.com",
  finalUrl: "https://example.com/gb",
  title: "Synthetic regional pricing",
  documentLanguage: "en-GB",
  primaryHeading: "Plans for the United Kingdom",
  primaryAction: "Start synthetic trial",
  ctas: ["Start synthetic trial"],
  currencies: ["GBP"],
  priceSnippets: ["GBP 24 per month"],
  consentText: "Synthetic cookie preferences",
  httpStatus: 200,
  capturedAt: "2026-09-01T12:00:00.000Z",
};

const validReceipt = {
  country: "gb" as const,
  proxyCountry: "gb" as const,
  proxyTier: "residential" as const,
  timezoneId: "Europe/London",
  sessionId: "synthetic-test-session",
  recordingRequested: true as const,
};

const validScreenshot = {
  mediaType: "image/jpeg" as const,
  base64: "c3ludGhldGlj",
  width: 1280,
};

const validCapture = {
  ok: true as const,
  evidence: validEvidence,
  receipt: validReceipt,
  screenshot: validScreenshot,
};

describe("captureRequestSchema", () => {
  it("accepts a supported country and public HTTPS URL", () => {
    expect(
      captureRequestSchema.parse({
        url: "https://example.com",
        country: "gb",
      }),
    ).toEqual({
      url: "https://example.com",
      country: "gb",
    });
  });

  it("rejects unsupported countries", () => {
    expect(() =>
      captureRequestSchema.parse({
        url: "https://example.com",
        country: "xx",
      }),
    ).toThrow();
  });

  it("rejects non-HTTPS URLs", () => {
    expect(() =>
      captureRequestSchema.parse({
        url: "http://example.com",
        country: "gb",
      }),
    ).toThrow();
  });
});

describe("pageEvidenceSchema", () => {
  it("accepts evidence within the extraction bounds", () => {
    expect(pageEvidenceSchema.parse(validEvidence)).toEqual(validEvidence);
  });

  it("enforces bounded extracted arrays", () => {
    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        ctas: Array.from({ length: 21 }, (_, index) => `Action ${index}`),
      }),
    ).toThrow();

    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        currencies: Array.from(
          { length: 13 },
          (_, index) => `CUR${index}`,
        ),
      }),
    ).toThrow();

    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        priceSnippets: Array.from(
          { length: 9 },
          (_, index) => `Price ${index}`,
        ),
      }),
    ).toThrow();
  });

  it("enforces extracted string bounds", () => {
    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        ctas: ["x".repeat(121)],
      }),
    ).toThrow();

    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        priceSnippets: ["x".repeat(161)],
      }),
    ).toThrow();

    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        consentText: "x".repeat(501),
      }),
    ).toThrow();
  });

  it("requires ISO capture timestamps", () => {
    expect(() =>
      pageEvidenceSchema.parse({
        ...validEvidence,
        capturedAt: "1 September 2026",
      }),
    ).toThrow();
  });
});

describe("captureResponseSchema", () => {
  it("accepts a bounded successful capture", () => {
    expect(captureResponseSchema.parse(validCapture)).toEqual(validCapture);
  });

  it("requires a JPEG screenshot", () => {
    expect(() =>
      captureResponseSchema.parse({
        ...validCapture,
        screenshot: {
          ...validScreenshot,
          mediaType: "image/png",
        },
      }),
    ).toThrow();
  });

  it("accepts only allowlisted public error codes", () => {
    expect(() =>
      captureResponseSchema.parse({
        ok: false,
        error: {
          code: "UPSTREAM_RAW_ERROR",
          message: "Synthetic failure",
          retryable: false,
        },
      }),
    ).toThrow();
  });

  it("rejects a proxy country mismatch", () => {
    expect(() =>
      captureResponseSchema.parse({
        ...validCapture,
        receipt: {
          ...validReceipt,
          proxyCountry: "us",
        },
      }),
    ).toThrow();
  });

  it("rejects API-key fields", () => {
    expect(() =>
      captureResponseSchema.parse({
        ...validCapture,
        apiKey: "synthetic-secret",
      }),
    ).toThrow();
  });
});

describe("reportSchema", () => {
  it("accepts a bounded two-country sample report", () => {
    const report = {
      schemaVersion: 1,
      status: "complete",
      mode: "sample",
      requestedUrl: "https://example.com",
      countries: ["us", "gb"],
      captures: [
        {
          ...validCapture,
          evidence: {
            ...validEvidence,
            finalUrl: "https://example.com/us",
          },
          receipt: {
            ...validReceipt,
            country: "us",
            proxyCountry: "us",
            timezoneId: "America/New_York",
          },
        },
        validCapture,
      ],
      generatedAt: "2026-09-01T12:01:00.000Z",
    };

    expect(reportSchema.parse(report)).toEqual(report);
  });

  it("caps reports at three countries", () => {
    expect(() =>
      reportSchema.parse({
        schemaVersion: 1,
        status: "complete",
        mode: "sample",
        requestedUrl: "https://example.com",
        countries: ["us", "gb", "de", "fr"],
        captures: [validCapture],
        generatedAt: "2026-09-01T12:01:00.000Z",
      }),
    ).toThrow();
  });
});
