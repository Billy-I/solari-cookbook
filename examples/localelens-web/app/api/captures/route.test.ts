import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureRegion,
  createSolariClient,
  deleteRunSessionsForOwner,
  registerRunSession,
  sessionsDelete,
  sessionsResolve,
} = vi.hoisted(() => ({
  captureRegion: vi.fn(),
  createSolariClient: vi.fn(() => ({ kind: "synthetic-client" })),
  deleteRunSessionsForOwner: vi.fn(),
  registerRunSession: vi.fn(),
  sessionsDelete: vi.fn(),
  sessionsResolve: vi.fn(),
}));

vi.mock("@/src/features/capture/capture-region", () => ({ captureRegion }));
vi.mock("@/src/features/capture/run-session-registry", () => ({
  deleteRunSessionsForOwner,
  registerRunSession,
}));
vi.mock("@/src/features/credential/credential-session-store", () => ({
  credentialSessionStore: {
    delete: sessionsDelete,
    resolve: sessionsResolve,
  },
}));
vi.mock("@/src/lib/solari", () => ({ createSolariClient }));

import * as captureRoute from "@/app/api/captures/route";

const { POST } = captureRoute;

const ownerId = "a".repeat(64);
const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const sessionRef = "sol_dab46ee6c619545d0534";
const validRequestBody = JSON.stringify({
  url: "https://example.com/",
  country: "us",
  runId,
  attempt: 1,
});

const captureSuccess = {
  ok: true as const,
  evidence: {
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    title: "Example Domain",
    documentLanguage: "en",
    primaryHeading: "Example Domain",
    primaryAction: null,
    ctas: [],
    currencies: [],
    priceSnippets: [],
    consentText: null,
    httpStatus: 200,
    capturedAt: "2026-09-01T18:00:00.000Z",
  },
  receipt: {
    runId,
    country: "us" as const,
    attempt: 1,
    sessionRef,
    proxyCountry: "us" as const,
    proxyTier: "residential" as const,
    timezoneId: "America/New_York",
    recordingRequested: true as const,
  },
  screenshot: {
    mediaType: "image/jpeg" as const,
    base64: "/9j/2Q==",
    width: 1280,
  },
};

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/captures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "localelens_session=opaque-token",
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin",
      "x-localelens-request": "1",
      ...headers,
    },
    body,
  });
}

function streamedRequest(
  chunks: readonly Uint8Array[],
  contentLength?: string,
): NextRequest {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
  });
  const headers = new Headers({
    "Content-Type": "application/json",
    Cookie: "localelens_session=opaque-token",
    Origin: "http://localhost",
    "Sec-Fetch-Site": "same-origin",
    "x-localelens-request": "1",
  });
  if (contentLength !== undefined) headers.set("Content-Length", contentLength);

  return new NextRequest("http://localhost/api/captures", {
    method: "POST",
    headers,
    body,
  });
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
});

afterEach(() => {
  captureRegion.mockReset();
  registerRunSession.mockReset();
  createSolariClient.mockClear();
  deleteRunSessionsForOwner.mockReset();
  sessionsDelete.mockReset();
  sessionsResolve.mockReset();
  vi.restoreAllMocks();
  delete process.env.SOLARI_CAPTURE_DISABLED;
  delete process.env.SOLARI_API_KEY;
});

