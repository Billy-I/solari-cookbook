import { NextRequest, NextResponse } from "next/server";

import { captureRegion } from "@/src/features/capture/capture-region";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";
import {
  captureRequestSchema,
  SUPPORTED_COUNTRIES,
  type CaptureFailure,
  type SafeCaptureErrorCode,
} from "@/src/features/capture/contracts";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";
import {
  deleteRunSessionsForOwner,
  registerRunSession,
} from "@/src/features/capture/run-session-registry";
import { credentialSessionStore } from "@/src/features/credential/credential-session-store";
import {
  clearSessionCookie,
  readSessionToken,
} from "@/src/features/credential/session-cookie";
import {
  assertAppRequest,
  isSecureApplicationRequest,
} from "@/src/features/credential/request-security";
import { createSolariClient } from "@/src/lib/solari";
import { logServerEvent } from "@/src/lib/server-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };
const allowedMethodHeaders = {
  ...noStoreHeaders,
  Allow: "POST, OPTIONS",
};
class BodyTooLargeError extends Error {}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new Error("invalid length");
    if (BigInt(contentLength) > BigInt(CAPTURE_LIMITS.requestBytes)) {
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
      if (byteLength > CAPTURE_LIMITS.requestBytes) {
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

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function failure(code: SafeCaptureErrorCode, status: number): Response {
  return json(toSafeCaptureFailure(new Error(code)), status);
}

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: allowedMethodHeaders });
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: allowedMethodHeaders });
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
    case "SOLARI_LAUNCH":
    case "NAVIGATION_FAILED":
    case "EXTRACTION_FAILED":
    case "CAPTURE_FAILED":
      return 502;
  }
}

function invalidateCredential(
  request: NextRequest,
  ownerId: string,
  response: NextResponse,
): void {
  const token = readSessionToken(request);
  if (token) credentialSessionStore.delete(token);
  deleteRunSessionsForOwner(ownerId);
  clearSessionCookie(response, isSecureApplicationRequest(request));
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertAppRequest(request, { requireJson: true, requireOrigin: true });
  } catch {
    return failure("INVALID_INPUT", 400);
  }
  if (!isSecureApplicationRequest(request)) {
    return failure("INVALID_INPUT", 400);
  }

  if (process.env.SOLARI_CAPTURE_DISABLED === "true") {
    return failure("CAPTURE_FAILED", 403);
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

  const token = readSessionToken(request);
  const credential = token ? credentialSessionStore.resolve(token) : null;
  if (!credential) return failure("SOLARI_AUTH", 503);

  try {
    const requestId = crypto.randomUUID();
    const result = await captureRegion(parsedRequest.data, {
      createClient: () => createSolariClient(credential.apiKey),
      now: () => new Date(),
      requestId,
      log: (event) => logServerEvent(event),
      registerSession(input) {
        const correlation = registerRunSession({
          ownerId: credential.ownerId,
          ...input,
        });
        logServerEvent({
          category: "session_registered",
          requestId,
          ...correlation,
        });
        return correlation;
      },
    });
    const response = json(
      result,
      result.ok ? 200 : failureStatus(result.error.code),
    );
    if (!result.ok && result.error.code === "SOLARI_AUTH") {
      invalidateCredential(request, credential.ownerId, response);
    }
    return response;
  } catch (error) {
    const result = toSafeCaptureFailure(error);
    const response = json(result, failureStatus(result.error.code));
    if (result.error.code === "SOLARI_AUTH") {
      invalidateCredential(request, credential.ownerId, response);
    }
    return response;
  }
}
