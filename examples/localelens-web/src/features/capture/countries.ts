export const SUPPORTED_COUNTRIES = [
  "au",
  "br",
  "ca",
  "de",
  "es",
  "fr",
  "gb",
  "in",
  "it",
  "jp",
  "kr",
  "mx",
  "nl",
  "sg",
  "us",
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const COUNTRY_NAMES = {
  au: "Australia",
  br: "Brazil",
  ca: "Canada",
  de: "Germany",
  es: "Spain",
  fr: "France",
  gb: "United Kingdom",
  in: "India",
  it: "Italy",
  jp: "Japan",
  kr: "South Korea",
  mx: "Mexico",
  nl: "Netherlands",
  sg: "Singapore",
  us: "United States",
} as const satisfies Record<SupportedCountry, string>;

export const COUNTRY_CATALOGUE = SUPPORTED_COUNTRIES.map((code) => ({
  code,
  name: COUNTRY_NAMES[code],
}));
