import { captureRegion } from "@/src/features/capture/capture-region";
import {
  captureRequestSchema,
  SUPPORTED_COUNTRIES,
  type CaptureFailure,
  type SafeCaptureErrorCode,
} from "@/src/features/capture/contracts";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";
import { createSolariClient } from "@/src/lib/solari";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function failure(code: SafeCaptureErrorCode, status: number): Response {
  return json(toSafeCaptureFailure(new Error(code)), status);
}

function failureStatus(code: CaptureFailure["error"]["code"]): number {
  switch (code) {
    case "INVALID_INPUT":
    case "UNSUPPORTED_COUNTRY":
    case "PRIVATE_TARGET_BLOCKED":
      return 400;
    case "NAVIGATION_TIMEOUT":
      return 504;
    case "SOLARI_CAPACITY":
    case "SOLARI_AUTH":
      return 503;
    case "TARGET_BLOCKED":
    case "SOLARI_PROXY_MISMATCH":
    case "CAPTURE_FAILED":
      return 502;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.LIVE_CAPTURE_ENABLED !== "true") {
    return failure("CAPTURE_FAILED", 403);
  }

  if (!process.env.SOLARI_API_KEY?.trim()) {
    return failure("SOLARI_AUTH", 503);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return failure("INVALID_INPUT", 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > 2_048) {
    return failure("INVALID_INPUT", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return failure("INVALID_INPUT", 400);
  }

  const parsedRequest = captureRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    const country =
      typeof body === "object" && body !== null && "country" in body
        ? body.country
        : undefined;
    const code =
      typeof country === "string" &&
      !SUPPORTED_COUNTRIES.includes(
        country as (typeof SUPPORTED_COUNTRIES)[number],
      )
        ? "UNSUPPORTED_COUNTRY"
        : "INVALID_INPUT";
    return failure(code, 400);
  }

  try {
    const result = await captureRegion(parsedRequest.data, {
      createClient: createSolariClient,
      now: () => new Date(),
    });
    return json(result, result.ok ? 200 : failureStatus(result.error.code));
  } catch (error) {
    const result = toSafeCaptureFailure(error);
    return json(result, failureStatus(result.error.code));
  }
}
