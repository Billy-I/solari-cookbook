import type { AuditFormValue } from "@/src/components/audit-form";
import {
  type CaptureFailure,
  type CaptureResponse,
} from "@/src/features/capture/contracts";
import {
  SUPPORTED_COUNTRIES,
  type SupportedCountry,
} from "@/src/features/capture/countries";
import { SAFE_CAPTURE_ERROR_CODES } from "@/src/features/capture/error-codes";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";

const clientTimeoutMs = 45_000;
const maximumUnresolvedTransports = 3;
const isoDateSource =
  "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
const isoOffsetDateTime = new RegExp(
  `^${isoDateSource}T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$`,
);

class ResponseTooLargeError extends Error {}

export type PublicCaptureError = CaptureFailure["error"];

export type RunEvents = {
  started(country: SupportedCountry): void;
  succeeded(country: SupportedCountry, response: CaptureResponse): void;
  failed(country: SupportedCountry, error: PublicCaptureError): void;
};

function safeError(
  code:
    | "NAVIGATION_TIMEOUT"
    | "SOLARI_CAPACITY"
    | "SOLARI_PROXY_MISMATCH"
    | "CAPTURE_FAILED",
): PublicCaptureError {
  return toSafeCaptureFailure(new Error(code)).error;
}

type ActiveTransport = {
  country: SupportedCountry;
  settled: Promise<void>;
  signal: AbortSignal;
};

export type CaptureTransportPool = {
  hasCountry(country: SupportedCountry): boolean;
  hasSignal(signal: AbortSignal): boolean;
  run<T>(
    country: SupportedCountry,
    signal: AbortSignal,
    start: () => Promise<T>,
  ): Promise<T>;
  whenSignalSettled(signal: AbortSignal): Promise<void>;
};

export function createCaptureTransportPool(): CaptureTransportPool {
  const active = new Set<ActiveTransport>();

  return {
    hasCountry(country) {
      return [...active].some((transport) => transport.country === country);
    },
    hasSignal(signal) {
      return [...active].some((transport) => transport.signal === signal);
    },
    run<T>(country: SupportedCountry, signal: AbortSignal, start: () => Promise<T>) {
      if (active.size >= maximumUnresolvedTransports) {
        return Promise.reject(new Error("SOLARI_CAPACITY"));
      }

      let request: Promise<T>;
      try {
        request = start();
      } catch (error) {
        request = Promise.reject(error);
      }

      const transport = {} as ActiveTransport;
      transport.country = country;
      transport.signal = signal;
      transport.settled = request.then(
        () => {
          active.delete(transport);
        },
        () => {
          active.delete(transport);
        },
      );
      active.add(transport);
      return request;
    },
    async whenSignalSettled(signal) {
      await Promise.all(
        [...active]
          .filter((transport) => transport.signal === signal)
          .map((transport) => transport.settled),
      );
    },
  };
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

async function settleRequest<T>(
  request: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectForAbort: ((reason: unknown) => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("NAVIGATION_TIMEOUT")), clientTimeoutMs);
  });
  const userAbort = new Promise<never>((_, reject) => {
    rejectForAbort = reject;
  });
  const onAbort = () => rejectForAbort?.(abortReason(signal));

  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  try {
    return await Promise.race([request, timeout, userAbort]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("Content-Length");
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    BigInt(contentLength) > BigInt(CAPTURE_LIMITS.responseBytes)
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError();
  }

  if (!response.body) return response.json();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      byteLength += next.value.byteLength;
      if (byteLength > CAPTURE_LIMITS.responseBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseTooLargeError();
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length <= maximumLength;
}

function isNonEmptyString(value: unknown, maximumLength: number): value is string {
  return isString(value, maximumLength) && value.length > 0;
}

function isNullableString(value: unknown, maximumLength: number): boolean {
  return value === null || isString(value, maximumLength);
}

function isStringArray(value: unknown, maximumItems: number, maximumLength: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => isString(item, maximumLength))
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value, 2048)) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSupportedCountry(value: unknown): value is SupportedCountry {
  return (
    typeof value === "string" &&
    SUPPORTED_COUNTRIES.includes(value as SupportedCountry)
  );
}

function isIsoOffsetDateTime(value: unknown): value is string {
  return typeof value === "string" && isoOffsetDateTime.test(value);
}

