import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReplayViewer } from "@/src/components/replay-viewer";

const { destroyPlayer, makePlayer } = vi.hoisted(() => ({
  destroyPlayer: vi.fn(),
  makePlayer: vi.fn(),
}));

vi.mock("rrweb-player", () => ({
  default: class {
    constructor(options: unknown) {
      makePlayer(options);
    }

    $destroy() {
      destroyPlayer();
    }
  },
}));

const events = [
  { type: 4, timestamp: 1_000, data: { href: "https://example.com/" } },
  { type: 2, timestamp: 1_001, data: { node: { type: 0, childNodes: [] } } },
];

describe("ReplayViewer", () => {
  it("shows an accessible loading dialog and closes explicitly", () => {
    const onClose = vi.fn();
    render(
      <ReplayViewer
        events={null}
        failed={false}
        onClose={onClose}
        onRetry={vi.fn()}
        sessionRef="sol_dab46ee6c619545d0534"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Session replay" })).toBeVisible();
    expect(screen.getByText("Loading visual replay")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close replay" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("constructs and cleans up the player for validated events", () => {
    const { unmount } = render(
      <ReplayViewer
        events={events}
        failed={false}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        sessionRef="sol_dab46ee6c619545d0534"
      />,
    );

    expect(screen.getByText("Replay ready")).toBeVisible();
    expect(makePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ autoPlay: false, events, showController: true }),
        target: expect.any(HTMLElement),
      }),
    );
    unmount();
    expect(destroyPlayer).toHaveBeenCalledOnce();
  });

  it("offers only an explicit retry after a load failure", () => {
    const onRetry = vi.fn();
    render(
      <ReplayViewer
        events={null}
        failed
        onClose={vi.fn()}
        onRetry={onRetry}
        sessionRef="sol_dab46ee6c619545d0534"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try loading replay again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
