import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  client,
  createSolariClient,
  deleteRunSessionsForOwner,
  getReplayUrl,
  logServerEvent,
  lookupRunSession,
  sessionsDelete,
  sessionsResolve,
} = vi.hoisted(() => {
  const getReplayUrl = vi.fn();
  const client = {
    sessions: { getReplayUrl },
    close: vi.fn(),
  };
  return {
    client,
    createSolariClient: vi.fn(() => client),
    deleteRunSessionsForOwner: vi.fn(),
    getReplayUrl,
    logServerEvent: vi.fn(),
    lookupRunSession: vi.fn(),
    sessionsDelete: vi.fn(),
    sessionsResolve: vi.fn(),
  };
});

vi.mock("@/src/lib/solari", () => ({ createSolariClient }));
vi.mock("@/src/lib/server-observability", () => ({ logServerEvent }));
vi.mock("@/src/features/capture/run-session-registry", () => ({
  deleteRunSessionsForOwner,
  lookupRunSession,
}));
vi.mock("@/src/features/credential/credential-session-store", () => ({
  credentialSessionStore: {
    delete: sessionsDelete,
    resolve: sessionsResolve,
  },
}));

import * as replayRoute from "@/app/api/replays/[id]/route";

const { GET } = replayRoute;

const ownerId = "a".repeat(64);
const rawSessionId =
  "pool-7f3a:9d1c4e2a-55b1-4a7e-9a3f-2c8d1e6b0a44:org_4b91ac2f:1752652800000.signature_abc";
const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const sessionRef = "sol_dab46ee6c619545d0534";

function replayRequest(
  overrides: Partial<Record<"runId" | "country" | "attempt", string>> = {},
  headers: Record<string, string> = {},
): NextRequest {
  const query = new URLSearchParams({
    runId,
    country: "us",
    attempt: "1",
    ...overrides,
  });
  return new NextRequest(`http://localhost/api/replays/${sessionRef}?${query}`, {
    headers: {
      Cookie: "localelens_session=opaque-token",
      "Sec-Fetch-Site": "same-origin",
      "x-localelens-request": "1",
      ...headers,
    },
  });
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function expectNoStore(response: Response): Promise<unknown> {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.json();
}

beforeEach(() => {
  sessionsResolve.mockReturnValue({
    ownerId,
    apiKey: "synthetic-user-capture-canary",
  });
  lookupRunSession.mockReturnValue(rawSessionId);
});

afterEach(() => {
  createSolariClient.mockClear();
  getReplayUrl.mockReset();
  client.close.mockReset();
  client.close.mockResolvedValue(undefined);
  logServerEvent.mockReset();
  lookupRunSession.mockReset();
  deleteRunSessionsForOwner.mockReset();
  sessionsDelete.mockReset();
  sessionsResolve.mockReset();
  delete process.env.SOLARI_CAPTURE_DISABLED;
  delete process.env.SOLARI_API_KEY;
});

describe("GET /api/replays/:id", () => {
  it.each(["HEAD", "POST", "PUT", "PATCH", "DELETE"] as const)(
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
      expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
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
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
  });

  it("fails closed when capture is explicitly disabled", async () => {
    process.env.SOLARI_CAPTURE_DISABLED = "true";

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(403);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("rejects a missing credential session", async () => {
    process.env.SOLARI_API_KEY = "synthetic-owner-fallback";
    sessionsResolve.mockReturnValue(null);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(503);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(lookupRunSession).not.toHaveBeenCalled();
  });

  it.each([
    "short",
    "session/with/slash",
    "session?query",
    "session%2Fencoded",
    "session with spaces",
    "x".repeat(501),
  ])("rejects invalid replay ID %s", async (id) => {
    const response = await GET(replayRequest(), routeContext(id));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("returns the provider's ambiguous replay 404 as pending", async () => {
    getReplayUrl.mockRejectedValue(Object.assign(new Error("not ready"), { status: 404 }));

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(202);
    expect(await expectNoStore(response)).toEqual({ status: "pending" });
    expect(getReplayUrl).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("returns only a validated temporary HTTPS replay URL", async () => {
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
    expect(lookupRunSession).toHaveBeenCalledWith(ownerId, {
      runId,
      country: "us",
      attempt: 1,
      sessionRef,
    });
    expect(createSolariClient).toHaveBeenCalledWith(
      "synthetic-user-capture-canary",
    );
    expect(getReplayUrl).toHaveBeenCalledWith(rawSessionId);
    expect(getReplayUrl).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("rejects a non-HTTPS provider replay URL", async () => {
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
    getReplayUrl.mockResolvedValue(replay);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(502);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("fails closed and records only a safe category when replay cleanup fails", async () => {
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
    const response = await GET(replayRequest(query), routeContext(sessionRef));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(lookupRunSession).not.toHaveBeenCalled();
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("makes no provider call when safe correlation is absent", async () => {
    lookupRunSession.mockReturnValue(null);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(404);
    expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(getReplayUrl).not.toHaveBeenCalled();
  });

  it("rejects a missing local request header before credential access", async () => {
    const response = await GET(
      replayRequest({}, { "x-localelens-request": "0" }),
      routeContext(sessionRef),
    );

    expect(response.status).toBe(400);
    expect(sessionsResolve).not.toHaveBeenCalled();
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("keeps another credential owner from resolving the correlation", async () => {
    const otherOwner = "b".repeat(64);
    sessionsResolve.mockReturnValue({
      ownerId: otherOwner,
      apiKey: "synthetic-other-user-key",
    });
    lookupRunSession.mockReturnValue(null);

    const response = await GET(replayRequest(), routeContext(sessionRef));

    expect(response.status).toBe(404);
    expect(lookupRunSession).toHaveBeenCalledWith(
      otherOwner,
      expect.objectContaining({ sessionRef }),
    );
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(getReplayUrl).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "invalidates the credential owner after provider status %s",
    async (status) => {
      getReplayUrl.mockRejectedValue(
        Object.assign(new Error("provider authentication body"), { status }),
      );
      sessionsDelete.mockReturnValue(ownerId);

      const response = await GET(replayRequest(), routeContext(sessionRef));

      expect(response.status).toBe(503);
      expect(await expectNoStore(response)).toEqual({ status: "unavailable" });
      expect(sessionsDelete).toHaveBeenCalledWith("opaque-token");
      expect(deleteRunSessionsForOwner).toHaveBeenCalledWith(ownerId);
      expect(response.headers.getSetCookie()[0]).toContain(
        "localelens_session=;",
      );
    },
  );
});
