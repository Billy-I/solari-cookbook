import { z } from "zod";

import { SUPPORTED_COUNTRIES, type SupportedCountry } from "./countries";
import { SAFE_CAPTURE_ERROR_CODES } from "./error-codes";
import { CAPTURE_LIMITS } from "./limits";
import { appRunIdSchema } from "./run-id";

export { SUPPORTED_COUNTRIES, type SupportedCountry } from "./countries";
export {
  SAFE_CAPTURE_ERROR_CODES,
  type SafeCaptureErrorCode,
} from "./error-codes";
export { appRunIdSchema, type AppRunId } from "./run-id";

const supportedCountrySchema = z.enum(SUPPORTED_COUNTRIES);

const httpsUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use HTTPS",
  });

export const captureRequestSchema = z
  .object({
    url: httpsUrlSchema,
    country: supportedCountrySchema,
    runId: appRunIdSchema,
    attempt: z.number().int().min(1).max(99),
  })
  .strict();

export const pageEvidenceSchema = z
  .object({
    requestedUrl: httpsUrlSchema,
    finalUrl: httpsUrlSchema,
    title: z.string().max(200).nullable(),
    documentLanguage: z.string().max(35).nullable(),
    primaryHeading: z.string().max(240).nullable(),
    primaryAction: z.string().max(120).nullable(),
    ctas: z.array(z.string().max(120)).max(20),
    currencies: z.array(z.string().max(20)).max(12),
    priceSnippets: z.array(z.string().max(160)).max(8),
    consentText: z.string().max(500).nullable(),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    capturedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const sessionRefSchema = z.string().regex(/^sol_[0-9a-f]{20}$/);

export const captureCorrelationSchema = z
  .object({
    runId: appRunIdSchema,
    country: supportedCountrySchema,
    attempt: z.number().int().min(1).max(99),
    sessionRef: sessionRefSchema,
  })
  .strict();

const captureReceiptSchema = z
  .object({
    runId: appRunIdSchema,
    country: supportedCountrySchema,
    attempt: z.number().int().min(1).max(99),
    sessionRef: sessionRefSchema.nullable(),
    proxyCountry: supportedCountrySchema,
    proxyTier: z.literal("residential"),
    timezoneId: z.string().max(100).nullable(),
    recordingRequested: z.literal(true),
  })
  .strict();

const screenshotSchema = z
  .object({
    mediaType: z.literal("image/jpeg"),
    base64: z.string().min(1).max(2_000_000),
    width: z.number().int().positive().max(4096),
  })
  .strict();

const captureSuccessSchema = z
  .object({
    ok: z.literal(true),
    evidence: pageEvidenceSchema,
    receipt: captureReceiptSchema,
    screenshot: screenshotSchema,
  })
  .strict();

const captureFailureSchema = z
  .object({
    ok: z.literal(false),
    correlation: captureCorrelationSchema.nullable(),
    error: z
      .object({
        code: z.enum(SAFE_CAPTURE_ERROR_CODES),
        message: z.string().min(1).max(240),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const captureResponseSchema = z
  .discriminatedUnion("ok", [captureSuccessSchema, captureFailureSchema])
  .superRefine((response, context) => {
    if (
      response.ok &&
      response.receipt.country !== response.receipt.proxyCountry
    ) {
      context.addIssue({
        code: "custom",
        message: "Proxy country must match the requested country",
        path: ["receipt", "proxyCountry"],
      });
    }
  });

export const CAPTURE_STAGES = [
  "queued",
  "launching",
  "navigating",
  "extracting",
  "closing",
  "complete",
  "failed",
] as const;

const reportResultSchema = z
  .object({
    country: supportedCountrySchema,
    evidence: pageEvidenceSchema,
  })
  .strict();

export const reportSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.enum(["complete", "partial"]),
    mode: z.enum(["sample", "live"]),
    requestedUrl: httpsUrlSchema,
    countries: z
      .array(supportedCountrySchema)
      .min(2)
      .max(CAPTURE_LIMITS.maxSelectedCountries),
    results: z
      .array(reportResultSchema)
      .min(1)
      .max(CAPTURE_LIMITS.maxSelectedCountries),
    generatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type CaptureRequest = z.infer<typeof captureRequestSchema>;
export type CaptureCorrelation = z.infer<typeof captureCorrelationSchema>;
export type PageEvidence = z.infer<typeof pageEvidenceSchema>;
export type CaptureReceipt = z.infer<typeof captureReceiptSchema>;
export type CaptureSuccess = z.infer<typeof captureSuccessSchema>;
export type CaptureFailure = z.infer<typeof captureFailureSchema>;
export type CaptureResponse = z.infer<typeof captureResponseSchema>;
export type ComparisonCapture = {
  country: SupportedCountry;
  response: CaptureResponse;
};
export type CaptureStage = (typeof CAPTURE_STAGES)[number];
export type ReportResult = z.infer<typeof reportResultSchema>;
export type Report = z.infer<typeof reportSchema>;
