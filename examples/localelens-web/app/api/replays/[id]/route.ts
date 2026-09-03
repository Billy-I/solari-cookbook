import { createSolariClient } from "@/src/lib/solari";
import { logServerEvent } from "@/src/lib/server-observability";
import {
  captureCorrelationSchema,
} from "@/src/features/capture/contracts";
import { lookupRunSession } from "@/src/features/capture/run-session-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const replayIdPattern = /^sol_[0-9a-f]{20}$/;
const maxReplayUrlLength = 4_096;
const noStoreHeaders = { "Cache-Control": "no-store" };
const allowedMethodHeaders = {
  ...noStoreHeaders,
  Allow: "GET, HEAD, OPTIONS",
};

type ReplayContext = {
  params: Promise<{ id: string }>;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: allowedMethodHeaders });
}

export const POST = methodNotAllowed;
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
  request: Request,
  context: ReplayContext,
): Promise<Response> {
  if (process.env.LIVE_CAPTURE_ENABLED !== "true") {
    return json({ status: "unavailable" }, 403);
  }

  if (!process.env.SOLARI_API_KEY?.trim()) {
    return json({ status: "unavailable" }, 503);
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

  const providerSessionId = lookupRunSession(parsedCorrelation.data);
  if (!providerSessionId) {
    return json({ status: "unavailable" }, 404);
  }

  let client: ReturnType<typeof createSolariClient> | undefined;
  const requestId = crypto.randomUUID();
  let response: Response;
  let cleanupFailed = false;
  try {
    try {
      client = createSolariClient();
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
      if (errorStatus(error) === 404) {
        response = json({ status: "pending" }, 202);
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

  return response;
}