describe("POST /api/captures", () => {
  it.each(["GET", "HEAD", "PUT", "PATCH", "DELETE"] as const)(
    "returns a no-store 405 for unsupported %s requests",
    async (method) => {
      const handler = Reflect.get(captureRoute, method) as
        | ((request: Request) => Response | Promise<Response>)
        | undefined;

      expect(handler).toBeTypeOf("function");
      if (!handler) throw new Error(`Missing ${method} route handler.`);

      const response = await handler(
        new Request("http://localhost/api/captures", { method }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
      expect(await response.text()).toBe("");
    },
  );

  it("returns a no-store response to OPTIONS requests", async () => {
    const handler = Reflect.get(captureRoute, "OPTIONS") as
      | (() => Response | Promise<Response>)
      | undefined;

    expect(handler).toBeTypeOf("function");
    if (!handler) throw new Error("Missing OPTIONS route handler.");

    const response = await handler();

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
  });

  it("fails closed when capture is explicitly disabled", async () => {
    process.env.SOLARI_CAPTURE_DISABLED = "true";

    const response = await POST(
      jsonRequest(validRequestBody),
    );

    expect(response.status).toBe(403);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "CAPTURE_FAILED" },
    });
    expect(captureRegion).not.toHaveBeenCalled();
  });

  it("rejects a missing credential session without provider work", async () => {
    process.env.SOLARI_API_KEY = "synthetic-owner-fallback";
    sessionsResolve.mockReturnValue(null);

    const response = await POST(
      jsonRequest(validRequestBody),
    );

    expect(response.status).toBe(503);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "SOLARI_AUTH" },
    });
    expect(captureRegion).not.toHaveBeenCalled();
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it.each([
    ["missing local header", { "x-localelens-request": "0" }],
    ["cross origin", { Origin: "http://attacker.example" }],
  ])("rejects %s before credential or provider access", async (_label, headers) => {
    const response = await POST(jsonRequest(validRequestBody, headers));

    expect(response.status).toBe(400);
    expect(sessionsResolve).not.toHaveBeenCalled();
    expect(captureRegion).not.toHaveBeenCalled();
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(jsonRequest("{"));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("accepts a request body at 2 KiB and rejects one byte over", async () => {
    const atLimit = await POST(jsonRequest("x".repeat(2_048)));
    const oneByteOver = await POST(jsonRequest("x".repeat(2_049)));

    expect(atLimit.status).toBe(400);
    expect(await expectNoStore(atLimit)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(oneByteOver.status).toBe(413);
    expect(await expectNoStore(oneByteOver)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("rejects an oversized streamed body without a content length", async () => {
    const response = await POST(
      streamedRequest([
        new TextEncoder().encode("x".repeat(2_048)),
        new TextEncoder().encode("x"),
      ]),
    );

    expect(response.status).toBe(413);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(captureRegion).not.toHaveBeenCalled();
  });

  it("rejects a stream that exceeds a misleading content length", async () => {
    const response = await POST(
      streamedRequest(
        [
          new TextEncoder().encode("x".repeat(2_048)),
          new TextEncoder().encode("x"),
        ],
        "1",
      ),
    );

    expect(response.status).toBe(413);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("rejects a declared oversized body before reading its stream", async () => {
    const pull = vi.fn();
    const request = new NextRequest("http://localhost/api/captures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "2049",
        Cookie: "localelens_session=opaque-token",
        Origin: "http://localhost",
        "Sec-Fetch-Site": "same-origin",
        "x-localelens-request": "1",
      },
      body: new ReadableStream<Uint8Array>({ pull }),
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(pull).not.toHaveBeenCalled();
  });

  it("rejects unsupported countries before capture", async () => {
    const response = await POST(
      jsonRequest(
        JSON.stringify({
          url: "https://example.com/",
          country: "xx",
          runId,
          attempt: 1,
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_COUNTRY" },
    });
    expect(captureRegion).not.toHaveBeenCalled();
  });

  it("returns one successful regional capture", async () => {
    process.env.SOLARI_API_KEY = "synthetic-owner-fallback";
    registerRunSession.mockReturnValue({
      runId,
      country: "us",
      attempt: 1,
      sessionRef,
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    captureRegion.mockImplementation(async (_request, dependencies) => {
      expect(dependencies.createClient()).toEqual({ kind: "synthetic-client" });
      const correlation = dependencies.registerSession({
        runId,
        country: "us",
        attempt: 1,
        sessionId: "raw-provider-session-id",
      });
      expect(correlation.sessionRef).toBe(sessionRef);
      return captureSuccess;
    });

    const response = await POST(
      jsonRequest(validRequestBody),
    );
    const body = await expectNoStore(response);

    expect(response.status).toBe(200);
    expect(body).toEqual(captureSuccess);
    expect(JSON.stringify(body)).not.toContain("synthetic-user-capture-canary");
    expect(JSON.stringify(body)).not.toContain("raw-provider-session-id");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "raw-provider-session-id",
    );
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toContain(
      "raw-provider-session-id",
    );
    expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toEqual({
      category: "session_registered",
      requestId: expect.any(String),
      runId,
      country: "us",
      attempt: 1,
      sessionRef,
    });
    expect(registerRunSession).toHaveBeenCalledWith({
      ownerId,
      runId,
      country: "us",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });
    expect(createSolariClient).toHaveBeenCalledWith(
      "synthetic-user-capture-canary",
    );
    expect(createSolariClient).not.toHaveBeenCalledWith(
      "synthetic-owner-fallback",
    );
    expect(captureRegion).toHaveBeenCalledOnce();
  });

  it.each([
    ["PRIVATE_TARGET_BLOCKED", 400],
    ["NAVIGATION_TIMEOUT", 504],
    ["SOLARI_CAPACITY", 503],
    ["SOLARI_AUTH", 503],
    ["SOLARI_PROXY_MISMATCH", 502],
    ["SOLARI_LAUNCH", 502],
    ["NAVIGATION_FAILED", 502],
    ["EXTRACTION_FAILED", 502],
    ["CAPTURE_FAILED", 502],
  ])("maps safe failure %s to status %i", async (code, status) => {
    captureRegion.mockResolvedValue({
      ok: false,
      correlation: null,
      error: { code, message: "Safe message", retryable: false },
    });

    const response = await POST(
      jsonRequest(validRequestBody),
    );

    expect(response.status).toBe(status);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it("invalidates the credential owner after a provider authentication failure", async () => {
    sessionsDelete.mockReturnValue(ownerId);
    captureRegion.mockResolvedValue({
      ok: false,
      correlation: null,
      error: {
        code: "SOLARI_AUTH",
        message: "Solari authentication is unavailable.",
        retryable: false,
      },
    });

    const response = await POST(jsonRequest(validRequestBody));

    expect(sessionsDelete).toHaveBeenCalledWith("opaque-token");
    expect(deleteRunSessionsForOwner).toHaveBeenCalledWith(ownerId);
    expect(response.headers.getSetCookie()[0]).toContain(
      "localelens_session=;",
    );
  });
});
