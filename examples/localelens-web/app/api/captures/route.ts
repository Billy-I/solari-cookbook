import { captureRegion } from "@/src/features/capture/capture-region";
import {
  captureRequestSchema,
  SUPPORTED_COUNTRIES,
  type CaptureFailure,
  type SafeCaptureErrorCode,
} from "@/src/features/capture/contracts";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";
import { createSolariClient } from "@/src/lib/solari";
import { logServerEvent } from "@/src/lib/server-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };
const maxBodyBytes = 2_048;

class BodyTooLargeError extends Error {}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new Error("invalid length");
    if (BigInt(contentLength) > BigInt(maxBodyBytes)) {
      await request.body?.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let value = "";

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      byteLength += next.value.byteLength;
      if (byteLength > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError();
      }
      value += decoder.decode(next.value, { stream: true });
    }
    return value + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

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
    rawBody = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return failure("INVALID_INPUT", 413);
    }
    return failure("INVALID_INPUT", 400);
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
      requestId: crypto.randomUUID(),
      log: ({ category, requestId }) => logServerEvent(category, requestId),
    });
    return json(result, result.ok ? 200 : failureStatus(result.error.code));
  } catch (error) {
    const result = toSafeCaptureFailure(error);
    return json(result, failureStatus(result.error.code));
  }
}
