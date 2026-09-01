import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DifferenceTable,
} from "@/src/components/difference-table";
import type { DifferenceRow } from "@/src/features/compare/compare-evidence";

const fields: DifferenceRow[] = [
  {
    field: "currency",
    kind: "different",
    values: { us: "USD, $", gb: "GBP, £" },
  },
  {
    field: "heading",
    kind: "same",
    values: { us: "Plans", gb: "Plans" },
  },
];

describe("DifferenceTable", () => {
  it("associates headers with cells and writes comparison state as text", () => {
    render(<DifferenceTable countries={["us", "gb"]} fields={fields} />);

    expect(
      screen.getByRole("columnheader", { name: "United States" }),
    ).toHaveAttribute("scope", "col");
    expect(screen.getByRole("rowheader", { name: "Currency" })).toHaveAttribute(
      "scope",
      "row",
    );
    expect(screen.getByRole("cell", { name: "United States: USD, $" })).toHaveAttribute(
      "headers",
      "field-currency country-us",
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Different")).toBeVisible();
    expect(within(table).getByText("Same")).toBeVisible();
  });

  it("provides a labeled definition list alternative for compact screens", () => {
    render(<DifferenceTable countries={["us", "gb"]} fields={fields} />);

    const compact = screen.getByLabelText(
      "Captured field differences by market, compact view",
    );
    const currency = within(compact).getByText("Currency");
    const values = currency.nextElementSibling;

    expect(compact).toBeInstanceOf(HTMLDListElement);
    expect(currency).toBeInstanceOf(HTMLElement);
    expect(currency.tagName).toBe("DT");
    expect(values?.tagName).toBe("DD");
    expect(values?.firstElementChild).toBeInstanceOf(HTMLDListElement);
    expect(
      within(values as HTMLElement).getByText("United States").nextElementSibling,
    ).toHaveTextContent("USD, $");
  });
});
