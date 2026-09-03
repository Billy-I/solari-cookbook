import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deleteRunSessionsForOwner } from "@/src/features/capture/run-session-registry";
import { credentialSessionStore } from "@/src/features/credential/credential-session-store";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "@/src/features/credential/session-cookie";
import {
  assertAppRequest,
  isSecureApplicationRequest,
} from "@/src/features/credential/request-security";
import { createSolariClient } from "@/src/lib/solari";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONNECT_BODY_BYTES = 1_024;
const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};
const allowedMethodHeaders = {
  ...noStoreHeaders,
  Allow: "GET, POST, DELETE, OPTIONS",
};
const connectSchema = z
  .object({ apiKey: z.string().min(1).max(512) })
  .strict();

class BodyTooLargeError extends Error {}

type FailureStatus = "authentication_failed" | "authentication_unavailable";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function clearResponse(
  request: NextRequest,
  body: unknown,
  status: number,
): NextResponse {
  const response = json(body, status);
  clearSessionCookie(response, isSecureApplicationRequest(request));
  return response;
}

function failure(
  request: NextRequest,
  status: FailureStatus,
  responseStatus: number,
): NextResponse {
  const message =
    status === "authentication_failed"
      ? "Solari could not authenticate that key."
      : "Solari authentication is temporarily unavailable.";
  return clearResponse(request, { status, message }, responseStatus);
}

function invalidatePriorSession(request: NextRequest): void {
  const token = readSessionToken(request);
  if (!token) return;
  const ownerId = credentialSessionStore.delete(token);
  if (ownerId) deleteRunSessionsForOwner(ownerId);
}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new Error("INVALID_BODY");
    if (BigInt(contentLength) > BigInt(MAX_CONNECT_BODY_BYTES)) {
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
      if (byteLength > MAX_CONNECT_BODY_BYTES) {
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

function guardRequest(
  request: NextRequest,
  options: { requireJson?: boolean; requireOrigin: boolean },
): NextResponse | null {
  try {
    assertAppRequest(request, options);
  } catch {
    return json(
      {
        status: "authentication_unavailable",
        message: "The credential request was rejected.",
      },
      400,
    );
  }

  if (!isSecureApplicationRequest(request)) {
    return json(
      {
        status: "authentication_unavailable",
        message: "A secure connection is required.",
      },
      400,
    );
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rejected = guardRequest(request, { requireOrigin: false });
  if (rejected) return rejected;

  const token = readSessionToken(request);
  if (token && credentialSessionStore.resolve(token)) {
    return json({ status: "ready" });
  }

  const response = json({ status: "missing" });
  if (token) {
    clearSessionCookie(response, isSecureApplicationRequest(request));
  }
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = guardRequest(request, {
    requireJson: true,
    requireOrigin: true,
  });
  if (rejected) return rejected;

  let rawBody: string;
  try {
    rawBody = await readBoundedBody(request);
  } catch (error) {
    const status = error instanceof BodyTooLargeError ? 413 : 400;
    return json(
      {
        status: "authentication_unavailable",
        message: "The credential request was invalid.",
      },
      status,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return json(
      {
        status: "authentication_unavailable",
        message: "The credential request was invalid.",
      },
      400,
    );
  }
  const parsed = connectSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return json(
      {
        status: "authentication_unavailable",
        message: "The credential request was invalid.",
      },
      400,
    );
  }

  const client = createSolariClient(parsed.data.apiKey);
  try {
    const providerResponse = await client.request("GET", "/profiles");
    await providerResponse.body?.cancel().catch(() => undefined);

    if (providerResponse.status === 401 || providerResponse.status === 403) {
      invalidatePriorSession(request);
      return failure(request, "authentication_failed", 401);
    }
    if (providerResponse.status < 200 || providerResponse.status >= 300) {
      invalidatePriorSession(request);
      return failure(request, "authentication_unavailable", 503);
    }

    invalidatePriorSession(request);
    const created = credentialSessionStore.create(parsed.data.apiKey);
    if (!created) {
      return failure(request, "authentication_unavailable", 503);
    }

    const response = json({ status: "ready" });
    setSessionCookie(
      response,
      created.token,
      isSecureApplicationRequest(request),
    );
    return response;
  } catch {
    invalidatePriorSession(request);
    return failure(request, "authentication_unavailable", 503);
  } finally {
    await client.close();
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const rejected = guardRequest(request, { requireOrigin: true });
  if (rejected) return rejected;

  invalidatePriorSession(request);
  const response = new NextResponse(null, {
    status: 204,
    headers: noStoreHeaders,
  });
  clearSessionCookie(response, isSecureApplicationRequest(request));
  return response;
}

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, { status: 405, headers: allowedMethodHeaders });
}

export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: allowedMethodHeaders });
}
