import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditForm } from "@/src/components/audit-form";

describe("AuditForm", () => {
  it("selects the United States and United Kingdom by default", () => {
    render(<AuditForm mode="live" onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: "United States" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "United Kingdom" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Germany" }),
    ).not.toBeChecked();
  });

  it("shows the authoritative catalogue and permits four live markets", () => {
    render(<AuditForm mode="live" onSubmit={vi.fn()} />);

    const unitedStates = screen.getByRole("checkbox", {
      name: "United States",
    });
    const germany = screen.getByRole("checkbox", { name: "Germany" });
    const france = screen.getByRole("checkbox", { name: "France" });

    expect(screen.getAllByRole("checkbox")).toHaveLength(15);
    expect(unitedStates).toBeDisabled();
    fireEvent.click(unitedStates);
    expect(unitedStates).toBeChecked();

    fireEvent.click(germany);
    expect(germany).toBeChecked();
    fireEvent.click(france);
    expect(france).toBeChecked();
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4);
  });

  it("renders an immutable featured demo without editable controls", () => {
    const onSubmit = vi.fn();
    render(<AuditForm mode="sample" onSubmit={onSubmit} />);

    expect(
      screen.getByText("Demo data — this URL will not be visited."),
    ).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "URL (HTTPS)" }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Run featured demo" }));
    expect(onSubmit).toHaveBeenCalledWith({
      url: "https://regional.example.test/pricing",
      countries: ["us", "gb", "de"],
    });
  });

  it.each(["not a url", "http://regional.example.test/pricing"])(
    "focuses one alert and does not submit invalid target %s",
    (url) => {
      const onSubmit = vi.fn();
      render(<AuditForm mode="live" onSubmit={onSubmit} />);

      fireEvent.change(screen.getByRole("textbox", { name: "URL (HTTPS)" }), {
        target: { value: url },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Compare live through Solari" }),
      );

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveFocus();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("submits a trimmed HTTPS URL and countries in display order", () => {
    const onSubmit = vi.fn();
    render(<AuditForm mode="live" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox", { name: "URL (HTTPS)" }), {
      target: { value: "  https://regional.example.test/pricing  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Germany" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare live through Solari" }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      url: "https://regional.example.test/pricing",
      countries: ["de", "gb", "us"],
    });
  });

  it("keeps run values visible while disabling mutations when busy", () => {
    render(<AuditForm busy mode="live" onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: "URL (HTTPS)" }),
    ).toHaveValue("https://regional.example.test/pricing");
    expect(
      screen.getByRole("textbox", { name: "URL (HTTPS)" }),
    ).toBeDisabled();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Compare live through Solari" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Compare live through Solari" })).not.toBeDisabled();
  });

  it("preserves Compare focus and ignores repeat activation while busy", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<AuditForm mode="live" onSubmit={onSubmit} />);
    const compare = screen.getByRole("button", { name: "Compare live through Solari" });
    compare.focus();

    rerender(<AuditForm busy mode="live" onSubmit={onSubmit} />);

    expect(compare).toHaveFocus();
    fireEvent.click(compare);
    fireEvent.click(compare);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
