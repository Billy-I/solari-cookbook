"use client";

import { useEffect, useRef, useState } from "react";

import {
  SUPPORTED_COUNTRIES,
  type SupportedCountry,
} from "@/src/features/capture/contracts";

const countryNames: Record<SupportedCountry, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  au: "Australia",
};

const defaultCountries: SupportedCountry[] = ["us", "gb"];
const defaultUrl = "https://regional.example.test/pricing";

export type AuditFormValue = {
  url: string;
  countries: SupportedCountry[];
};

type AuditFormProps = {
  busy?: boolean;
  onSubmit: (value: AuditFormValue) => void;
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function AuditForm({ busy = false, onSubmit }: AuditFormProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [countries, setCountries] =
    useState<SupportedCountry[]>(defaultCountries);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function toggleCountry(country: SupportedCountry) {
    setCountries((current) => {
      const isSelected = current.includes(country);
      if ((isSelected && current.length === 2) || (!isSelected && current.length === 3)) {
        return current;
      }

      const next = isSelected
        ? current.filter((value) => value !== country)
        : [...current, country];

      return SUPPORTED_COUNTRIES.filter((value) => next.includes(value));
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUrl = url.trim();

    if (!isHttpsUrl(normalizedUrl)) {
      setError("Enter a valid HTTPS URL before comparing markets.");
      return;
    }

    setError(null);
    onSubmit({ url: normalizedUrl, countries });
  }

  return (
    <form
      aria-label="Run comparison"
      className="control-grid"
      noValidate
      onSubmit={submit}
    >
      <label className="field field-url">
        <span>URL (HTTPS)</span>
        <input
          disabled={busy}
          inputMode="url"
          name="url"
          onChange={(event) => setUrl(event.target.value)}
          type="url"
          value={url}
        />
      </label>

      <fieldset className="country-fieldset" disabled={busy}>
        <legend>Markets</legend>
        <div className="country-options">
          {SUPPORTED_COUNTRIES.map((country) => {
            const selected = countries.includes(country);
            const atMinimum = selected && countries.length === 2;
            const atMaximum = !selected && countries.length === 3;

            return (
              <label className="country-option" key={country}>
                <input
                  aria-label={countryNames[country]}
                  checked={selected}
                  disabled={busy || atMinimum || atMaximum}
                  onChange={() => toggleCountry(country)}
                  type="checkbox"
                />
                <span className="country-code">{country.toUpperCase()}</span>
                <span>{countryNames[country]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        aria-label="Compare markets"
        className="primary-action"
        disabled={busy}
        type="submit"
      >
        {busy ? "Comparing markets…" : "Compare markets"}
      </button>

      {error ? (
        <p className="form-alert" ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
