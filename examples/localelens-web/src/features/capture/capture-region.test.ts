import { describe, expect, it, vi } from "vitest";

import {
  captureRegion,
  type CaptureDependencies,
} from "@/src/features/capture/capture-region";

const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const correlation = {
  runId,
  country: "us" as const,
  attempt: 1,
  sessionRef: "sol_dab46ee6c619545d0534",
};

function captureRequest(url = "https://example.com/") {
  return { url, country: "us" as const, runId, attempt: 1 };
}

const extractedEvidence = {
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
};

type FailureStage = "launch" | "navigation" | "extraction" | "screenshot";

function createLifecycle(failureStage?: FailureStage) {
  const events: string[] = [];
  const mainFrame = {};
  let navigationHandler:
    | ((route: unknown, request: unknown) => Promise<void>)
    | undefined;
  const page = {
    setViewportSize: vi.fn(async ({ width, height }) => {
      events.push(`viewport:${width}x${height}`);
    }),
    route: vi.fn(async (_pattern, handler) => {
      events.push("route");
      navigationHandler = handler;
    }),
    goto: vi.fn(async () => {
      events.push("goto");
      if (failureStage === "navigation") throw new Error("navigation failed");
      return { status: () => 200 };
    }),
    waitForTimeout: vi.fn(async (milliseconds) => {
      events.push(`wait:${milliseconds}`);
    }),
    url: vi.fn(() => "https://example.com/"),
    evaluate: vi.fn(async () => {
      events.push("evaluate");
      if (failureStage === "extraction") throw new Error("extraction failed");
      return extractedEvidence;
    }),
    screenshot: vi.fn(async () => {
      events.push("screenshot");
      if (failureStage === "screenshot") throw new Error("screenshot failed");
      return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    }),
    mainFrame: vi.fn(() => mainFrame),
  };
  const browser = {
    id: "raw-provider-session-id",
    proxy: {
      country: "us",
      tier: "residential" as const,
      timezoneId: "America/New_York",
    },
    newPage: vi.fn(async () => {
      events.push("new-page");
      return page;
    }),
    close: vi.fn(async () => {
      events.push("browser:close");
    }),
  };
  const client = {
    launch: vi.fn(async () => {
      events.push("launch");
      if (failureStage === "launch") throw new Error("launch failed");
      return browser;
    }),
    close: vi.fn(async () => {
      events.push("client:close");
    }),
  };
  const registerSession = vi.fn((input) => {
    events.push("register-session");
    expect(input).toEqual({
      runId,
      country: "us",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });
    return correlation;
  });
  const dependencies: CaptureDependencies = {
    createClient: () => {
      events.push("client:create");
      return client;
    },
    now: () => new Date("2026-09-01T18:00:00.000Z"),
    registerSession,
    resolveHost: async (hostname) => {
      events.push(`resolve:${hostname}`);
      return ["93.184.216.34"];
    },
  };

  return {
    browser,
    client,
    dependencies,
    events,
    getNavigationHandler: () => navigationHandler,
    mainFrame,
    page,
    registerSession,
  };
}

