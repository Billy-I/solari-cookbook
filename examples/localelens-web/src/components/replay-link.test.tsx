import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplayLink } from "@/src/components/replay-link";

vi.mock("rrweb-player", () => ({
  default: class {
    $destroy() {}
  },
}));

const correlation = {
  runId: "llr_123e4567-e89b-42d3-a456-426614174000",
  country: "us" as const,
  attempt: 1,
  sessionRef: "sol_dab46ee6c619545d0534",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReplayLink", () => {
  it("keeps a pending replay non-clickable and performs one safe correlation lookup", async () => {
    const fetchReplay = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchReplay);
    const { rerender } = render(
      <StrictMode>
        <ReplayLink correlation={correlation} />
      </StrictMode>,
    );

    expect(screen.getByText("Checking replay")).toBeVisible();
    expect(screen.queryByRole("link", { name: /replay/i })).not.toBeInTheDocument();
    rerender(
      <StrictMode>
        <ReplayLink correlation={correlation} />
      </StrictMode>,
    );

    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Replay pending")).toBeVisible();
    expect(fetchReplay).toHaveBeenCalledWith(
      "/api/replays/sol_dab46ee6c619545d0534?runId=llr_123e4567-e89b-42d3-a456-426614174000&country=us&attempt=1",
      expect.objectContaining({
        headers: { "x-localelens-request": "1" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.stringify(fetchReplay.mock.calls)).not.toContain(
      "raw-provider-session-id",
    );
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
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchReplay);

    render(<ReplayLink correlation={correlation} />);

    const recheck = await screen.findByRole("button", { name: "Check replay availability" });
    expect(screen.queryByRole("link", { name: /replay/i })).not.toBeInTheDocument();
    await waitFor(() => expect(recheck).toBeEnabled());
    fireEvent.click(recheck);

    expect(await screen.findByRole("button", { name: "Watch replay" })).toBeVisible();
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

    render(<ReplayLink correlation={correlation} />);

    const recheck = await screen.findByRole("button", { name: "Check replay availability" });
    await waitFor(() => expect(recheck).toBeEnabled());
    fireEvent.click(recheck);
    expect(await screen.findByText("Replay unavailable")).toBeVisible();
    expect(fetchReplay).toHaveBeenCalledTimes(2);
  });

  it("loads replay events only after the user asks to watch", async () => {
    const events = [
      { type: 4, timestamp: 1_000, data: { href: "https://example.com/" } },
      { type: 2, timestamp: 1_001, data: { node: { type: 0, childNodes: [] } } },
    ];
    const fetchReplay = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ready" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ready", events }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchReplay);

    render(<ReplayLink correlation={correlation} />);

    const watch = await screen.findByRole("button", { name: "Watch replay" });
    expect(fetchReplay).toHaveBeenCalledTimes(1);
    fireEvent.click(watch);

    expect(await screen.findByRole("dialog", { name: "Session replay" })).toBeVisible();
    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(2));
    expect(fetchReplay).toHaveBeenLastCalledWith(
      "/api/replays/sol_dab46ee6c619545d0534?runId=llr_123e4567-e89b-42d3-a456-426614174000&country=us&attempt=1&mode=events",
      expect.objectContaining({
        headers: { "x-localelens-request": "1" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await screen.findByText("Replay ready")).toBeVisible();
  });

  it("fails closed for replay JSON that exposes a provider URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: "ready", replayUrl: "https://replay.example.test/" }),
          { status: 200 },
        ),
      ),
    );

    render(
      <StrictMode>
        <ReplayLink correlation={correlation} />
      </StrictMode>,
    );

    expect(await screen.findByText("Replay unavailable")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Watch replay" })).not.toBeInTheDocument();
  });

  it("aborts an unresolved lookup when unmounted", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchReplay = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchReplay);

    const { unmount } = render(<ReplayLink correlation={correlation} />);
    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(1));
    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("aborts an unresolved replay load when the capture correlation changes", async () => {
    let replaySignal: AbortSignal | undefined;
    const fetchReplay = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ready" }), { status: 200 }),
      )
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        replaySignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
      );
    vi.stubGlobal("fetch", fetchReplay);

    const { rerender } = render(<ReplayLink correlation={correlation} />);
    fireEvent.click(await screen.findByRole("button", { name: "Watch replay" }));
    await waitFor(() => expect(fetchReplay).toHaveBeenCalledTimes(2));

    rerender(
      <ReplayLink
        correlation={{
          ...correlation,
          country: "de",
          sessionRef: "sol_1234567890abcdef1234",
        }}
      />,
    );

    await waitFor(() => expect(replaySignal?.aborted).toBe(true));
    expect(screen.queryByRole("dialog", { name: "Session replay" })).not.toBeInTheDocument();
  });
});
