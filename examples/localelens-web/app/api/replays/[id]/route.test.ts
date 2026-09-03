import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  client,
  createSolariClient,
  getReplayUrl,
  logServerEvent,
  lookupRunSession,
} = vi.hoisted(() => {
  const getReplayUrl = vi.fn();
  const client = {
    sessions: { getReplayUrl },
    close: vi.fn(),
  };
  return {
    client,
    createSolariClient: vi.fn(() => client),
    getReplayUrl,
    logServerEvent: vi.fn(),
    lookupRunSession: vi.fn(),
  };
});

vi.mock("@/src/lib/solari", () => ({ createSolariClient }));
vi.mock("@/src/lib/server-observability", () => ({ logServerEvent }));
vi.mock("@/src/features/capture/run-session-registry", () => ({
  lookupRunSession,
}));

import * as replayRoute from "@/app/api/replays/[id]/route";

const { GET } = replayRoute;

const originalLiveCaptureEnabled = process.env.LIVE_CAPTURE_ENABLED;
const originalApiKey = process.env.SOLARI_API_KEY;
const rawSessionId =
  "pool-7f3a:9d1c4e2a-55b1-4a7e-9a3f-2c8d1e6b0a44:org_4b91ac2f:1752652800000.signature_abc";
const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const sessionRef = "sol_dab46ee6c619545d0534";

function replayRequest(
  overrides: Partial<Record<"runId" | "country" | "attempt", string>> = {},
): Request {
  const query = new URLSearchParams({
    runId,
    country: "us",
    attempt: "1",
    ...overrides,
  });
  return new Request(`http://localhost/api/replays/${sessionRef}?${query}`);
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function expectNoStore(response: Response): Promise<unknown> {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.json();
}

beforeEach(() => {
  lookupRunSession.mockReturnValue(rawSessionId);
});

afterEach(() => {
  createSolariClient.mockClear();
  getReplayUrl.mockReset();
  client.close.mockReset();
  client.close.mockResolvedValue(undefined);
  logServerEvent.mockReset();
  lookupRunSession.mockReset();

  if (originalLiveCaptureEnabled === undefined) {
    delete process.env.LIVE_CAPTURE_ENABLED;
  } else {
    process.env.LIVE_CAPTURE_ENABLED = originalLiveCaptureEnabled;
  }

  if (originalApiKey === undefined) {
    delete process.env.SOLARI_API_KEY;
  } else {
    process.env.SOLARI_API_KEY = originalApiKey;
  }
});

describe("GET /api/replays/:id", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "returns a no-store 405 for unsupported %s requests",
    async (method) => {
      const handler = Reflect.get(replayRoute, method) as
        | ((request: Request) => Response | Promise<Response>)
        | undefined;

      expect(handler).toBeTypeOf("function");
      if (!handler) throw new Error(`Missing ${method} route handler.`);

      const response = await handler(
        new Request("http://localhost/api/replays/safe-session-id", {
          method,
        }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
      expect(await response.text()).toBe("");
    },
  );

  it("returns a no-store response to OPTIONS requests", async () => {
    const handler = Reflect.get(replayRoute, "OPTIONS") as
      | (() => Response | Promise<Response>)
      | undefined;

    expect(handler).toBeTypeOf("function");
    if (!handler) throw new Error("Missing OPTIONS route handler.");

    const response = await handler();

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
  });

  it("fails closed when live capture is disabled", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "false";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(403);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("rejects a missing server key", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    delete process.env.SOLARI_API_KEY;

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(503);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it.each([
    "short",
    "session/with/slash",
    "session?query",
    "session%2Fencoded",
    "session with spaces",
    "x".repeat(501),
  ])("rejects invalid replay ID %s", async (id) => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await GET(replayRequest(), routeContext(id));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("returns the provider's ambiguous replay 404 as pending", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockRejectedValue(Object.assign(new Error("not ready"), { status: 404 }));

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(202);
    expect(await expectNoStore(response)).toEqual({ status: "pending" });
    expect(getReplayUrl).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("returns only a validated temporary HTTPS replay URL", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockResolvedValue({
      url: "https://storage.getsolari.com/replay.ndjson.gz?signature=temporary",
      expiresInSeconds: 900,
      contentEncoding: "gzip",
    });

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(200);
    expect(await expectNoStore(response)).toEqual({
      status: "ready",
      replayUrl: "https://storage.getsolari.com/replay.ndjson.gz?signature=temporary",
    });
    expect(lookupRunSession).toHaveBeenCalledWith({
      runId,
      country: "us",
      attempt: 1,
      sessionRef,
    });
    expect(getReplayUrl).toHaveBeenCalledWith(rawSessionId);
    expect(getReplayUrl).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("rejects a non-HTTPS provider replay URL", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockResolvedValue({
      url: "http://storage.getsolari.com/replay",
      expiresInSeconds: 900,
      contentEncoding: "gzip",
    });

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(502);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it.each([
    { url: 42 },
    { url: `https://storage.getsolari.com/${"x".repeat(4_100)}` },
  ])("rejects an unbounded or non-string provider replay URL", async (replay) => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockResolvedValue(replay);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(502);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("fails closed and records only a safe category when replay cleanup fails", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockResolvedValue({
      url: "https://storage.getsolari.com/replay",
    });
    client.close.mockRejectedValueOnce(new Error("cleanup secret"));

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(502);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(logServerEvent).toHaveBeenCalledWith({
      category: "replay_client_cleanup_failed",
      requestId: expect.any(String),
    });
    expect(JSON.stringify(logServerEvent.mock.calls)).not.toContain("cleanup secret");
  });

  it("returns a stable unavailable state for provider failure", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    getReplayUrl.mockRejectedValue(
      Object.assign(new Error("slr_live_secret upstream body"), { status: 503 }),
    );

    const response = await GET(replayRequest(), routeContext(sessionRef));
    const body = await expectNoStore(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toMatch(/slr_live|upstream/);
    expect(client.close).toHaveBeenCalledOnce();
  });

  it.each([
    { runId: "llr_bad" },
    { country: "zz" },
    { attempt: "0" },
    { attempt: "not-a-number" },
  ])("rejects malformed safe correlation %# before provider work", async (query) => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await GET(replayRequest(query), routeContext(sessionRef));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(lookupRunSession).not.toHaveBeenCalled();
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("makes no provider call when safe correlation is absent", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    lookupRunSession.mockReturnValue(null);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(404);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(getReplayUrl).not.toHaveBeenCalled();
  });
});
