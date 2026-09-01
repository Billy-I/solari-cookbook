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
  });

  it("identifies live provenance and never fills pending live countries with samples", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "live");
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<Page />);

    expect(screen.getByText("Live Solari capture", { exact: true })).toBeVisible();
    expect(screen.queryByText("Sample evidence", { exact: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compare markets" }));

    expect(screen.getAllByText("Launching browser")).toHaveLength(2);
    expect(
      screen.queryByRole("article", { name: "United States regional evidence" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "United Kingdom regional evidence" }),
    ).not.toBeInTheDocument();
  });
});
