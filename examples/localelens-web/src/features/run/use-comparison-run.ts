"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import type { AuditFormValue } from "@/src/components/audit-form";
import type {
  CaptureFailure,
  CaptureResponse,
  CaptureStage,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import {
  createCaptureTransportPool,
  runComparison,
  runCountryCapture,
  type RunEvents,
  validateSelectedCountries,
} from "@/src/features/run/run-comparison";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

export type RegionRunState = {
  country: SupportedCountry;
  stage: CaptureStage;
  response: CaptureResponse | null;
};

export type ComparisonRunner = typeof runComparison;
export type CountryRunner = typeof runCountryCapture;

export type ComparisonRun = {
  mode: "sample" | "live";
  status: "idle" | "running" | "partial" | "complete" | "cancelled";
  regions: RegionRunState[];
  value: AuditFormValue | null;
  start(value: AuditFormValue): Promise<void>;
  retry(country: SupportedCountry): Promise<void>;
  cancel(): void;
};

type RunState = Pick<ComparisonRun, "regions" | "status" | "value"> & {
  generation: number;
  operationIds: Partial<Record<SupportedCountry, number>>;
};

type RunAction =
  | {
      type: "begin";
      generation: number;
      operationId: number;
      value: AuditFormValue;
    }
  | {
      type: "advance";
      country: SupportedCountry;
      operationId: number;
      response?: CaptureResponse | null;
      stage: CaptureStage;
    }
  | {
      type: "retry";
      country: SupportedCountry;
      expectedOperationId: number;
      generation: number;
      operationId: number;
    }
  | { type: "cancel"; generation: number; operationId: number };

type FixtureLookup = (country: SupportedCountry) => CaptureResponse;

type ComparisonRunOptions = {
  comparisonRunner?: ComparisonRunner;
  countryRunner?: CountryRunner;
  fixtureLookup?: FixtureLookup;
  mode?: ComparisonRun["mode"];
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
  error: {
    code: "CAPTURE_FAILED",
    message: "Sample evidence is unavailable for this market.",
    retryable: false,
  },
};

const initialState: RunState = {
  generation: 0,
  operationIds: {},
  regions: [],
  status: "idle",
  value: null,
};

function defaultFixtureLookup(country: SupportedCountry): CaptureResponse {
  if (country === "us" || country === "gb" || country === "de") {
    return sampleCaptureByCountry[country];
  }

  return unavailableFixture;
}

function configuredMode(): ComparisonRun["mode"] {
  return process.env.NEXT_PUBLIC_APP_MODE === "live" ? "live" : "sample";
}

function deriveStatus(regions: RegionRunState[]): RunState["status"] {
  const settled = regions.filter(
    ({ stage }) => stage === "complete" || stage === "failed",
  ).length;

  if (settled === 0) return "running";
  if (settled < regions.length) return "partial";
  return regions.every(({ stage }) => stage === "complete")
    ? "complete"
    : "partial";
}

function reducer(state: RunState, action: RunAction): RunState {
  if (action.type === "begin") {
    const countries = [...action.value.countries];
    return {
      generation: action.generation,
      operationIds: Object.fromEntries(
        countries.map((country) => [country, action.operationId]),
      ),
      regions: countries.map((country) => ({
        country,
        response: null,
        stage: "queued",
      })),
      status: "running",
      value: { ...action.value, countries },
    };
  }

  if (action.type === "cancel") {
    return {
      ...state,
      generation: action.generation,
      operationIds: Object.fromEntries(
        state.regions.map(({ country }) => [country, action.operationId]),
      ),
      status: "cancelled",
    };
  }

  if (action.type === "retry") {
    const region = state.regions.find(
      (candidate) => candidate.country === action.country,
    );
    if (
      state.generation !== action.generation ||
      state.operationIds[action.country] !== action.expectedOperationId ||
      region?.stage !== "failed" ||
      !region.response ||
      region.response.ok ||
      !region.response.error.retryable
    ) {
      return state;
    }

    const regions = state.regions.map((region) =>
      region.country === action.country
        ? { ...region, response: null, stage: "queued" as const }
        : region,
    );

    return {
      ...state,
      operationIds: {
        ...state.operationIds,
        [action.country]: action.operationId,
      },
      regions,
      status: deriveStatus(regions),
    };
  }

  if (state.operationIds[action.country] !== action.operationId) return state;

  const regions = state.regions.map((region) =>
    region.country === action.country
      ? {
          ...region,
          response:
            action.response === undefined ? region.response : action.response,
          stage: action.stage,
        }
      : region,
  );

  return { ...state, regions, status: deriveStatus(regions) };
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(abortReason(signal));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useComparisonRun(
  options: ComparisonRunOptions = {},
): ComparisonRun {
  const {
    comparisonRunner = runComparison,
    countryRunner = runCountryCapture,
    fixtureLookup = defaultFixtureLookup,
    mode = configuredMode(),
  } = options;
  const [state, dispatch] = useReducer(reducer, initialState);
  const generationRef = useRef(0);
  const operationIdRef = useRef(0);
  const controllersRef = useRef(new Map<number, AbortController>());
  const currentOperationIdsRef = useRef(
    new Map<SupportedCountry, number>(),
  );
  const retryReservationsRef = useRef(
    new Map<SupportedCountry, number>(),
  );
  const transportPoolRef = useRef(createCaptureTransportPool());

  const abortActive = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
  }, []);

  const releaseController = useCallback(
    (operationId: number, controller: AbortController) => {
      const pool = transportPoolRef.current;
      const remove = () => {
        if (controllersRef.current.get(operationId) === controller) {
          controllersRef.current.delete(operationId);
        }
      };

      if (mode === "live" && pool.hasSignal(controller.signal)) {
        void pool.whenSignalSettled(controller.signal).then(remove);
      } else {
        remove();
      }
    },
    [mode],
  );

  useEffect(
    () => () => {
      abortActive();
      generationRef.current += 1;
      currentOperationIdsRef.current.clear();
      retryReservationsRef.current.clear();
    },
    [abortActive],
  );

  const eventsFor = useCallback(
    (operationId: number): RunEvents => ({
      failed(country, error) {
        if (currentOperationIdsRef.current.get(country) !== operationId) return;
        dispatch({
          country,
          operationId,
          response: { error, ok: false },
          stage: "failed",
          type: "advance",
        });
      },
      started(country) {
        if (currentOperationIdsRef.current.get(country) !== operationId) return;
        dispatch({
          country,
          operationId,
          stage: "launching",
          type: "advance",
        });
      },
      succeeded(country, response) {
        if (currentOperationIdsRef.current.get(country) !== operationId) return;
        dispatch({
          country,
          operationId,
          response,
          stage: "complete",
          type: "advance",
        });
      },
    }),
    [],
  );

  const runSampleCountry = useCallback(
    async (
      country: SupportedCountry,
      staggerMs: number,
      operationId: number,
      signal: AbortSignal,
    ) => {
      await wait(staggerMs, signal);
      for (const stage of inProgressStages) {
        dispatch({ country, operationId, stage, type: "advance" });
        await wait(stepDelayMs, signal);
      }

      const response = fixtureLookup(country);
      dispatch({
        country,
        operationId,
        response,
        stage: response.ok ? "complete" : "failed",
        type: "advance",
      });
    },
    [fixtureLookup],
  );

  const start = useCallback(
    async (value: AuditFormValue) => {
      const countries = validateSelectedCountries(value);
      const validatedValue = { ...value, countries };
      abortActive();
      retryReservationsRef.current.clear();
      const generation = ++generationRef.current;
      const operationId = ++operationIdRef.current;
      const controller = new AbortController();
      controllersRef.current.set(operationId, controller);
      currentOperationIdsRef.current = new Map(
        countries.map((country) => [country, operationId]),
      );
      dispatch({
        generation,
        operationId,
        type: "begin",
        value: validatedValue,
      });

      try {
        if (mode === "sample") {
          await Promise.all(
            countries.map((country, index) =>
              runSampleCountry(
                country,
                index * countryStaggerMs,
                operationId,
                controller.signal,
              ),
            ),
          );
        } else {
          await comparisonRunner(
            validatedValue,
            eventsFor(operationId),
            controller.signal,
            transportPoolRef.current,
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        releaseController(operationId, controller);
      }
    },
    [
      abortActive,
      comparisonRunner,
      eventsFor,
      mode,
      releaseController,
      runSampleCountry,
    ],
  );

  const retry = useCallback(
    async (country: SupportedCountry) => {
      const region = state.regions.find((candidate) => candidate.country === country);
      const expectedOperationId = state.operationIds[country];
      if (
        !state.value ||
        expectedOperationId === undefined ||
        generationRef.current !== state.generation ||
        currentOperationIdsRef.current.get(country) !== expectedOperationId ||
        retryReservationsRef.current.has(country) ||
        (mode === "live" && transportPoolRef.current.hasCountry(country)) ||
        region?.stage !== "failed" ||
        !region.response ||
        region.response.ok ||
        !region.response.error.retryable
      ) {
        return;
      }

      const operationId = ++operationIdRef.current;
      retryReservationsRef.current.set(country, operationId);
      currentOperationIdsRef.current.set(country, operationId);
      const controller = new AbortController();
      controllersRef.current.set(operationId, controller);
      dispatch({
        country,
        expectedOperationId,
        generation: state.generation,
        operationId,
        type: "retry",
      });

      try {
        if (mode === "sample") {
          await runSampleCountry(country, 0, operationId, controller.signal);
        } else {
          await countryRunner(
            country,
            state.value.url,
            eventsFor(operationId),
            controller.signal,
            transportPoolRef.current,
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        releaseController(operationId, controller);
        if (retryReservationsRef.current.get(country) === operationId) {
          retryReservationsRef.current.delete(country);
        }
      }
    },
    [
      countryRunner,
      eventsFor,
      mode,
      releaseController,
      runSampleCountry,
      state.generation,
      state.operationIds,
      state.regions,
      state.value,
    ],
  );

  const cancel = useCallback(() => {
    abortActive();
    retryReservationsRef.current.clear();
    const generation = ++generationRef.current;
    const operationId = ++operationIdRef.current;
    for (const country of currentOperationIdsRef.current.keys()) {
      currentOperationIdsRef.current.set(country, operationId);
    }
    dispatch({ generation, operationId, type: "cancel" });
  }, [abortActive]);

  return {
    cancel,
    mode,
    regions: state.regions,
    retry,
    start,
    status: state.status,
    value: state.value,
  };
}
