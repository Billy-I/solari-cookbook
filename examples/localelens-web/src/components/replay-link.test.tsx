import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplayLink } from "@/src/components/replay-link";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReplayLink", () => {
  it("keeps a pending replay non-clickable and performs one lookup per session", async () => {
    const fetchReplay = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchReplay);
    const { rerender } = render(
      <StrictMode>
        <ReplayLink sessionId="capture-session-001" />
      </StrictMode>,
    );

    expect(screen.getByText("Replay pending")).toBeVisible();
    expect(screen.queryByRole("link", { name: /replay/i })).not.toBeInTheDocument();
    rerender(
      <StrictMode>
        <ReplayLink sessionId="capture-session-001" />
      </StrictMode>,
    );

    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(1));
  });

  it("re-checks a pending replay only when the user asks and can become ready", async () => {
    const fetchReplay = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ready",
            replayUrl: "https://replay.example.test/session?token=temporary",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchReplay);

    render(<ReplayLink sessionId="capture-session-006" />);

    const recheck = await screen.findByRole("button", { name: "Re-check replay" });
    expect(screen.queryByRole("link", { name: /replay/i })).not.toBeInTheDocument();
    fireEvent.click(recheck);

    expect(await screen.findByRole("link", { name: "Open replay" })).toBeVisible();
    expect(fetchReplay).toHaveBeenCalledTimes(2);
  });

  it("can re-check a pending replay to unavailable", async () => {
    const fetchReplay = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "unavailable" }), { status: 503 }),
      );
    vi.stubGlobal("fetch", fetchReplay);

    render(<ReplayLink sessionId="capture-session-007" />);

    fireEvent.click(await screen.findByRole("button", { name: "Re-check replay" }));
    expect(await screen.findByText("Replay unavailable")).toBeVisible();
    expect(fetchReplay).toHaveBeenCalledTimes(2);
  });

  it("opens only a validated server HTTPS replay URL safely", async () => {
    const fetchReplay = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ready",
          replayUrl: "https://replay.example.test/session?token=temporary",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchReplay);

    render(
      <StrictMode>
        <ReplayLink sessionId="capture-session-002" />
      </StrictMode>,
    );

    const link = await screen.findByRole("link", { name: "Open replay" });
    expect(fetchReplay).toHaveBeenCalledTimes(1);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute(
      "href",
      "https://replay.example.test/session?token=temporary",
    );
  });

  it("fails closed for unsafe replay JSON without displaying a URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: "ready", replayUrl: "http://replay.example.test/" }),
          { status: 200 },
        ),
      ),
    );

    render(
      <StrictMode>
        <ReplayLink sessionId="capture-session-003" />
      </StrictMode>,
    );

    expect(await screen.findByText("Replay unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: /replay/i })).not.toBeInTheDocument();
  });

  it.each([
    "https://user:pass@replay.example.test/",
    "https://replay.example.test:444/",
    "https://replay.example.test/#fragment",
  ])("rejects an unsafe HTTPS replay URL", async (replayUrl) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ready", replayUrl }), { status: 200 }),
      ),
    );

    render(<ReplayLink sessionId="capture-session-004" />);

    expect(await screen.findByText("Replay unavailable")).toBeVisible();
  });

  it("aborts an unresolved lookup when unmounted", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchReplay = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchReplay);

    const { unmount } = render(<ReplayLink sessionId="capture-session-005" />);
    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(1));
    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
