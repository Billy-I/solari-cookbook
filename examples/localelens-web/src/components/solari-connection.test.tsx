import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SolariConnection } from "@/src/components/solari-connection";
import type { SolariConnectionController } from "@/src/features/credential/use-solari-connection";

function controller(
  overrides: Partial<SolariConnectionController> = {},
): SolariConnectionController {
  return {
    apiKey: "",
    connect: vi.fn(),
    disconnect: vi.fn(),
    markAuthenticationFailed: vi.fn(),
    message: null,
    ready: false,
    setApiKey: vi.fn(),
    state: "missing",
    ...overrides,
  };
}

describe("SolariConnection", () => {
  it("renders an accessible masked credential form and safety guidance", () => {
    render(<SolariConnection connection={controller()} />);

    expect(screen.getByRole("heading", { name: "Solari connection" })).toBeVisible();
    expect(screen.getByLabelText("Solari API key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Use my Solari key" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Get a Solari API key" })).toHaveAttribute(
      "href",
      "https://console.getsolari.com/",
    );
    expect(screen.getByRole("link", { name: "Get a Solari API key" })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(screen.getByText(/may consume your Solari credits/)).toBeVisible();
    expect(screen.getByText(/does not save it/)).toBeVisible();
    expect(screen.getByText(/newly created key once/)).toBeVisible();
  });

  it("changes local key state without connecting until form submission", () => {
    const setApiKey = vi.fn();
    const connect = vi.fn();
    render(
      <SolariConnection
        connection={controller({ apiKey: "synthetic", connect, setApiKey, state: "entered" })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Solari API key"), {
      target: { value: "synthetic-browser-key-canary" },
    });
    expect(setApiKey).toHaveBeenCalledWith("synthetic-browser-key-canary");
    expect(connect).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("button", { name: "Use my Solari key" }).closest("form")!);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("shows authenticating, ready, failure, and disconnect states without key echoes", () => {
    const { rerender } = render(
      <SolariConnection
        connection={controller({ apiKey: "", state: "authenticating" })}
      />,
    );
    expect(screen.getByRole("button", { name: "Authenticating…" })).toBeDisabled();

    const disconnect = vi.fn();
    rerender(
      <SolariConnection
        connection={controller({ disconnect, ready: true, state: "ready" })}
      />,
    );
    expect(screen.getByText("Ready for this session")).toBeVisible();
    expect(screen.queryByLabelText("Solari API key")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledTimes(1);

    rerender(
      <SolariConnection
        connection={controller({
          message: "Authentication failed",
          state: "authentication_failed",
        })}
      />,
    );
    expect(screen.getByText("Authentication failed")).toBeVisible();
    expect(screen.queryByText(/synthetic-browser-key-canary/)).not.toBeInTheDocument();
  });
});
