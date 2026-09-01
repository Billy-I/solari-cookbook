import type { CaptureFailure, SafeCaptureErrorCode } from "./contracts";

type ErrorLike = {
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

const safeErrors: Record<
  SafeCaptureErrorCode,
  { message: string; retryable: boolean }
> = {
  INVALID_INPUT: {
    message: "Enter a valid public HTTPS URL.",
    retryable: false,
  },
  UNSUPPORTED_COUNTRY: {
    message: "Select a supported capture country.",
    retryable: false,
  },
  PRIVATE_TARGET_BLOCKED: {
    message: "This destination is not a public HTTPS target.",
    retryable: false,
  },
  NAVIGATION_TIMEOUT: {
    message: "The target did not load within the capture limit.",
    retryable: true,
  },
  TARGET_BLOCKED: {
    message: "The target blocked this capture.",
    retryable: false,
  },
  SOLARI_CAPACITY: {
    message: "Solari is temporarily unable to start this capture.",
    retryable: true,
  },
  SOLARI_AUTH: {
    message: "Solari authentication is unavailable.",
    retryable: false,
  },
  SOLARI_PROXY_MISMATCH: {
    message: "Solari returned a proxy country that did not match the request.",
    retryable: false,
  },
  CAPTURE_FAILED: {
    message: "The regional capture could not be completed.",
    retryable: true,
  },
};

function failure(
  code: SafeCaptureErrorCode,
  retryable = safeErrors[code].retryable,
): CaptureFailure {
  return {
    ok: false,
    error: {
      code,
      message: safeErrors[code].message,
      retryable,
    },
  };
}

export function toSafeCaptureFailure(error: unknown): CaptureFailure {
  const candidate =
    typeof error === "object" && error !== null ? (error as ErrorLike) : {};
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const status = typeof candidate.status === "number" ? candidate.status : undefined;

  if (Object.hasOwn(safeErrors, message)) {
    return failure(message as SafeCaptureErrorCode);
  }

  if (candidate.name === "TimeoutError") {
    return failure("NAVIGATION_TIMEOUT");
  }

  if (status === 401 || status === 403) {
    return failure("SOLARI_AUTH");
  }

  if (status === 429) {
    return failure("SOLARI_CAPACITY", false);
  }

  if (status === 502 || status === 503 || status === 504) {
    return failure("SOLARI_CAPACITY");
  }

  return failure("CAPTURE_FAILED");
}
