import type { AuditFormValue } from "@/src/components/audit-form";
import {
  SUPPORTED_COUNTRIES,
  captureResponseSchema,
  type CaptureFailure,
  type CaptureResponse,
  type SupportedCountry,
} from "@/src/features/capture/contracts";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";

const clientTimeoutMs = 45_000;
const maximumUnresolvedTransports = 3;

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
    const parsed = captureResponseSchema.safeParse(body);

    if (signal.aborted) throw abortReason(signal);
    if (
      parsed.success &&
      response.ok &&
      parsed.data.ok &&
      parsed.data.receipt.country === country &&
      parsed.data.receipt.proxyCountry === country
    ) {
      outcome = { type: "succeeded", response: parsed.data };
    } else if (
      parsed.success &&
      parsed.data.ok &&
      (parsed.data.receipt.country !== country ||
        parsed.data.receipt.proxyCountry !== country)
    ) {
      outcome = {
        type: "failed",
        error: safeError("SOLARI_PROXY_MISMATCH"),
      };
    } else {
      outcome = {
        type: "failed",
        error:
          parsed.success && !parsed.data.ok
            ? parsed.data.error
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
