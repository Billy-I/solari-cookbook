export const SUPPORTED_COUNTRIES = ["us", "gb", "de", "fr", "jp", "au"] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];
