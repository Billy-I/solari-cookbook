import type {
  PageEvidence,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import type { RegionRunState } from "@/src/features/run/use-sample-run";

export type ComparisonState = "match" | "different" | "unavailable";

export type ComparedField = {
  field:
    | "finalUrl"
    | "title"
    | "documentLanguage"
    | "primaryHeading"
    | "primaryAction"
    | "ctas"
    | "currencies"
    | "priceSnippets"
    | "consentText";
  label: string;
  state: ComparisonState;
  values: Partial<Record<SupportedCountry, string[]>>;
};

const countryNames: Record<SupportedCountry, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  jp: "Japan",
  au: "Australia",
};

const fieldDefinitions: Array<{
  field: ComparedField["field"];
  label: string;
}> = [
  { field: "finalUrl", label: "Final URL" },
  { field: "documentLanguage", label: "Language" },
  { field: "primaryHeading", label: "Primary heading" },
  { field: "primaryAction", label: "Primary action" },
  { field: "currencies", label: "Currency" },
  { field: "priceSnippets", label: "Price" },
  { field: "consentText", label: "Consent" },
];

function toValues(value: PageEvidence[ComparedField["field"]]): string[] {
  if (Array.isArray(value)) {
    return value.length > 0 ? [...new Set(value)] : ["Not detected"];
  }

  return [value ?? "Not detected"];
}

function normalized(values: string[]): string {
  return values
    .map((value) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase())
    .join("\u0000");
}

export function compareRegions(regions: RegionRunState[]): ComparedField[] {
  return fieldDefinitions.map(({ field, label }) => {
    const values: ComparedField["values"] = {};

    for (const region of regions) {
      if (region.response?.ok) {
        values[region.country] = toValues(region.response.evidence[field]);
      }
    }

    const available = regions
      .map(({ country }) => values[country])
      .filter((value): value is string[] => value !== undefined);
    const state: ComparisonState =
      available.length !== regions.length
        ? "unavailable"
        : new Set(available.map(normalized)).size === 1
          ? "match"
          : "different";

    return { field, label, state, values };
  });
}

type DifferenceTableProps = {
  countries: SupportedCountry[];
  fields: ComparedField[];
};

export function DifferenceTable({ countries, fields }: DifferenceTableProps) {
  return (
    <div className="table-scroll" tabIndex={0}>
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
          {fields.map((field) => (
            <tr key={field.field}>
              <th id={`field-${field.field}`} scope="row">
                {field.label}
              </th>
              {countries.map((country) => (
                <td
                  aria-label={`${countryNames[country]}: ${(field.values[country] ?? ["Unavailable"]).join(", ")}`}
                  headers={`field-${field.field} country-${country}`}
                  key={country}
                >
                  {(field.values[country] ?? ["Unavailable"]).join(", ")}
                </td>
              ))}
              <td
                className={`comparison-state state-${field.state}`}
                headers={`field-${field.field} comparison-column`}
              >
                {field.state === "match"
                  ? "Match"
                  : field.state === "different"
                    ? "Different"
                    : "Unavailable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
