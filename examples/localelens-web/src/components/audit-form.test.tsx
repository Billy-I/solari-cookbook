import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditForm } from "@/src/components/audit-form";

describe("AuditForm", () => {
  it("selects the United States and United Kingdom by default", () => {
    render(<AuditForm onSubmit={vi.fn()} />);

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

  it("prevents selecting fewer than two or more than three countries", () => {
    render(<AuditForm onSubmit={vi.fn()} />);

    const unitedStates = screen.getByRole("checkbox", {
      name: "United States",
    });
    const germany = screen.getByRole("checkbox", { name: "Germany" });
    const france = screen.getByRole("checkbox", { name: "France" });

    expect(unitedStates).toBeDisabled();
    fireEvent.click(unitedStates);
    expect(unitedStates).toBeChecked();

    fireEvent.click(germany);
    expect(germany).toBeChecked();
    expect(france).toBeDisabled();
    fireEvent.click(france);
    expect(france).not.toBeChecked();
  });

  it.each(["not a url", "http://regional.example.test/pricing"])(
    "focuses one alert and does not submit invalid target %s",
    (url) => {
      const onSubmit = vi.fn();
      render(<AuditForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByRole("textbox", { name: "URL (HTTPS)" }), {
        target: { value: url },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Compare markets" }),
      );

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveFocus();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("submits a trimmed HTTPS URL and countries in display order", () => {
    const onSubmit = vi.fn();
    render(<AuditForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox", { name: "URL (HTTPS)" }), {
      target: { value: "  https://regional.example.test/pricing  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Germany" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare markets" }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      url: "https://regional.example.test/pricing",
      countries: ["us", "gb", "de"],
    });
  });

  it("keeps run values visible while disabling mutations when busy", () => {
    render(<AuditForm busy onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: "URL (HTTPS)" }),
    ).toHaveValue("https://regional.example.test/pricing");
    expect(
      screen.getByRole("textbox", { name: "URL (HTTPS)" }),
    ).toBeDisabled();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    expect(
      screen.getByRole("button", { name: "Compare markets" }),
    ).toBeDisabled();
  });
});
