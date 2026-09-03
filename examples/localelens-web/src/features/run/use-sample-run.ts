"use client";

import { useCallback, useReducer } from "react";

import type { AuditFormValue } from "@/src/components/audit-form";
import type {
  CaptureFailure,
  CaptureResponse,
  CaptureStage,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

export type RegionRunState = {
  country: SupportedCountry;
  stage: CaptureStage;
  response: CaptureResponse | null;
};

export type SampleRunController = {
  status: "idle" | "running" | "complete" | "partial";
  regions: RegionRunState[];
  start: (value: AuditFormValue) => Promise<void>;
  retry: (country: SupportedCountry) => Promise<void>;
};

type FixtureLookup = (country: SupportedCountry) => CaptureResponse;
type RunState = Pick<SampleRunController, "regions" | "status">;
type RunAction =
  | { type: "begin"; countries: SupportedCountry[] }
  | {
      type: "advance";
      country: SupportedCountry;
      stage: CaptureStage;
      response?: CaptureResponse | null;
    };

const stepDelayMs = 60;
const countryStaggerMs = 40;
const inProgressStages: CaptureStage[] = [
  "launching",
  "navigating",
  "extracting",
  "closing",
];

const unavailableFixture: CaptureFailure = {
  ok: false,
  correlation: null,
  error: {
    code: "CAPTURE_FAILED",
    message: "Sample evidence is unavailable for this market.",
    retryable: false,
  },
};

function defaultFixtureLookup(country: SupportedCountry): CaptureResponse {
  if (country === "us" || country === "gb" || country === "de") {
    return sampleCaptureByCountry[country];
  }

  return unavailableFixture;
}

function deriveStatus(regions: RegionRunState[]): RunState["status"] {
  if (regions.length === 0) {
    return "idle";
  }

  if (regions.some(({ stage }) => stage !== "complete" && stage !== "failed")) {
    return "running";
  }

  return regions.every(({ stage }) => stage === "complete")
    ? "complete"
    : "partial";
}

function reducer(state: RunState, action: RunAction): RunState {
  if (action.type === "begin") {
    return {
      status: "running",
      regions: action.countries.map((country) => ({
        country,
        stage: "queued",
        response: null,
      })),
    };
  }

  const regions = state.regions.map((region) =>
    region.country === action.country
      ? {
          ...region,
          stage: action.stage,
          response:
            action.response === undefined ? region.response : action.response,
        }
      : region,
  );

  return { regions, status: deriveStatus(regions) };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function useSampleRun(
  fixtureLookup: FixtureLookup = defaultFixtureLookup,
): SampleRunController {
  const [state, dispatch] = useReducer(reducer, {
    regions: [],
    status: "idle",
  });

  const runCountry = useCallback(
    async (country: SupportedCountry, staggerMs: number) => {
      await wait(staggerMs);

      for (const stage of inProgressStages) {
        dispatch({ type: "advance", country, stage });
        await wait(stepDelayMs);
      }

      const response = fixtureLookup(country);
      dispatch({
        type: "advance",
        country,
        response,
        stage: response.ok ? "complete" : "failed",
      });
    },
    [fixtureLookup],
  );

  const start = useCallback(
    async (value: AuditFormValue) => {
      dispatch({ type: "begin", countries: value.countries });
      await Promise.all(
        value.countries.map((country, index) =>
          runCountry(country, index * countryStaggerMs),
        ),
      );
    },
    [runCountry],
  );

  const retry = useCallback(
    async (country: SupportedCountry) => {
      dispatch({ type: "advance", country, response: null, stage: "queued" });
      await runCountry(country, 0);
    },
    [runCountry],
  );

  return { ...state, retry, start };
}
