import { afterEach, describe, expect, it, vi } from "vitest";

const { captureRegion } = vi.hoisted(() => ({
  captureRegion: vi.fn(),
}));

vi.mock("@/src/features/capture/capture-region", () => ({ captureRegion }));

import { POST } from "@/app/api/captures/route";

const originalLiveCaptureEnabled = process.env.LIVE_CAPTURE_ENABLED;
const originalApiKey = process.env.SOLARI_API_KEY;

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
    country: "us" as const,
    proxyCountry: "us" as const,
    proxyTier: "residential" as const,
    timezoneId: "America/New_York",
    sessionId: "safe-session-id",
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

async function expectNoStore(response: Response): Promise<unknown> {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.json();
}

afterEach(() => {
  captureRegion.mockReset();

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
  it("fails closed when live capture is disabled", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "false";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await POST(
      jsonRequest('{"url":"https://example.com/","country":"us"}'),
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
      jsonRequest('{"url":"https://example.com/","country":"us"}'),
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

  it("rejects request bodies above 2 KB", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await POST(jsonRequest("x".repeat(2_049)));

    expect(response.status).toBe(413);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("rejects unsupported countries before capture", async () => {
    process.env.LIVE_CAPTURE_ENABLED = "true";
    process.env.SOLARI_API_KEY = "unit-test-key";

    const response = await POST(
      jsonRequest('{"url":"https://example.com/","country":"xx"}'),
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
    captureRegion.mockResolvedValue(captureSuccess);

    const response = await POST(
      jsonRequest('{"url":"https://example.com/","country":"us"}'),
    );
    const body = await expectNoStore(response);

    expect(response.status).toBe(200);
    expect(body).toEqual(captureSuccess);
    expect(JSON.stringify(body)).not.toContain("unit-test-key");
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
      error: { code, message: "Safe message", retryable: false },
    });

    const response = await POST(
      jsonRequest('{"url":"https://example.com/","country":"us"}'),
    );

    expect(response.status).toBe(status);
    expect(await expectNoStore(response)).toMatchObject({
      ok: false,
      error: { code },
    });
  });
});
