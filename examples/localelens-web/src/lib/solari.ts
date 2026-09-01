import { Solari } from "@solarisdk/browser";

export function createSolariClient(): Solari {
  const apiKey = process.env.SOLARI_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error("SOLARI_NOT_CONFIGURED");
  }

  return new Solari({ apiKey, maxAttempts: 1 });
}
