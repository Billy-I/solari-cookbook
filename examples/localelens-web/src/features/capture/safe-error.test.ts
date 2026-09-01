import { describe, expect, it } from "vitest";

import { toSafeCaptureFailure } from "@/src/features/capture/safe-error";

describe("toSafeCaptureFailure", () => {
  it.each([
    ["INVALID_INPUT", "INVALID_INPUT", false],
    ["UNSUPPORTED_COUNTRY", "UNSUPPORTED_COUNTRY", false],
    ["PRIVATE_TARGET_BLOCKED", "PRIVATE_TARGET_BLOCKED", false],
    ["TARGET_BLOCKED", "TARGET_BLOCKED", false],
    ["SOLARI_AUTH", "SOLARI_AUTH", false],
    ["SOLARI_CAPACITY", "SOLARI_CAPACITY", true],
    ["SOLARI_PROXY_MISMATCH", "SOLARI_PROXY_MISMATCH", false],
  ])("maps the internal %s category", (message, code, retryable) => {
    expect(toSafeCaptureFailure(new Error(message))).toMatchObject({
      ok: false,
      error: { code, retryable },
    });
  });

  it("maps navigation timeouts without returning the target URL", () => {
    const error = new Error("Timeout 30000ms at https://private.example/path");
    error.name = "TimeoutError";

    const result = toSafeCaptureFailure(error);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NAVIGATION_TIMEOUT", retryable: true },
    });
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it.each([
    [401, "SOLARI_AUTH", false],
    [403, "SOLARI_AUTH", false],
    [429, "SOLARI_CAPACITY", false],
    [503, "SOLARI_CAPACITY", true],
  ])("maps provider status %i", (status, code, retryable) => {
    const error = Object.assign(
      new Error("slr_live_sensitive upstream response body"),
      { status },
    );

    const result = toSafeCaptureFailure(error);

    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    expect(JSON.stringify(result)).not.toMatch(/slr_live|upstream response/);
  });

  it("maps unknown failures to one stable safe error", () => {
    const result = toSafeCaptureFailure(
      new Error("provider body with secret and session details"),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "CAPTURE_FAILED",
        message: "The regional capture could not be completed.",
        retryable: true,
      },
    });
  });

  it("does not treat object prototype properties as allowlisted codes", () => {
    expect(toSafeCaptureFailure(new Error("toString"))).toMatchObject({
      ok: false,
      error: { code: "CAPTURE_FAILED" },
    });
  });
});
