import type {
  CaptureSuccess,
  PageEvidence,
  Report,
  SupportedCountry,
} from "@/src/features/capture/contracts";

type SampleCountry = Extract<SupportedCountry, "us" | "gb" | "de">;

const requestedUrl = "https://regional.example.test/pricing";

function createSampleCapture(
  country: SampleCountry,
  timezoneId: string,
  evidence: PageEvidence,
  screenshotBase64: string,
): CaptureSuccess {
  return {
    ok: true,
    evidence,
    receipt: {
      country,
      proxyCountry: country,
      proxyTier: "residential",
      timezoneId,
      sessionId: `synthetic-local-fixture-${country}`,
      recordingRequested: true,
    },
    screenshot: {
      mediaType: "image/jpeg",
      base64: screenshotBase64,
      width: 1280,
    },
  };
}

export const sampleCaptureByCountry = {
  us: createSampleCapture(
    "us",
    "America/New_York",
    {
      requestedUrl,
      finalUrl: "https://regional.example.test/us/pricing",
      title: "Synthetic plans — United States",
      documentLanguage: "en-US",
      primaryHeading: "Plans for United States visitors",
      primaryAction: "Start US sample",
      ctas: ["Start US sample", "View synthetic details"],
      currencies: ["USD", "$"],
      priceSnippets: ["USD 24 per month"],
      consentText: "Synthetic cookie choices for United States visitors.",
      httpStatus: 200,
      capturedAt: "2026-09-01T12:00:00.000Z",
    },
    "c3ludGhldGljLXVzLWpwZWctZml4dHVyZQ==",
  ),
  gb: createSampleCapture(
    "gb",
    "Europe/London",
    {
      requestedUrl,
      finalUrl: "https://regional.example.test/gb/pricing",
      title: "Synthetic plans — United Kingdom",
      documentLanguage: "en-GB",
      primaryHeading: "Plans for United Kingdom visitors",
      primaryAction: "Start UK sample",
      ctas: ["Start UK sample", "View synthetic details"],
      currencies: ["GBP", "£"],
      priceSnippets: ["GBP 24 per month"],
      consentText: "Synthetic cookie preferences for United Kingdom visitors.",
      httpStatus: 200,
      capturedAt: "2026-09-01T12:00:01.000Z",
    },
    "c3ludGhldGljLWdiLWpwZWctZml4dHVyZQ==",
  ),
  de: createSampleCapture(
    "de",
    "Europe/Berlin",
    {
      requestedUrl,
      finalUrl: "https://regional.example.test/de/pricing",
      title: "Synthetische Tarife — Deutschland",
      documentLanguage: "de-DE",
      primaryHeading: "Tarife für Deutschland",
      primaryAction: "Synthetischen Tarif ansehen",
      ctas: ["Synthetischen Tarif ansehen", "Synthetische Details öffnen"],
      currencies: ["EUR", "€"],
      priceSnippets: ["24 EUR pro Monat"],
      consentText: "Synthetische Cookie-Einstellungen für Deutschland.",
      httpStatus: 200,
      capturedAt: "2026-09-01T12:00:02.000Z",
    },
    "c3ludGhldGljLWRlLWpwZWctZml4dHVyZQ==",
  ),
} satisfies Record<SampleCountry, CaptureSuccess>;

export const sampleReport = {
  schemaVersion: 1,
  status: "complete",
  mode: "sample",
  requestedUrl,
  countries: ["us", "gb", "de"],
  results: [
    {
      country: "us",
      evidence: sampleCaptureByCountry.us.evidence,
    },
    {
      country: "gb",
      evidence: sampleCaptureByCountry.gb.evidence,
    },
    {
      country: "de",
      evidence: sampleCaptureByCountry.de.evidence,
    },
  ],
  generatedAt: "2026-09-01T12:01:00.000Z",
} satisfies Report;
