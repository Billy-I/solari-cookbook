import { Solari } from "@solarisdk/browser";

export function createSolariClient(apiKey: string): Solari {
  if (!apiKey) {
    throw new Error("SOLARI_NOT_CONFIGURED");
  }

  return new Solari({ apiKey, maxAttempts: 1 });
}
