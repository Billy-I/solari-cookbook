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
  ): Promise<void>;
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
  proxy?: {
    country: string;
    tier?: "residential" | "static" | "mobile";
    timezoneId: string;
  };
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
  resolveHost: ResolveHost;
};

function unsupportedCountry(request: CaptureRequest): boolean {
  return !SUPPORTED_COUNTRIES.includes(request.country);
}

export async function captureRegion(
  request: CaptureRequest,
  dependencies: CaptureDependencies,
): Promise<CaptureResponse> {
  let client: SolariLike | undefined;
  let browser: BrowserLike | undefined;

  try {
    const parsedRequest = captureRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new Error(
        unsupportedCountry(request) ? "UNSUPPORTED_COUNTRY" : "INVALID_INPUT",
      );
    }

    const validatedUrl = await validatePublicUrl(
      parsedRequest.data.url,
      dependencies.resolveHost,
    );
    client = dependencies.createClient();
    browser = await client.launch({
      stealth: true,
      proxy: parsedRequest.data.country,
      recording: true,
      retries: 0,
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    let navigationGuardError: unknown;

    await page.route("**/*", async (route, navigationRequest) => {
      const isTopLevelNavigation =
        navigationRequest.isNavigationRequest() &&
        navigationRequest.frame() === page.mainFrame();

      if (!isTopLevelNavigation) {
        await route.continue();
        return;
      }

      try {
        await validatePublicUrl(
          navigationRequest.url(),
          dependencies.resolveHost,
        );
        await route.continue();
      } catch (error) {
        navigationGuardError = error;
        await route.abort("blockedbyclient");
      }
    });

    let navigationResponse: { status(): number } | null;
    try {
      navigationResponse = await page.goto(validatedUrl.href, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } catch (error) {
      throw navigationGuardError ?? error;
    }

    await page.waitForTimeout(2_000);
    const finalUrl = await validatePublicUrl(page.url(), dependencies.resolveHost);
    const proxy = browser.proxy;
    if (
      !proxy ||
      proxy.country !== parsedRequest.data.country ||
      (proxy.tier !== undefined && proxy.tier !== "residential")
    ) {
      throw new Error("SOLARI_PROXY_MISMATCH");
    }

    const extracted = await page.evaluate(extractPageEvidence, {
      finalUrl: finalUrl.href,
      httpStatus: navigationResponse?.status() ?? null,
    });
    const screenshotBytes = await page.screenshot({
      type: "jpeg",
      quality: 72,
      fullPage: true,
    });
    if (screenshotBytes.byteLength > 1_500_000) {
      throw new Error("CAPTURE_FAILED");
    }

    return captureResponseSchema.parse({
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
    return toSafeCaptureFailure(error);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Cleanup errors never replace the primary capture result.
      }
    }

    if (client) {
      try {
        await client.close();
      } catch {
        // Cleanup errors never replace the primary capture result.
      }
    }
  }
}