function isCaptureResponse(body: unknown): body is CaptureResponse {
  if (!isRecord(body) || typeof body.ok !== "boolean") return false;

  if (!body.ok) {
    return (
      hasExactKeys(body, ["ok", "error"]) &&
      isRecord(body.error) &&
      hasExactKeys(body.error, ["code", "message", "retryable"]) &&
      typeof body.error.code === "string" &&
      SAFE_CAPTURE_ERROR_CODES.includes(
        body.error.code as (typeof SAFE_CAPTURE_ERROR_CODES)[number],
      ) &&
      isNonEmptyString(body.error.message, 240) &&
      typeof body.error.retryable === "boolean"
    );
  }

  if (
    !isRecord(body.evidence) ||
    !isRecord(body.receipt) ||
    !isRecord(body.screenshot)
  ) {
    return false;
  }

  const { evidence, receipt, screenshot } = body;
  const httpStatus = evidence.httpStatus;
  const screenshotWidth = screenshot.width;
  return (
    hasExactKeys(body, ["ok", "evidence", "receipt", "screenshot"]) &&
    hasExactKeys(evidence, [
      "requestedUrl",
      "finalUrl",
      "title",
      "documentLanguage",
      "primaryHeading",
      "primaryAction",
      "ctas",
      "currencies",
      "priceSnippets",
      "consentText",
      "httpStatus",
      "capturedAt",
    ]) &&
    hasExactKeys(receipt, [
      "country",
      "proxyCountry",
      "proxyTier",
      "timezoneId",
      "sessionId",
      "recordingRequested",
    ]) &&
    hasExactKeys(screenshot, ["mediaType", "base64", "width"]) &&
    isHttpsUrl(evidence.requestedUrl) &&
    isHttpsUrl(evidence.finalUrl) &&
    isNullableString(evidence.title, 200) &&
    isNullableString(evidence.documentLanguage, 35) &&
    isNullableString(evidence.primaryHeading, 240) &&
    isNullableString(evidence.primaryAction, 120) &&
    isStringArray(evidence.ctas, 20, 120) &&
    isStringArray(evidence.currencies, 12, 20) &&
    isStringArray(evidence.priceSnippets, 8, 160) &&
    isNullableString(evidence.consentText, 500) &&
    (httpStatus === null ||
      (typeof httpStatus === "number" &&
        Number.isInteger(httpStatus) &&
        httpStatus >= 100 &&
        httpStatus <= 599)) &&
    isIsoOffsetDateTime(evidence.capturedAt) &&
    isSupportedCountry(receipt.country) &&
    isSupportedCountry(receipt.proxyCountry) &&
    receipt.proxyTier === "residential" &&
    isNullableString(receipt.timezoneId, 100) &&
    isNonEmptyString(receipt.sessionId, 500) &&
    receipt.recordingRequested === true &&
    screenshot.mediaType === "image/jpeg" &&
    isNonEmptyString(screenshot.base64, 2_000_000) &&
    typeof screenshotWidth === "number" &&
    Number.isInteger(screenshotWidth) &&
    screenshotWidth > 0 &&
    screenshotWidth <= 4096
  );
}

async function runCountryRequest(
  country: SupportedCountry,
  url: string,
  events: RunEvents,
  signal: AbortSignal,
  transportPool: CaptureTransportPool,
): Promise<void> {
  events.started(country);

  let outcome:
    | { type: "succeeded"; response: CaptureResponse }
    | { type: "failed"; error: PublicCaptureError };

  try {
    const { response, body } = await settleRequest(
      transportPool.run(country, signal, async () => {
        const response = await fetch("/api/captures", {
          body: JSON.stringify({ country, url }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal,
        });
        return { response, body: await readBoundedJson(response) };
      }),
      signal,
    );
    const parsed = isCaptureResponse(body) ? body : null;

    if (signal.aborted) throw abortReason(signal);
    if (
      parsed &&
      response.ok &&
      parsed.ok &&
      parsed.receipt.country === country &&
      parsed.receipt.proxyCountry === country
    ) {
      outcome = { type: "succeeded", response: parsed };
    } else if (
      parsed &&
      parsed.ok &&
      (parsed.receipt.country !== country ||
        parsed.receipt.proxyCountry !== country)
    ) {
      outcome = {
        type: "failed",
        error: safeError("SOLARI_PROXY_MISMATCH"),
      };
    } else {
      outcome = {
        type: "failed",
        error:
          parsed && !parsed.ok
            ? parsed.error
            : safeError("CAPTURE_FAILED"),
      };
    }
  } catch (error) {
    if (signal.aborted) throw abortReason(signal);
    outcome = {
      type: "failed",
      error:
        error instanceof Error &&
        (error.message === "NAVIGATION_TIMEOUT" ||
          error.message === "SOLARI_CAPACITY")
          ? safeError(error.message)
          : safeError("CAPTURE_FAILED"),
    };
  }

  if (outcome.type === "succeeded") events.succeeded(country, outcome.response);
  else events.failed(country, outcome.error);
}

export async function runCountryCapture(
  country: SupportedCountry,
  url: string,
  events: RunEvents,
  signal: AbortSignal,
  transportPool = createCaptureTransportPool(),
): Promise<void> {
  await runCountryRequest(
    country,
    new URL(url.trim()).toString(),
    events,
    signal,
    transportPool,
  );
}

export function validateSelectedCountries(
  input: AuditFormValue,
): SupportedCountry[] {
  const countries = input.countries as readonly string[];
  const uniqueCountries = new Set(countries);

  if (
    countries.length < 2 ||
    countries.length > CAPTURE_LIMITS.maxCountries ||
    uniqueCountries.size !== countries.length ||
    countries.some(
      (country) => !SUPPORTED_COUNTRIES.includes(country as SupportedCountry),
    )
  ) {
    throw new Error("Select exactly 2 or 3 unique supported countries.");
  }

  return countries as SupportedCountry[];
}

export async function runComparison(
  input: AuditFormValue,
  events: RunEvents,
  signal: AbortSignal,
  transportPool = createCaptureTransportPool(),
): Promise<void> {
  const countries = validateSelectedCountries(input);
  const url = new URL(input.url.trim()).toString();

  const settlements = await Promise.allSettled(
    countries.map((country) =>
      runCountryRequest(country, url, events, signal, transportPool),
    ),
  );

  if (signal.aborted) throw abortReason(signal);

  const callbackFailure = settlements.find(
    (settlement): settlement is PromiseRejectedResult =>
      settlement.status === "rejected",
  );
  if (callbackFailure) throw callbackFailure.reason;
}
