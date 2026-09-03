import { fireEvent, render, screen, within } from "@testing-library/react";
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
    fireEvent.click(screen.getByText("Screenshots and regional evidence"));
    expect(
      screen.getAllByRole("article", { name: /regional evidence/i }),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole("region", { name: "Run evidence" })).getByText(
        "Featured sample",
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Evidence appears as each regional capture settles."),
    ).toBeVisible();
    expect(screen.getByText("Replay availability is temporary.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Print evidence" })).toBeEnabled();
    expect(screen.getByText("Complete report: 3 captures succeeded.")).toBeVisible();
    expect(
      screen.queryByText("Replay unavailable in Phase 1"),
    ).not.toBeInTheDocument();
  });

  it("separates the featured sample preview from the next run controls", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "sample");
    render(<Page />);

    const runEvidence = screen.getByRole("region", { name: "Run evidence" });
    expect(
      within(runEvidence).getByText("Featured sample", { exact: true }),
    ).toBeVisible();
    expect(
      within(runEvidence).getByText("Preview", { exact: true }),
    ).toBeVisible();
    expect(screen.getByText("Demo data — this URL will not be visited.")).toBeVisible();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run featured demo" })).toBeVisible();
  });

  it("labels featured fixtures as a preview until a live run starts", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "live");
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<Page />);

    expect(screen.getByText("Live through Solari.")).toBeVisible();
    expect(screen.getAllByRole("checkbox")).toHaveLength(15);

    expect(
      within(screen.getByRole("region", { name: "Run evidence" })).getByText(
        "Featured sample",
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Live Solari capture", { exact: true }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Compare live through Solari" }),
    );

    expect(screen.getByText("Live Solari capture", { exact: true })).toBeVisible();
    expect(screen.getByText("Run ID", { exact: true })).toBeVisible();
    expect(screen.getByText(/^llr_[0-9a-f-]{36}$/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cancel comparison" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Featured sample", { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Launching browser")).toHaveLength(4);
    expect(
      screen.queryByRole("article", { name: "United States regional evidence" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "United Kingdom regional evidence" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Print evidence" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel comparison" }));
    expect(screen.getAllByText("Cancelled")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Cancel comparison" }),
    ).not.toBeInTheDocument();
  });
});
