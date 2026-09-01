import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "@/app/page";

describe("LocaleLens foundation page", () => {
  it("states the Phase 0 boundary without product controls", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { name: "LocaleLens" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Foundation ready. Visual experience begins in Phase 1.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /compare/i }),
    ).not.toBeInTheDocument();
  });
});
