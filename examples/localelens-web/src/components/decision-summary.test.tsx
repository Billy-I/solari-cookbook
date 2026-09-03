import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionSummary } from "@/src/components/decision-summary";
import type { DecisionSignal } from "@/src/features/compare/summarize-comparison";

const signals: DecisionSignal[] = [
  {
    category: "availability",
    state: "attention",
    title: "Evidence availability",
    detail: "2 successful · 1 failed across 3 selected markets.",
  },
  {
    category: "routing",
    state: "consistent",
    title: "Routing",
    detail: "Successful markets resolved to the same final URL.",
  },
  {
    category: "localization",
    state: "attention",
    title: "Localization",
    detail: "Successful markets differ in language or pricing evidence.",
  },
  {
    category: "consent",
    state: "unavailable",
    title: "Consent",
    detail: "At least two successful captures are needed to compare consent.",
  },
];

describe("DecisionSummary", () => {
  it("presents all four signals under the What changed heading", () => {
    render(<DecisionSummary signals={signals} />);

    expect(screen.getByRole("heading", { name: "What changed" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Decision signals" })).toBeVisible();
    expect(screen.getByText("Evidence availability")).toBeVisible();
    expect(screen.getByText("Localization")).toBeVisible();
    expect(screen.getAllByText("Needs attention")).toHaveLength(2);
    expect(screen.getByText("Not enough evidence")).toBeVisible();
  });
});
