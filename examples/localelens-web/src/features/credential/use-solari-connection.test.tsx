import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSolariConnection } from "@/src/features/credential/use-solari-connection";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSolariConnection", () => {
  it("bootstraps the local credential-session status", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: "missing" }));
    vi.stubGlobal("fetch", fetch);

    const { result } = renderHook(() => useSolariConnection());

    expect(result.current.state).toBe("checking");
    await waitFor(() => expect(result.current.state).toBe("missing"));
    expect(fetch).toHaveBeenCalledWith("/api/solari-session", {
      cache: "no-store",
      headers: { "x-localelens-request": "1" },
      signal: expect.any(AbortSignal),
    });
  });

  it("does not authenticate while a key is merely entered", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: "missing" }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("missing"));

    act(() => result.current.setApiKey("synthetic-browser-key-canary"));

    expect(result.current.state).toBe("entered");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("authenticates explicitly and clears the key from React state", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "missing" }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready" }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("missing"));
    act(() => result.current.setApiKey("synthetic-browser-key-canary"));

    await act(async () => result.current.connect());

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/solari-session",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-localelens-request": "1",
        },
        body: JSON.stringify({ apiKey: "synthetic-browser-key-canary" }),
      }),
    );
    expect(result.current.apiKey).toBe("");
    expect(result.current.state).toBe("ready");
    expect(result.current.ready).toBe(true);
  });

  it.each([
    [{ unexpected: true }],
    [{ status: "ready", extra: true }],
    [{ status: "authentication_failed", message: "safe", extra: true }],
  ])("fails closed for malformed status response %#", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body)));
    const { result } = renderHook(() => useSolariConnection());

    await waitFor(() =>
      expect(result.current.state).toBe("authentication_unavailable"),
    );
    expect(result.current.message).not.toContain(JSON.stringify(body));
  });

  it("fails closed when the status request is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("key-like-sentinel")));
    const { result } = renderHook(() => useSolariConnection());

    await waitFor(() =>
      expect(result.current.state).toBe("authentication_unavailable"),
    );
    expect(result.current.message).not.toContain("key-like-sentinel");
  });

  it.each([
    ["authentication_failed", "Authentication failed"],
    ["authentication_unavailable", "Authentication is unavailable"],
  ] as const)("uses a fixed message for %s", async (status, expectedMessage) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "missing" }))
      .mockResolvedValueOnce(
        jsonResponse({ status, message: "synthetic-browser-key-canary echoed" }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("missing"));
    act(() => result.current.setApiKey("synthetic-browser-key-canary"));

    await act(async () => result.current.connect());

    expect(result.current.state).toBe(status);
    expect(result.current.message).toBe(expectedMessage);
    expect(result.current.message).not.toContain("synthetic-browser-key-canary");
    expect(result.current.apiKey).toBe("");
  });

  it("prevents a double connection submission", async () => {
    let resolveConnect!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "missing" }))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveConnect = resolve; }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("missing"));
    act(() => result.current.setApiKey("synthetic-browser-key-canary"));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.connect();
      second = result.current.connect();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    resolveConnect(jsonResponse({ status: "ready" }));
    await act(async () => Promise.all([first, second]));
    expect(result.current.state).toBe("ready");
  });

  it("aborts an in-flight request when unmounted", async () => {
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init!.signal as AbortSignal;
        return new Promise<Response>(() => undefined);
      }),
    );
    const { unmount } = renderHook(() => useSolariConnection());

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("disconnects and returns to missing even when DELETE fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready" }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    await act(async () => result.current.disconnect());

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/solari-session",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result.current.state).toBe("missing");
    expect(result.current.apiKey).toBe("");
  });

  it("restores entry after a failure and supports runtime auth invalidation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "ready" })),
    );
    const { result } = renderHook(() => useSolariConnection());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => result.current.markAuthenticationFailed());
    expect(result.current.state).toBe("authentication_failed");
    act(() => result.current.setApiKey("replacement-synthetic-key"));
    expect(result.current.state).toBe("entered");
    expect(result.current.message).toBeNull();
  });
});
