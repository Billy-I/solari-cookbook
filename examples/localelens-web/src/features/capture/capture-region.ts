import {
  captureRequestSchema,
  captureResponseSchema,
  SUPPORTED_COUNTRIES,
  type CaptureRequest,
  type CaptureResponse,
  type SupportedCountry,
} from "./contracts";
import {
  extractPageEvidence,
  type ExtractedPageEvidence,
  type ExtractPageEvidenceInput,
} from "./extract-page-evidence";
import { toSafeCaptureFailure } from "./safe-error";
import { validatePublicUrl, type ResolveHost } from "./validate-public-url";

const DEFAULT_DEADLINE_MS = 45_000;
const DEFAULT_CLEANUP_TIMEOUT_MS = 2_500;

type NavigationRoute = {
  abort(errorCode?: string): Promise<void>;
  continue(): Promise<void>;
};

type NavigationRequest = {
  frame(): unknown;
  isNavigationRequest(): boolean;
  url(): string;
};

type PageLike = {
  setViewportSize(viewport: { width: number; height: number }): Promise<void>;
  route(
    pattern: string,
    handler: (
      route: NavigationRoute,
      request: NavigationRequest,
    ) => Promise<void>,
  ): Promise<unknown>;
  goto(
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ): Promise<{ status(): number } | null>;
  waitForTimeout(milliseconds: number): Promise<void>;
  url(): string;
  mainFrame(): unknown;
  evaluate(
    pageFunction: typeof extractPageEvidence,
    input: ExtractPageEvidenceInput,
  ): Promise<ExtractedPageEvidence>;
  screenshot(options: {
    type: "jpeg";
    quality: number;
    fullPage: boolean;
  }): Promise<Uint8Array>;
};

type BrowserLike = {
  id: string;
  proxy:
    | {
        country: string;
        tier?: "residential" | "static" | "mobile";
        timezoneId: string;
      }
    | undefined;
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
};

export type SolariLike = {
  launch(options: {
    stealth: true;
    proxy: SupportedCountry;
    recording: true;
    retries: 0;
  }): Promise<BrowserLike>;
  close(): Promise<void>;
};

export type CaptureDependencies = {
  createClient: () => SolariLike;
  now: () => Date;
  resolveHost?: ResolveHost;
  requestId?: string;
  log?: (event: CaptureLogEvent) => void;
  deadlineMs?: number;
  cleanupTimeoutMs?: number;
};

export type CaptureLogEvent = {
  category:
    | "browser_cleanup_failed"
    | "capture_deadline_exceeded"
    | "client_cleanup_failed";
  requestId: string;
};

function timeoutError(): Error {
  return Object.assign(new Error("NAVIGATION_TIMEOUT"), {
    name: "TimeoutError",
  });
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) throw timeoutError();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(timeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function unsupportedCountry(request: CaptureRequest): boolean {
  return !SUPPORTED_COUNTRIES.includes(request.country);
}

export async function captureRegion(
  request: CaptureRequest,
  dependencies: CaptureDependencies,
): Promise<CaptureResponse> {
  let client: SolariLike | undefined;
  let browser: BrowserLike | undefined;
  const requestId = dependencies.requestId ?? "unassigned";
  const log = dependencies.log ?? (() => undefined);
  const record = (event: CaptureLogEvent): void => {
    try {
      log(event);
    } catch {
      // Observability must never prevent resource cleanup.
    }
  };
  const deadlineAt =
    Date.now() + (dependencies.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const cleanupTimeoutMs =
    dependencies.cleanupTimeoutMs ?? DEFAULT_CLEANUP_TIMEOUT_MS;
  const run = <T>(operation: () => Promise<T>): Promise<T> =>
    withTimeout(operation, deadlineAt - Date.now());
  let result: CaptureResponse;
  let cleanupFailed = false;

  try {
    try {
      const parsedRequest = captureRequestSchema.safeParse(request);
      if (!parsedRequest.success) {
        throw new Error(
          unsupportedCountry(request) ? "UNSUPPORTED_COUNTRY" : "INVALID_INPUT",
        );
      }

      const validatedUrl = await run(() =>
        validatePublicUrl(parsedRequest.data.url, dependencies.resolveHost),
      );
      client = dependencies.createClient();
      browser = await run(() =>
        client!.launch({
          stealth: true,
          proxy: parsedRequest.data.country,
          recording: true,
          retries: 0,
        }),
      );

      const page = await run(() => browser!.newPage());
      await run(() => page.setViewportSize({ width: 1280, height: 900 }));
      let navigationGuardError: unknown;

      await run(() =>
        page.route("**/*", async (route, navigationRequest) => {
          const isTopLevelNavigation =
            navigationRequest.isNavigationRequest() &&
            navigationRequest.frame() === page.mainFrame();

          if (!isTopLevelNavigation) {
            await route.continue();
            return;
          }

          try {
            await run(() =>
              validatePublicUrl(
                navigationRequest.url(),
                dependencies.resolveHost,
              ),
            );
            await route.continue();
          } catch (error) {
            navigationGuardError = error;
            await route.abort("blockedbyclient");
          }
        }),
      );

      let navigationResponse: { status(): number } | null;
      try {
        navigationResponse = await run(() =>
          page.goto(validatedUrl.href, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          }),
        );
      } catch (error) {
        throw navigationGuardError ?? error;
      }

      await run(() => page.waitForTimeout(2_000));
      const finalUrl = await run(() =>
        validatePublicUrl(page.url(), dependencies.resolveHost),
      );
      const proxy = browser.proxy;
      if (
        !proxy ||
        proxy.country !== parsedRequest.data.country ||
        (proxy.tier !== undefined && proxy.tier !== "residential")
      ) {
        throw new Error("SOLARI_PROXY_MISMATCH");
      }

      const extracted = await run(() =>
        page.evaluate(extractPageEvidence, {
          finalUrl: finalUrl.href,
          httpStatus: navigationResponse?.status() ?? null,
        }),
      );
      const screenshotBytes = await run(() =>
        page.screenshot({
          type: "jpeg",
          quality: 72,
          fullPage: true,
        }),
      );
      if (screenshotBytes.byteLength > 1_500_000) {
        throw new Error("CAPTURE_FAILED");
      }

      result = captureResponseSchema.parse({
        ok: true,
        evidence: {
          requestedUrl: validatedUrl.href,
          ...extracted,
          capturedAt: dependencies.now().toISOString(),
        },
        receipt: {
          country: parsedRequest.data.country,
          proxyCountry: proxy.country,
          proxyTier: "residential",
          timezoneId: proxy.timezoneId || null,
          sessionId: browser.id,
          recordingRequested: true,
        },
        screenshot: {
          mediaType: "image/jpeg",
          base64: Buffer.from(screenshotBytes).toString("base64"),
          width: 1280,
        },
      });
    } catch (error) {
      result = toSafeCaptureFailure(error);
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "TimeoutError"
      ) {
        record({ category: "capture_deadline_exceeded", requestId });
      }
    }
  } finally {
    if (browser) {
      try {
        await withTimeout(() => browser!.close(), cleanupTimeoutMs);
      } catch {
        cleanupFailed = true;
        record({ category: "browser_cleanup_failed", requestId });
      }
    }

    if (client) {
      try {
        await withTimeout(() => client!.close(), cleanupTimeoutMs);
      } catch {
        cleanupFailed = true;
        record({ category: "client_cleanup_failed", requestId });
      }
    }
  }

  if (result.ok && cleanupFailed) {
    return toSafeCaptureFailure(new Error("CAPTURE_FAILED"));
  }

  return result;
}
