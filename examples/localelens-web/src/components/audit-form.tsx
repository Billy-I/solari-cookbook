"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  COUNTRY_CATALOGUE,
  SUPPORTED_COUNTRIES,
  type SupportedCountry,
} from "@/src/features/capture/countries";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";

const defaultCountries: SupportedCountry[] = SUPPORTED_COUNTRIES.filter(
  (country) => country === "us" || country === "gb",
);

export type AuditFormValue = {
  url: string;
  countries: SupportedCountry[];
};

type AuditFormProps = {
  busy?: boolean;
  connectionReady: boolean;
  onNeedsConnection: () => void;
  onSubmit: (value: AuditFormValue) => void;
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function AuditForm({
  busy = false,
  connectionReady,
  onNeedsConnection,
  onSubmit,
}: AuditFormProps) {
  const [url, setUrl] = useState("");
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
      if (
        (isSelected && current.length === 2) ||
        (!isSelected &&
          current.length === CAPTURE_LIMITS.maxSelectedCountries)
      ) {
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
    if (busy) return;
    if (!connectionReady) {
      onNeedsConnection();
      return;
    }

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
      <p className="mode-notice">Live through Solari.</p>
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
          {COUNTRY_CATALOGUE.map(({ code: country, name }) => {
            const selected = countries.includes(country);
            const atMinimum = selected && countries.length === 2;
            const atMaximum =
              !selected &&
              countries.length === CAPTURE_LIMITS.maxSelectedCountries;

            return (
              <label className="country-option" key={country}>
                <input
                  aria-label={name}
                  checked={selected}
                  disabled={busy || atMinimum || atMaximum}
                  onChange={() => toggleCountry(country)}
                  type="checkbox"
                />
                <span className="country-code">{country.toUpperCase()}</span>
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        aria-busy={busy || undefined}
        aria-describedby="solari-connection-guidance"
        aria-disabled={busy || !connectionReady || undefined}
        aria-label="Compare live through Solari"
        className="primary-action"
        disabled={!connectionReady}
        type="submit"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="status-spinner" size={17} />
            Comparing live…
          </>
        ) : (
          "Compare live through Solari"
        )}
      </button>

      {error ? (
        <p className="form-alert" ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
