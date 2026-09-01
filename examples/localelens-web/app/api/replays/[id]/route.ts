import { createSolariClient } from "@/src/lib/solari";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const replayIdPattern = /^[A-Za-z0-9_.:-]{6,500}$/;
const noStoreHeaders = { "Cache-Control": "no-store" };

type ReplayContext = {
  params: Promise<{ id: string }>;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  return typeof error.status === "number" ? error.status : undefined;
}

export async function GET(
  _request: Request,
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

  let client: ReturnType<typeof createSolariClient> | undefined;
  try {
    client = createSolariClient();
    const replay = await client.sessions.getReplayUrl(id);
    const replayUrl = new URL(replay.url);

    if (
      replayUrl.protocol !== "https:" ||
      replayUrl.username ||
      replayUrl.password ||
      replayUrl.hash ||
      (replayUrl.port && replayUrl.port !== "443")
    ) {
      return json({ status: "unavailable" }, 502);
    }

    return json({ status: "ready", replayUrl: replayUrl.href }, 200);
  } catch (error) {
    if (errorStatus(error) === 404) {
      return json({ status: "pending" }, 202);
    }

    return json({ status: "unavailable" }, 502);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Cleanup errors never replace the replay lookup result.
      }
    }
  }
}
