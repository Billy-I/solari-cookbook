import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientClose,
  clientRequest,
  createSolariClient,
  sessionsCreate,
  sessionsDelete,
  sessionsResolve,
} = vi.hoisted(() => ({
  clientClose: vi.fn(),
  clientRequest: vi.fn(),
  createSolariClient: vi.fn(),
  sessionsCreate: vi.fn(),
  sessionsDelete: vi.fn(),
  sessionsResolve: vi.fn(),
}));

vi.mock("@/src/lib/solari", () => ({ createSolariClient }));
vi.mock("@/src/features/credential/credential-session-store", () => ({
  credentialSessionStore: {
    create: sessionsCreate,
    delete: sessionsDelete,
    resolve: sessionsResolve,
  },
}));

import {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
} from "@/app/api/solari-session/route";

const baseUrl = "http://localhost/api/solari-session";
const requestHeaders = {
  "content-type": "application/json",
  origin: "http://localhost",
  "sec-fetch-site": "same-origin",
  "x-localelens-request": "1",
};

function request(
  method: string,
  options: { body?: string; cookie?: string; url?: string; headers?: HeadersInit } = {},
) {
  const headers = new Headers(options.headers ?? requestHeaders);
  if (options.cookie) headers.set("cookie", options.cookie);
  return new NextRequest(options.url ?? baseUrl, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

function providerResponse(
  status: number,
  cancel = vi.fn().mockResolvedValue(undefined),
) {
  return {
    body: { cancel },
    status,
  } as unknown as Response;
}

async function expectNoStore(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
}

beforeEach(() => {
  createSolariClient.mockReturnValue({
    close: clientClose,
    request: clientRequest,
  });
  clientClose.mockResolvedValue(undefined);
  clientRequest.mockResolvedValue(providerResponse(204));
  sessionsCreate.mockReturnValue({
    ownerId: "a".repeat(64),
    token: Buffer.alloc(32, 7).toString("base64url"),
  });
  sessionsDelete.mockReturnValue(null);
  sessionsResolve.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/solari-session", () => {
  it("authenticates explicitly, discards the provider body, and stores no key in output", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    clientRequest.mockResolvedValue(providerResponse(200, cancel));

    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-user-auth-canary" }),
      }),
    );

    expect(createSolariClient).toHaveBeenCalledWith(
      "synthetic-user-auth-canary",
    );
    expect(clientRequest).toHaveBeenCalledOnce();
    expect(clientRequest).toHaveBeenCalledWith("GET", "/profiles");
    expect(cancel).toHaveBeenCalledOnce();
    expect(clientClose).toHaveBeenCalledOnce();
    expect(sessionsCreate).toHaveBeenCalledWith(
      "synthetic-user-auth-canary",
    );
    expect(await response.json()).toEqual({ status: "ready" });
    expect(response.headers.getSetCookie()[0]).toContain(
      "localelens_session=",
    );
    expect(JSON.stringify([...response.headers])).not.toContain(
      "synthetic-user-auth-canary",
    );
    expect(response.url).not.toContain("synthetic-user-auth-canary");
    await expectNoStore(response);
  });

  it.each([401, 403])(
    "stores nothing and clears the previous session after %s authentication",
    async (status) => {
      clientRequest.mockResolvedValue(providerResponse(status));
      sessionsDelete.mockReturnValue("b".repeat(64));

      const response = await POST(
        request("POST", {
          body: JSON.stringify({ apiKey: "synthetic-rejected-key" }),
          cookie: "localelens_session=prior-token",
        }),
      );

      expect(sessionsCreate).not.toHaveBeenCalled();
      expect(sessionsDelete).toHaveBeenCalledWith("prior-token");
      expect(await response.json()).toEqual({
        status: "authentication_failed",
        message: "Solari could not authenticate that key.",
      });
      expect(response.headers.getSetCookie()[0]).toContain(
        "localelens_session=;",
      );
      expect(clientClose).toHaveBeenCalledOnce();
    },
  );

  it.each([429, 500])("maps provider status %s to unavailable", async (status) => {
    clientRequest.mockResolvedValue(providerResponse(status));

    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-unavailable-key" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "authentication_unavailable",
      message: "Solari authentication is temporarily unavailable.",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(clientClose).toHaveBeenCalledOnce();
  });

  it("maps transport failure safely, closes the client, and never retries", async () => {
    clientRequest.mockRejectedValue(new Error("synthetic provider body secret"));

    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-transport-key" }),
      }),
    );

    expect(clientRequest).toHaveBeenCalledOnce();
    expect(clientClose).toHaveBeenCalledOnce();
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(
      "synthetic provider body secret",
    );
  });

  it("rotates a prior session only after successful authentication", async () => {
    sessionsDelete.mockReturnValue("b".repeat(64));

    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-rotated-key" }),
        cookie: "localelens_session=prior-token",
      }),
    );

    expect(sessionsDelete).toHaveBeenCalledWith("prior-token");
    expect(response.headers.getSetCookie()[0]).not.toContain("prior-token");
  });

  it("fails closed when the bounded store is saturated", async () => {
    sessionsCreate.mockReturnValue(null);

    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-capacity-key" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "authentication_unavailable",
    });
    expect(response.headers.getSetCookie()[0]).toContain(
      "localelens_session=;",
    );
  });

  it.each([
    ["invalid JSON", "{"],
    ["an extra field", JSON.stringify({ apiKey: "synthetic", extra: true })],
    ["an empty key", JSON.stringify({ apiKey: "" })],
    ["an overlong key", JSON.stringify({ apiKey: "x".repeat(513) })],
  ])("rejects %s before provider work", async (_label, body) => {
    const response = await POST(request("POST", { body }));

    expect(response.status).toBe(400);
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before provider work", async () => {
    const body = JSON.stringify({ apiKey: "x".repeat(2_100) });
    const response = await POST(
      request("POST", {
        body,
        headers: { ...requestHeaders, "content-length": String(body.length) },
      }),
    );

    expect(response.status).toBe(413);
    expect(createSolariClient).not.toHaveBeenCalled();
  });

  it.each([
    ["cross-origin", { ...requestHeaders, origin: "http://attacker.example" }],
    ["wrong content type", { ...requestHeaders, "content-type": "text/plain" }],
  ])("rejects %s requests before store or provider access", async (_label, headers) => {
    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-rejected-key" }),
        headers,
      }),
    );

    expect(response.status).toBe(400);
    expect(createSolariClient).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(sessionsDelete).not.toHaveBeenCalled();
  });

  it("fails closed on hosted HTTP before provider work", async () => {
    const response = await POST(
      request("POST", {
        body: JSON.stringify({ apiKey: "synthetic-insecure-key" }),
        url: "http://example.com/api/solari-session",
        headers: {
          ...requestHeaders,
          origin: "http://example.com",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(createSolariClient).not.toHaveBeenCalled();
  });
});

describe("credential lifecycle status and disconnect", () => {
  it("returns only ready or missing and clears an expired cookie", async () => {
    sessionsResolve.mockReturnValueOnce({
      apiKey: "synthetic-server-only-key",
      ownerId: "a".repeat(64),
    });
    const ready = await GET(
      request("GET", { cookie: "localelens_session=ready-token" }),
    );
    expect(await ready.json()).toEqual({ status: "ready" });
    expect(JSON.stringify(await GET(
      request("GET", { cookie: "localelens_session=missing-token" }),
    ).then((response) => response.json()))).toBe('{"status":"missing"}');
  });

  it("disconnects idempotently and returns an empty no-store response", async () => {
    sessionsDelete.mockReturnValueOnce("a".repeat(64)).mockReturnValueOnce(null);

    for (let index = 0; index < 2; index += 1) {
      const response = await DELETE(
        request("DELETE", { cookie: "localelens_session=opaque-token" }),
      );
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(response.headers.getSetCookie()[0]).toContain(
        "localelens_session=;",
      );
      await expectNoStore(response);
    }
  });
});

describe("credential lifecycle methods", () => {
  it("returns safe no-store method responses and an empty OPTIONS response", async () => {
    for (const handler of [HEAD, PUT, PATCH]) {
      const response = handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET, POST, DELETE, OPTIONS");
      await expectNoStore(response);
    }
    const options = OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("Allow")).toBe("GET, POST, DELETE, OPTIONS");
    await expectNoStore(options);
  });
});
