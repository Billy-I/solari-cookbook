import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "@/app/page";

describe("LocaleLens sample page", () => {
  it("presents the complete comparison-page structure", () => {
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
  });
});
