import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunReceipt } from "@/src/components/run-receipt";

const value = {
  url: "https://regional.example.test/pricing",
  countries: ["us", "gb"] as const,
};

describe("RunReceipt", () => {
  it("hides run identity before an action creates a run", () => {
    render(
      <RunReceipt
        featured
        mode="sample"
        runId={null}
        status="idle"
        value={{ ...value, countries: [...value.countries] }}
      />,
    );

    expect(screen.queryByText("Run ID")).not.toBeInTheDocument();
  });

  it("shows the safe app run identity after a comparison starts", () => {
    render(
      <RunReceipt
        mode="live"
        runId="llr_123e4567-e89b-42d3-a456-426614174000"
        status="running"
        value={{ ...value, countries: [...value.countries] }}
      />,
    );

    expect(screen.getByText("Run ID")).toBeVisible();
    expect(
      screen.getByText("llr_123e4567-e89b-42d3-a456-426614174000"),
    ).toBeVisible();
  });
});
