import { NextRequest, NextResponse } from "next/server";

import { createSolariClient } from "@/src/lib/solari";
import { logServerEvent } from "@/src/lib/server-observability";
import {
  captureCorrelationSchema,
} from "@/src/features/capture/contracts";
import {
  deleteRunSessionsForOwner,
  lookupRunSession,
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const replayIdPattern = /^sol_[0-9a-f]{20}$/;
const maxReplayUrlLength = 4_096;
const noStoreHeaders = { "Cache-Control": "no-store" };
const allowedMethodHeaders = {
  ...noStoreHeaders,
  Allow: "GET, OPTIONS",
};

type ReplayContext = {
  params: Promise<{ id: string }>;
};

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: allowedMethodHeaders });
}

export const POST = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: allowedMethodHeaders });
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  return typeof error.status === "number" ? error.status : undefined;
}

export async function GET(
  request: NextRequest,
  context: ReplayContext,
): Promise<Response> {
  try {
    assertAppRequest(request, { requireOrigin: false });
  } catch {
    return json({ status: "unavailable" }, 400);
  }
  if (!isSecureApplicationRequest(request)) {
    return json({ status: "unavailable" }, 400);
  }

  if (process.env.SOLARI_CAPTURE_DISABLED === "true") {
    return json({ status: "unavailable" }, 403);
  }

  const { id } = await context.params;
  if (!replayIdPattern.test(id)) {
    return json({ status: "unavailable" }, 400);
  }

  const requestUrl = new URL(request.url);
  const attempt = requestUrl.searchParams.get("attempt");
  const parsedCorrelation = captureCorrelationSchema.safeParse({
    runId: requestUrl.searchParams.get("runId"),
    country: requestUrl.searchParams.get("country"),
    attempt: attempt !== null && /^\d+$/.test(attempt) ? Number(attempt) : null,
    sessionRef: id,
  });
  if (!parsedCorrelation.success) {
    return json({ status: "unavailable" }, 400);
  }

  const token = readSessionToken(request);
  const credential = token ? credentialSessionStore.resolve(token) : null;
  if (!credential) return json({ status: "unavailable" }, 503);

  const providerSessionId = lookupRunSession(
    credential.ownerId,
    parsedCorrelation.data,
  );
  if (!providerSessionId) {
    return json({ status: "unavailable" }, 404);
  }

  let client: ReturnType<typeof createSolariClient> | undefined;
  const requestId = crypto.randomUUID();
  let response: Response;
  let cleanupFailed = false;
  let authenticationFailed = false;
  try {
    try {
      client = createSolariClient(credential.apiKey);
      const replay = await client.sessions.getReplayUrl(providerSessionId);
      if (
        typeof replay.url !== "string" ||
        replay.url.length > maxReplayUrlLength
      ) {
        throw new Error("invalid replay URL");
      }
      const replayUrl = new URL(replay.url);

      if (
        replayUrl.protocol !== "https:" ||
        replayUrl.username ||
        replayUrl.password ||
        replayUrl.hash ||
        (replayUrl.port && replayUrl.port !== "443")
      ) {
        response = json({ status: "unavailable" }, 502);
      } else {
        response = json({ status: "ready", replayUrl: replayUrl.href }, 200);
      }
    } catch (error) {
      const status = errorStatus(error);
      if (status === 404) {
        response = json({ status: "pending" }, 202);
      } else if (status === 401 || status === 403) {
        authenticationFailed = true;
        response = json({ status: "unavailable" }, 503);
      } else {
        response = json({ status: "unavailable" }, 502);
      }
    }
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        cleanupFailed = true;
        logServerEvent({
          category: "replay_client_cleanup_failed",
          requestId,
        });
      }
    }
  }

  if (cleanupFailed && response.status < 400) {
    return json({ status: "unavailable" }, 502);
  }

  if (authenticationFailed) {
    if (token) credentialSessionStore.delete(token);
    deleteRunSessionsForOwner(credential.ownerId);
    clearSessionCookie(
      response as NextResponse,
      isSecureApplicationRequest(request),
    );
  }

  return response;
}
