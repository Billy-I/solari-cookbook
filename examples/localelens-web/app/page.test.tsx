import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "@/app/page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LocaleLens comparison page", () => {
  it("presents the complete comparison-page structure", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "sample");
    render(<Page />);

    expect(
      screen.getByRole("heading", {
        name: "Compare the experience by market",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Run comparison" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Run evidence" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Regional results" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("article", { name: /regional evidence/i }),
    ).toHaveLength(3);
    expect(screen.getByText("Sample evidence", { exact: true })).toBeVisible();
    expect(
      screen.getByText("Evidence appears as each regional capture settles."),
    ).toBeVisible();
    expect(screen.getByText("Replay availability is temporary.")).toBeVisible();
    expect(
      screen.queryByText("Replay unavailable in Phase 1"),
    ).not.toBeInTheDocument();
  });

  it("labels featured fixtures as sample evidence until a live run starts", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "live");
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<Page />);

    expect(screen.getByText("Sample evidence", { exact: true })).toBeVisible();
    expect(
      screen.queryByText("Live Solari capture", { exact: true }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compare markets" }));

    expect(screen.getByText("Live Solari capture", { exact: true })).toBeVisible();
    expect(
      screen.queryByText("Sample evidence", { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Launching browser")).toHaveLength(4);
    expect(
      screen.queryByRole("article", { name: "United States regional evidence" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "United Kingdom regional evidence" }),
    ).not.toBeInTheDocument();
  });
});
