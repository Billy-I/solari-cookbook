import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "@/app/page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocaleLens comparison page", () => {
  it("starts with the connection gate and no sample or evidence surfaces", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: "missing" }));
    vi.stubGlobal("fetch", fetch);
    render(<Page />);

    expect(screen.getByRole("heading", { name: "Solari connection" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Compare the experience by market" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Solari API key")).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Use my Solari key" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Compare live through Solari" }),
    ).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Run evidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Regional results" })).not.toBeInTheDocument();
    expect(screen.queryByText(/sample|demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText("regional.example.test")).not.toBeInTheDocument();
    expect(screen.queryByText(/mode/i)).not.toBeInTheDocument();
  });

  it("does not authenticate or capture when a key is only typed or pasted", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: "missing" }));
    vi.stubGlobal("fetch", fetch);
    render(<Page />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Solari API key"), {
      target: { value: "synthetic-browser-key-canary" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Run evidence" })).not.toBeInTheDocument();
  });

  it("enables comparison only after a ready session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "ready" })),
    );
    render(<Page />);

    await waitFor(() =>
      expect(screen.getByText("Ready for this session")).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: "Compare live through Solari" }),
    ).toBeEnabled();
  });

  it("keeps invalid authentication out of the evidence UI", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "missing" }))
      .mockResolvedValueOnce(
        jsonResponse(
          { status: "authentication_failed", message: "unsafe provider body" },
          401,
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<Page />);
    await waitFor(() => screen.getByRole("button", { name: "Use my Solari key" }));
    fireEvent.change(screen.getByLabelText("Solari API key"), {
      target: { value: "synthetic-browser-key-canary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use my Solari key" }));

    await waitFor(() => expect(screen.getByText("Authentication failed")).toBeVisible());
    expect(screen.queryByText("unsafe provider body")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Run evidence" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates the visible connection after a SOLARI_AUTH capture failure", async () => {
    const authFailure = {
      ok: false,
      correlation: null,
      error: {
        code: "SOLARI_AUTH",
        message: "Solari authentication is required.",
        retryable: false,
      },
    };
    const fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/solari-session") {
        return Promise.resolve(jsonResponse({ status: "ready" }));
      }
      return Promise.resolve(jsonResponse(authFailure, 401));
    });
    vi.stubGlobal("fetch", fetch);
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Ready for this session")).toBeVisible());
    fireEvent.change(screen.getByRole("textbox", { name: "URL (HTTPS)" }), {
      target: { value: "https://public.example.test/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Compare live through Solari" }));

    await waitFor(() => expect(screen.getByText("Authentication failed")).toBeVisible());
    expect(screen.getByRole("region", { name: "Run evidence" })).toBeVisible();
  });
});
