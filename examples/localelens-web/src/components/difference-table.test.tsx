import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DifferenceTable,
  type ComparedField,
} from "@/src/components/difference-table";

const fields: ComparedField[] = [
  {
    field: "currencies",
    label: "Currency",
    state: "different",
    values: { us: ["USD", "$"], gb: ["GBP", "£"] },
  },
  {
    field: "primaryHeading",
    label: "Primary heading",
    state: "match",
    values: { us: ["Plans"], gb: ["Plans"] },
  },
];

describe("DifferenceTable", () => {
  it("associates headers with cells and writes comparison state as text", () => {
    render(<DifferenceTable countries={["us", "gb"]} fields={fields} />);

    expect(
      screen.getByRole("columnheader", { name: "United States" }),
    ).toHaveAttribute("scope", "col");
    expect(
      screen.getByRole("rowheader", { name: "Currency" }),
    ).toHaveAttribute("scope", "row");
    expect(screen.getByRole("cell", { name: "United States: USD, $" })).toHaveAttribute(
      "headers",
      "field-currencies country-us",
    );
    expect(screen.getByText("Different")).toBeVisible();
    expect(screen.getByText("Match")).toBeVisible();
  });
});
