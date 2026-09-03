import { describe, expect, it } from "vitest";

import {
  assertAppRequest,
  isSecureApplicationRequest,
} from "@/src/features/credential/request-security";

function appRequest(
  url = "http://localhost/api/solari-session",
  headers: Record<string, string> = {},
) {
  return new Request(url, { headers });
}

describe("assertAppRequest", () => {
  it("rejects a cross-origin mutation", () => {
    expect(() =>
      assertAppRequest(
        new Request("http://localhost/api/solari-session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://attacker.example",
            "sec-fetch-site": "cross-site",
            "x-localelens-request": "1",
          },
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).toThrowError("CROSS_ORIGIN_REQUEST");
  });

  it.each([undefined, "0"])(
    "rejects a missing or wrong custom request header: %s",
    (value) => {
      const headers: Record<string, string> = { origin: "http://localhost" };
      if (value !== undefined) headers["x-localelens-request"] = value;

      expect(() =>
        assertAppRequest(appRequest(undefined, headers), {
          requireOrigin: true,
        }),
      ).toThrowError("INVALID_LOCAL_REQUEST");
    },
  );

  it("accepts an exact same-origin JSON mutation", () => {
    expect(() =>
      assertAppRequest(
        new Request("http://localhost/api/solari-session", {
          method: "POST",
          headers: {
            "content-type": "application/json; charset=utf-8",
            origin: "http://localhost",
            "sec-fetch-site": "same-origin",
            "x-localelens-request": "1",
          },
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).not.toThrow();
  });

  it("uses the incoming Host when Next canonicalizes the request URL", () => {
    expect(() =>
      assertAppRequest(
        new Request("http://localhost/api/solari-session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            host: "127.0.0.1:34124",
            origin: "http://127.0.0.1:34124",
            "x-forwarded-proto": "http",
            "x-localelens-request": "1",
          },
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).not.toThrow();
  });

  it("reconstructs an HTTPS origin without accepting a different host", () => {
    const headers = {
      "content-type": "application/json",
      host: "app.example.test",
      origin: "https://app.example.test",
      "x-forwarded-proto": "https",
      "x-localelens-request": "1",
    };
    expect(() =>
      assertAppRequest(
        new Request("http://localhost/api/solari-session", {
          method: "POST",
          headers,
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).not.toThrow();
    expect(() =>
      assertAppRequest(
        new Request("http://localhost/api/solari-session", {
          method: "POST",
          headers: { ...headers, origin: "https://other.example.test" },
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).toThrowError("CROSS_ORIGIN_REQUEST");
  });

  it("permits a missing Origin only when the operation does not require it", () => {
    expect(() =>
      assertAppRequest(
        appRequest(undefined, { "x-localelens-request": "1" }),
        { requireOrigin: false },
      ),
    ).not.toThrow();
    expect(() =>
      assertAppRequest(
        appRequest(undefined, { "x-localelens-request": "1" }),
        { requireOrigin: true },
      ),
    ).toThrowError("CROSS_ORIGIN_REQUEST");
  });

  it("rejects a wrong content type and a non-same-origin fetch site", () => {
    expect(() =>
      assertAppRequest(
        appRequest(undefined, {
          "content-type": "text/plain",
          origin: "http://localhost",
          "x-localelens-request": "1",
        }),
        { requireJson: true, requireOrigin: true },
      ),
    ).toThrowError("INVALID_CONTENT_TYPE");
    expect(() =>
      assertAppRequest(
        appRequest(undefined, {
          "sec-fetch-site": "none",
          "x-localelens-request": "1",
        }),
        { requireOrigin: false },
      ),
    ).toThrowError("CROSS_ORIGIN_REQUEST");
  });
});

describe("isSecureApplicationRequest", () => {
  it("allows HTTPS and local HTTP development hosts", () => {
    expect(isSecureApplicationRequest(appRequest("https://example.com/"))).toBe(
      true,
    );
    expect(isSecureApplicationRequest(appRequest("http://localhost/"))).toBe(
      true,
    );
    expect(isSecureApplicationRequest(appRequest("http://127.0.0.1/"))).toBe(
      true,
    );
    expect(isSecureApplicationRequest(appRequest("http://[::1]/"))).toBe(true);
  });

  it("accepts exactly one trusted HTTPS forwarded protocol", () => {
    expect(
      isSecureApplicationRequest(
        appRequest("http://example.com/", { "x-forwarded-proto": "https" }),
      ),
    ).toBe(true);
  });

  it("allows Next's forwarded HTTP header on a loopback development host", () => {
    expect(
      isSecureApplicationRequest(
        appRequest("http://127.0.0.1/", { "x-forwarded-proto": "http" }),
      ),
    ).toBe(true);
  });

  it.each([undefined, "http", "https,http", "https, https"])(
    "rejects insecure or ambiguous hosted protocol: %s",
    (forwardedProtocol) => {
      const headers: Record<string, string> = {};
      if (forwardedProtocol !== undefined) {
        headers["x-forwarded-proto"] = forwardedProtocol;
      }
      expect(
        isSecureApplicationRequest(appRequest("http://example.com/", headers)),
      ).toBe(false);
    },
  );
});
