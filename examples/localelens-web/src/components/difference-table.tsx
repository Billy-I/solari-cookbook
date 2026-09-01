import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CircleX,
} from "lucide-react";

import type { SupportedCountry } from "@/src/features/capture/contracts";
import type {
  DifferenceKind,
  DifferenceRow,
} from "@/src/features/compare/compare-evidence";

const countryNames: Record<SupportedCountry, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  au: "Australia",
};

const fieldLabels: Record<DifferenceRow["field"], string> = {
  final_url: "Final URL",
  title: "Title",
  language: "Language",
  currency: "Currency",
  price: "Price",
  heading: "Primary heading",
  primary_action: "Primary action",
  consent: "Consent",
};

const kindLabels: Record<DifferenceKind, string> = {
  same: "Same",
  different: "Different",
  missing: "Missing",
  unavailable: "Unavailable",
};

function DifferenceKindLabel({ kind }: { kind: DifferenceKind }) {
  const Icon =
    kind === "same"
      ? CircleCheck
      : kind === "different"
        ? CircleAlert
        : kind === "missing"
          ? CircleX
          : CircleMinus;

  return (
    <span className={`comparison-state state-${kind}`}>
      <Icon aria-hidden="true" size={16} />
      {kindLabels[kind]}
    </span>
  );
}

function valueFor(row: DifferenceRow, country: SupportedCountry): string {
  return row.values[country] ?? "Unavailable";
}

type DifferenceTableProps = {
  countries: SupportedCountry[];
  fields: DifferenceRow[];
};

export function DifferenceTable({ countries, fields }: DifferenceTableProps) {
  return (
    <>
      <div className="table-scroll difference-wide" tabIndex={0}>
        <table>
          <caption>Captured field differences by market</caption>
          <thead>
            <tr>
              <th id="field-column" scope="col">
                Evidence
              </th>
              {countries.map((country) => (
                <th id={`country-${country}`} key={country} scope="col">
                  {countryNames[country]}
                </th>
              ))}
              <th id="comparison-column" scope="col">
                Comparison
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((row) => (
              <tr key={row.field}>
                <th id={`field-${row.field}`} scope="row">
                  {fieldLabels[row.field]}
                </th>
                {countries.map((country) => {
                  const value = valueFor(row, country);
                  return (
                    <td
                      aria-label={`${countryNames[country]}: ${value}`}
                      headers={`field-${row.field} country-${country}`}
                      key={country}
                    >
                      {value}
                    </td>
                  );
                })}
                <td headers={`field-${row.field} comparison-column`}>
                  <DifferenceKindLabel kind={row.kind} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl
        aria-label="Captured field differences by market, compact view"
        className="difference-compact"
      >
        {fields.map((row) => (
          <div className="difference-definition" key={row.field}>
            <dt>{fieldLabels[row.field]}</dt>
            {countries.map((country) => (
              <div key={country}>
                <dt>{countryNames[country]}</dt>
                <dd>{valueFor(row, country)}</dd>
              </div>
            ))}
            <div>
              <dt>Comparison</dt>
              <dd>
                <DifferenceKindLabel kind={row.kind} />
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </>
  );
}
