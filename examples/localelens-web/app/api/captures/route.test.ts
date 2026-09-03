import { afterEach, describe, expect, it, vi } from "vitest";

const { captureRegion, registerRunSession } = vi.hoisted(() => ({
  captureRegion: vi.fn(),
  registerRunSession: vi.fn(),
}));

vi.mock("@/src/features/capture/capture-region", () => ({ captureRegion }));
vi.mock("@/src/features/capture/run-session-registry", () => ({
  registerRunSession,
}));

import * as captureRoute from "@/app/api/captures/route";

const { POST } = captureRoute;

const originalLiveCaptureEnabled = process.env.LIVE_CAPTURE_ENABLED;
const originalApiKey = process.env.SOLARI_API_KEY;
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

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/captures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function streamedRequest(
  chunks: readonly Uint8Array[],
  contentLength?: string,
): Request {
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
  const headers = new Headers({ "Content-Type": "application/json" });
  if (contentLength !== undefined) headers.set("Content-Length", contentLength);

  return new Request("http://localhost/api/captures", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function expectNoStore(response: Response): Promise<unknown> {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.json();
}

afterEach(() => {
  captureRegion.mockReset();
  registerRunSession.mockReset();
  vi.restoreAllMocks();

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

  it("fails closed when live capture is disabled", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "false";
    process.env.SOLARI_API_KEY = "unit-test-key";

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

  it("rejects a missing server key", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    delete process.env.SOLARI_API_KEY;

    const response = await POST(
      jsonRequest(validRequestBody),
    );

    expect(response.status).toBe(503);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "SOLARI_AUTH" },
    });
    expect(captureRegion).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await POST(jsonRequest("{"));

    expect(response.status).toBe(400);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("accepts a request body at 2 KiB and rejects one byte over", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

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
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

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
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

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
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
    const pull = vi.fn();
    const request = new Request("http://localhost/api/captures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "2049",
      },
      body: new ReadableStream<Uint8Array>({ pull }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(pull).not.toHaveBeenCalled();
  });

  it("rejects unsupported countries before capture", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

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
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
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
    expect(JSON.stringify(body)).not.toContain("unit-test-key");
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
      runId,
      country: "us",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });
    expect(captureRegion).toHaveBeenCalledOnce();
  });

  it.each([
    ["PRIVATE_TARGET_BLOCKED", 400],
    ["NAVIGATION_TIMEOUT", 504],
    ["SOLARI_CAPACITY", 503],
    ["SOLARI_AUTH", 503],
    ["SOLARI_PROXY_MISMATCH", 502],
    ["CAPTURE_FAILED", 502],
  ])("maps safe failure %s to status %i", async (code, status) => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";
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
});
