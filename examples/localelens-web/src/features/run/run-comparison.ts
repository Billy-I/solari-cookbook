import type { AuditFormValue } from "@/src/components/audit-form";
import {
  SUPPORTED_COUNTRIES,
  captureResponseSchema,
  type CaptureFailure,
  type CaptureResponse,
  type SupportedCountry,
} from "@/src/features/capture/contracts";
import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";

const clientTimeoutMs = 45_000;

export type PublicCaptureError = CaptureFailure["error"];

export type RunEvents = {
  started(country: SupportedCountry): void;
  succeeded(country: SupportedCountry, response: CaptureResponse): void;
  failed(country: SupportedCountry, error: PublicCaptureError): void;
};

function safeError(code: "NAVIGATION_TIMEOUT" | "CAPTURE_FAILED"): PublicCaptureError {
  return toSafeCaptureFailure(new Error(code)).error;
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

async function runCountry(
  country: SupportedCountry,
  url: string,
  events: RunEvents,
  signal: AbortSignal,
): Promise<void> {
  events.started(country);

  let outcome:
    | { type: "succeeded"; response: CaptureResponse }
    | { type: "failed"; error: PublicCaptureError };

  try {
    const { response, body } = await settleRequest(
      (async () => {
        const response = await fetch("/api/captures", {
          body: JSON.stringify({ country, url }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal,
        });
        return { response, body: await response.json() };
      })(),
      signal,
    );
    const parsed = captureResponseSchema.safeParse(body);

    if (signal.aborted) throw abortReason(signal);
    if (parsed.success && response.ok && parsed.data.ok) {
      outcome = { type: "succeeded", response: parsed.data };
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
        error instanceof Error && error.message === "NAVIGATION_TIMEOUT"
          ? safeError("NAVIGATION_TIMEOUT")
          : safeError("CAPTURE_FAILED"),
    };
  }

  if (outcome.type === "succeeded") events.succeeded(country, outcome.response);
  else events.failed(country, outcome.error);
}

function selectedCountries(input: AuditFormValue): SupportedCountry[] {
  const countries = input.countries as readonly string[];
  const uniqueCountries = new Set(countries);

  if (
    countries.length < 2 ||
    countries.length > 3 ||
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
): Promise<void> {
  const countries = selectedCountries(input);
  const url = new URL(input.url.trim()).toString();

  const settlements = await Promise.allSettled(
    countries.map((country) => runCountry(country, url, events, signal)),
  );

  if (signal.aborted) throw abortReason(signal);

  const callbackFailure = settlements.find(
    (settlement): settlement is PromiseRejectedResult =>
      settlement.status === "rejected",
  );
  if (callbackFailure) throw callbackFailure.reason;
}
