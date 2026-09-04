import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditForm } from "@/src/components/audit-form";

describe("AuditForm", () => {
  it("selects the United States and United Kingdom by default", () => {
    render(
      <AuditForm connectionReady onNeedsConnection={vi.fn()} onSubmit={vi.fn()} />,
    );

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
    render(
      <AuditForm connectionReady onNeedsConnection={vi.fn()} onSubmit={vi.fn()} />,
    );

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

  it("keeps inputs available but gates comparison until Solari is connected", () => {
    const onSubmit = vi.fn();
    const onNeedsConnection = vi.fn();
    render(
      <AuditForm
        connectionReady={false}
        onNeedsConnection={onNeedsConnection}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("textbox", { name: "URL (HTTPS)" })).toBeEnabled();
    expect(screen.getAllByRole("checkbox")).toHaveLength(15);
    const compare = screen.getByRole("button", {
      name: "Compare live through Solari",
    });
    expect(compare).toBeDisabled();
    expect(compare).toHaveAttribute("aria-describedby", "solari-connection-guidance");

    fireEvent.submit(compare.closest("form")!);
    expect(onNeedsConnection).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(["not a url", "http://regional.example.test/pricing"])(
    "focuses one alert and does not submit invalid target %s",
    (url) => {
      const onSubmit = vi.fn();
      render(
        <AuditForm connectionReady onNeedsConnection={vi.fn()} onSubmit={onSubmit} />,
      );

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
    render(
      <AuditForm connectionReady onNeedsConnection={vi.fn()} onSubmit={onSubmit} />,
    );

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
    render(
      <AuditForm busy connectionReady onNeedsConnection={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(
      screen.getByRole("textbox", { name: "URL (HTTPS)" }),
    ).toHaveValue("");
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
    expect(screen.getByRole("button", { name: "Compare live through Solari" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Comparing live…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Compare live through Solari" })).not.toBeDisabled();
  });

  it("preserves Compare focus and ignores repeat activation while busy", () => {
    const onSubmit = vi.fn();
    const onNeedsConnection = vi.fn();
    const { rerender } = render(
      <AuditForm connectionReady onNeedsConnection={onNeedsConnection} onSubmit={onSubmit} />,
    );
    const compare = screen.getByRole("button", { name: "Compare live through Solari" });
    compare.focus();

    rerender(
      <AuditForm busy connectionReady onNeedsConnection={onNeedsConnection} onSubmit={onSubmit} />,
    );

    expect(compare).toHaveFocus();
    fireEvent.click(compare);
    fireEvent.click(compare);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