describe("captureRegion", () => {
  it("captures one recorded residential session in exact lifecycle order", async () => {
    const lifecycle = createLifecycle();

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(lifecycle.client.launch).toHaveBeenCalledOnce();
    expect(lifecycle.client.launch).toHaveBeenCalledWith({
      stealth: true,
      proxy: "us",
      recording: true,
      retries: 0,
    });
    expect(lifecycle.page.screenshot).toHaveBeenCalledWith({
      type: "jpeg",
      quality: 72,
      fullPage: true,
    });
    expect(result).toEqual({
      ok: true,
      evidence: {
        requestedUrl: "https://example.com/",
        ...extractedEvidence,
        capturedAt: "2026-09-01T18:00:00.000Z",
      },
      receipt: {
        country: "us",
        runId,
        attempt: 1,
        sessionRef: correlation.sessionRef,
        proxyCountry: "us",
        proxyTier: "residential",
        timezoneId: "America/New_York",
        recordingRequested: true,
      },
      screenshot: {
        mediaType: "image/jpeg",
        base64: "/9j/2Q==",
        width: 1280,
      },
    });
    expect(lifecycle.events).toEqual([
      "resolve:example.com",
      "client:create",
      "launch",
      "register-session",
      "new-page",
      "viewport:1280x900",
      "route",
      "goto",
      "wait:2000",
      "resolve:example.com",
      "evaluate",
      "screenshot",
      "browser:close",
      "client:close",
    ]);
    expect(JSON.stringify(result)).not.toContain("raw-provider-session-id");
    expect(lifecycle.registerSession).toHaveBeenCalledOnce();
  });

  it("aborts a top-level redirect to a private destination", async () => {
    const lifecycle = createLifecycle();
    lifecycle.page.goto.mockImplementationOnce(async () => {
      lifecycle.events.push("goto");
      const handler = lifecycle.getNavigationHandler();
      if (!handler) throw new Error("guard missing");
      await handler(
        { abort: async () => lifecycle.events.push("route:abort") },
        {
          isNavigationRequest: () => true,
          frame: () => lifecycle.mainFrame,
          url: () => "https://127.0.0.1/private",
        },
      );
      throw new Error("net::ERR_FAILED");
    });

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PRIVATE_TARGET_BLOCKED" },
    });
    expect(lifecycle.events).toContain("route:abort");
    expect(lifecycle.browser.close).toHaveBeenCalledOnce();
    expect(lifecycle.client.close).toHaveBeenCalledOnce();
  });

  it("validates the initial destination before constructing a client", async () => {
    const lifecycle = createLifecycle();
    lifecycle.dependencies.resolveHost = async () => ["10.0.0.1"];

    const result = await captureRegion(
      captureRequest("https://internal.example/"),
      lifecycle.dependencies,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PRIVATE_TARGET_BLOCKED" },
    });
    expect(lifecycle.client.launch).not.toHaveBeenCalled();
    expect(lifecycle.client.close).not.toHaveBeenCalled();
    expect(lifecycle.registerSession).not.toHaveBeenCalled();
  });

  it("closes the client when launch fails without retrying", async () => {
    const lifecycle = createLifecycle("launch");

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(result).toEqual({
      ok: false,
      correlation: null,
      error: {
        code: "SOLARI_LAUNCH",
        message: "Solari could not start this regional browser.",
        retryable: true,
      },
    });
    expect(lifecycle.client.launch).toHaveBeenCalledOnce();
    expect(lifecycle.browser.close).not.toHaveBeenCalled();
    expect(lifecycle.client.close).toHaveBeenCalledOnce();
    expect(lifecycle.registerSession).not.toHaveBeenCalled();
  });

  it.each([
    ["navigation", "NAVIGATION_FAILED"],
    ["extraction", "EXTRACTION_FAILED"],
    ["screenshot", "CAPTURE_FAILED"],
  ] as const)(
    "reports %s safely and closes browser and client",
    async (failureStage, code) => {
      const lifecycle = createLifecycle(failureStage);

      const result = await captureRegion(
        captureRequest(),
        lifecycle.dependencies,
      );

      expect(result).toMatchObject({
        ok: false,
        correlation,
        error: { code, retryable: true },
      });
      expect(lifecycle.browser.close).toHaveBeenCalledOnce();
      expect(lifecycle.client.close).toHaveBeenCalledOnce();
    },
  );

  it("rejects proxy receipt mismatch and still closes both resources", async () => {
    const lifecycle = createLifecycle();
    lifecycle.browser.proxy.country = "gb";

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SOLARI_PROXY_MISMATCH" },
    });
    expect(lifecycle.browser.close).toHaveBeenCalledOnce();
    expect(lifecycle.client.close).toHaveBeenCalledOnce();
  });

  it("accepts a screenshot at 1.5 MB and rejects one byte over before base64 encoding", async () => {
    const lifecycle = createLifecycle();
    lifecycle.page.screenshot.mockResolvedValueOnce(new Uint8Array(1_500_000));

    const atLimit = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(atLimit.ok).toBe(true);

    const oneByteOver = createLifecycle();
    oneByteOver.page.screenshot.mockResolvedValueOnce(new Uint8Array(1_500_001));
    const result = await captureRegion(
      captureRequest(),
      oneByteOver.dependencies,
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CAPTURE_FAILED" } });
    expect(oneByteOver.browser.close).toHaveBeenCalledOnce();
    expect(oneByteOver.client.close).toHaveBeenCalledOnce();
  });

  it("attempts client cleanup when browser cleanup itself fails", async () => {
    const lifecycle = createLifecycle();
    lifecycle.browser.close.mockImplementationOnce(async () => {
      lifecycle.events.push("browser:close");
      throw new Error("cleanup failed");
    });

    const log = vi.fn();
    lifecycle.dependencies.log = log;
    lifecycle.dependencies.requestId = "request-safe-id";

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CAPTURE_FAILED" },
    });
    expect(lifecycle.client.close).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith({
      category: "browser_cleanup_failed",
      requestId: "request-safe-id",
    });
  });

  it("preserves a primary safe failure when cleanup also fails", async () => {
    const lifecycle = createLifecycle("navigation");
    const log = vi.fn();
    lifecycle.dependencies.log = log;
    lifecycle.dependencies.requestId = "request-safe-id";
    lifecycle.browser.close.mockRejectedValueOnce(new Error("cleanup secret"));

    const result = await captureRegion(
      captureRequest(),
      lifecycle.dependencies,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NAVIGATION_FAILED" },
    });
    expect(lifecycle.client.close).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith({
      category: "browser_cleanup_failed",
      requestId: "request-safe-id",
    });
  });

  it.each(["dns", "evaluate", "screenshot"] as const)(
    "bounds a never-resolving %s phase and initiates cleanup",
    async (stage) => {
      vi.useFakeTimers();
      try {
        const lifecycle = createLifecycle();
        lifecycle.dependencies.deadlineMs = 100;
        lifecycle.dependencies.cleanupTimeoutMs = 25;
        if (stage === "dns") {
          lifecycle.dependencies.resolveHost = async () => new Promise(() => {});
        } else if (stage === "evaluate") {
          lifecycle.page.evaluate.mockImplementationOnce(
            async () => new Promise(() => {}),
          );
        } else {
          lifecycle.page.screenshot.mockImplementationOnce(
            async () => new Promise(() => {}),
          );
        }

        const resultPromise = captureRegion(
          captureRequest(),
          lifecycle.dependencies,
        );
        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;

        expect(result).toMatchObject({
          ok: false,
          error: { code: "NAVIGATION_TIMEOUT" },
        });
        if (stage === "dns") {
          expect(lifecycle.browser.close).not.toHaveBeenCalled();
          expect(lifecycle.client.close).not.toHaveBeenCalled();
        } else {
          expect(lifecycle.browser.close).toHaveBeenCalledOnce();
          expect(lifecycle.client.close).toHaveBeenCalledOnce();
        }
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("closes a browser that resolves after the launch deadline", async () => {
    vi.useFakeTimers();
    try {
      const lifecycle = createLifecycle();
      const log = vi.fn();
      lifecycle.dependencies.deadlineMs = 100;
      lifecycle.dependencies.cleanupTimeoutMs = 25;
      lifecycle.dependencies.log = log;
      lifecycle.dependencies.requestId = "request-safe-id";
      let resolveLaunch: ((browser: typeof lifecycle.browser) => void) | undefined;
      lifecycle.client.launch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLaunch = resolve;
          }),
      );

      const resultPromise = captureRegion(
        captureRequest(),
        lifecycle.dependencies,
      );
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result).toMatchObject({
        ok: false,
        error: { code: "NAVIGATION_TIMEOUT" },
      });
      expect(lifecycle.client.close).toHaveBeenCalledOnce();
      expect(lifecycle.browser.close).not.toHaveBeenCalled();

      resolveLaunch?.(lifecycle.browser);
      await vi.advanceTimersByTimeAsync(0);

      expect(lifecycle.browser.close).toHaveBeenCalledOnce();
      expect(lifecycle.client.close).toHaveBeenCalledTimes(2);
      expect(log).not.toHaveBeenCalledWith({
        category: "late_browser_cleanup_failed",
        requestId: "request-safe-id",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("records only a safe category when late browser cleanup fails", async () => {
    vi.useFakeTimers();
    try {
      const lifecycle = createLifecycle();
      const log = vi.fn();
      lifecycle.dependencies.deadlineMs = 100;
      lifecycle.dependencies.cleanupTimeoutMs = 25;
      lifecycle.dependencies.log = log;
      lifecycle.dependencies.requestId = "request-safe-id";
      let resolveLaunch: ((browser: typeof lifecycle.browser) => void) | undefined;
      lifecycle.client.launch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLaunch = resolve;
          }),
      );
      lifecycle.browser.close.mockRejectedValueOnce(new Error("session secret"));

      const resultPromise = captureRegion(
        captureRequest(),
        lifecycle.dependencies,
      );
      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;
      resolveLaunch?.(lifecycle.browser);
      await vi.advanceTimersByTimeAsync(0);

      expect(log).toHaveBeenCalledWith({
        category: "late_browser_cleanup_failed",
        requestId: "request-safe-id",
      });
      expect(lifecycle.client.close).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(log.mock.calls)).not.toContain("session secret");
    } finally {
      vi.useRealTimers();
    }
  });

  it("records only a safe category when the late client close fails", async () => {
    vi.useFakeTimers();
    try {
      const lifecycle = createLifecycle();
      const log = vi.fn();
      lifecycle.dependencies.deadlineMs = 100;
      lifecycle.dependencies.cleanupTimeoutMs = 25;
      lifecycle.dependencies.log = log;
      lifecycle.dependencies.requestId = "request-safe-id";
      let resolveLaunch: ((browser: typeof lifecycle.browser) => void) | undefined;
      lifecycle.client.launch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLaunch = resolve;
          }),
      );
      lifecycle.client.close
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("client secret"));

      const resultPromise = captureRegion(
        captureRequest(),
        lifecycle.dependencies,
      );
      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;
      resolveLaunch?.(lifecycle.browser);
      await vi.advanceTimersByTimeAsync(0);

      expect(lifecycle.browser.close).toHaveBeenCalledOnce();
      expect(lifecycle.client.close).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith({
        category: "late_client_cleanup_failed",
        requestId: "request-safe-id",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("client secret");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds never-resolving cleanup and reports a failed capture", async () => {
    vi.useFakeTimers();
    try {
      const lifecycle = createLifecycle();
      const log = vi.fn();
      lifecycle.dependencies.deadlineMs = 100;
      lifecycle.dependencies.cleanupTimeoutMs = 25;
      lifecycle.dependencies.log = log;
      lifecycle.dependencies.requestId = "request-safe-id";
      lifecycle.browser.close.mockImplementationOnce(async () => new Promise(() => {}));
      lifecycle.client.close.mockImplementationOnce(async () => new Promise(() => {}));

      const resultPromise = captureRegion(
        captureRequest(),
        lifecycle.dependencies,
      );
      await vi.advanceTimersByTimeAsync(50);
      const result = await resultPromise;

      expect(result).toMatchObject({
        ok: false,
        error: { code: "CAPTURE_FAILED" },
      });
      expect(log).toHaveBeenCalledWith({
        category: "browser_cleanup_failed",
        requestId: "request-safe-id",
      });
      expect(log).toHaveBeenCalledWith({
        category: "client_cleanup_failed",
        requestId: "request-safe-id",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
