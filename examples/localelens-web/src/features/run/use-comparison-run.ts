"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import type { AuditFormValue } from "@/src/components/audit-form";
import type {
  AppRunId,
  CaptureFailure,
  CaptureResponse,
  CaptureStage,
  SupportedCountry,
} from "@/src/features/capture/contracts";
import { CAPTURE_LIMITS } from "@/src/features/capture/limits";
import { createAppRunId } from "@/src/features/capture/run-id";
import {
  createCaptureTransportPool,
  runComparison,
  runCountryCapture,
  type RunEvents,
  validateSelectedCountries,
  type RunContext,
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
  runId: AppRunId | null;
  progress: RunProgress;
  value: AuditFormValue | null;
  start(value: AuditFormValue): Promise<void>;
  retry(country: SupportedCountry): Promise<void>;
  cancel(): void;
};

export type RunProgress = {
  selected: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  batch: number;
  totalBatches: number;
};

type RunState = Pick<
  ComparisonRun,
  "regions" | "runId" | "status" | "value"
> & {
  batch: number;
  totalBatches: number;
  generation: number;
  operationIds: Partial<Record<SupportedCountry, number>>;
};

type RunAction =
  | {
      type: "begin";
      generation: number;
      operationId: number;
      runId: AppRunId;
      value: AuditFormValue;
    }
  | {
      type: "batch";
      batch: number;
      generation: number;
      operationId: number;
      totalBatches: number;
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
  createRunId?: () => AppRunId;
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
  correlation: null,
  error: {
    code: "CAPTURE_FAILED",
    message: "Sample evidence is unavailable for this market.",
    retryable: false,
  },
};

const initialState: RunState = {
  batch: 0,
  generation: 0,
  operationIds: {},
  regions: [],
  runId: null,
  status: "idle",
  totalBatches: 0,
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
      batch: 0,
      operationIds: Object.fromEntries(
        countries.map((country) => [country, action.operationId]),
      ),
      regions: countries.map((country) => ({
        country,
        response: null,
        stage: "queued",
      })),
      status: "running",
      runId: action.runId,
      totalBatches: Math.ceil(
        countries.length / CAPTURE_LIMITS.maxConcurrentCaptures,
      ),
      value: { ...action.value, countries },
    };
  }

  if (action.type === "batch") {
    if (
      state.generation !== action.generation ||
      !Object.values(state.operationIds).includes(action.operationId)
    ) {
      return state;
    }

    return {
      ...state,
      batch: action.batch,
      totalBatches: action.totalBatches,
    };
  }

  if (action.type === "cancel") {
    return {
      ...state,
      generation: action.generation,
      operationIds: Object.fromEntries(
        state.regions.map(({ country }) => [country, action.operationId]),
      ),
      regions: state.regions.map((region) =>
        region.stage === "complete" || region.stage === "failed"
          ? region
          : { ...region, stage: "cancelled" as const },
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

async function waitForSettlement(
  settlement: Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let rejectForAbort: ((reason: unknown) => void) | undefined;
  const userAbort = new Promise<never>((_, reject) => {
    rejectForAbort = reject;
  });
  const onAbort = () => rejectForAbort?.(abortReason(signal));

  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  try {
    await Promise.race([settlement, userAbort]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export function useComparisonRun(
  options: ComparisonRunOptions = {},
): ComparisonRun {
  const {
    comparisonRunner = runComparison,
    countryRunner = runCountryCapture,
    createRunId = createAppRunId,
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
  const attemptsRef = useRef(new Map<SupportedCountry, number>());
  const transportPoolRef = useRef(createCaptureTransportPool());

  const abortActive = useCallback(() => {
    const controllers = [...controllersRef.current.values()];
    for (const controller of controllers) {
      controller.abort();
    }
    return controllers.map(({ signal }) => signal);
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
      attemptsRef.current.clear();
    },
    [abortActive],
  );

  const eventsFor = useCallback(
    (operationId: number, generation: number): RunEvents => ({
      batchStarted(batch, totalBatches) {
        dispatch({
          batch,
          generation,
          operationId,
          totalBatches,
          type: "batch",
        });
      },
      failed(country, error) {
        if (currentOperationIdsRef.current.get(country) !== operationId) return;
        dispatch({
          country,
          operationId,
          response: { correlation: null, error, ok: false },
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
      context: RunContext,
    ) => {
      await wait(staggerMs, signal);
      for (const stage of inProgressStages) {
        dispatch({ country, operationId, stage, type: "advance" });
        await wait(stepDelayMs, signal);
      }

      const fixture = fixtureLookup(country);
      const response: CaptureResponse = fixture.ok
        ? {
            ...fixture,
            receipt: {
              ...fixture.receipt,
              runId: context.runId,
              attempt: context.attempt,
              sessionRef: null,
            },
          }
        : { ...fixture, correlation: null };
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
      const runId = createRunId();
      const previousSignals = abortActive();
      retryReservationsRef.current.clear();
      attemptsRef.current = new Map(countries.map((country) => [country, 1]));
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
        runId,
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
                { runId, attempt: 1 },
              ),
            ),
          );
        } else {
          const handoffSignals = previousSignals.filter((signal) =>
            transportPoolRef.current.hasSignal(signal),
          );
          if (handoffSignals.length > 0) {
            await waitForSettlement(
              Promise.all(
                handoffSignals.map((signal) =>
                  transportPoolRef.current.whenSignalSettled(signal),
                ),
              ).then(() => undefined),
              controller.signal,
            );
            if (controller.signal.aborted) throw abortReason(controller.signal);
          }
          await comparisonRunner(
            validatedValue,
            { runId, attempt: 1 },
            eventsFor(operationId, generation),
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
      createRunId,
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
        !state.runId ||
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
      const attempt = (attemptsRef.current.get(country) ?? 1) + 1;
      retryReservationsRef.current.set(country, operationId);
      attemptsRef.current.set(country, attempt);
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
          await runSampleCountry(
            country,
            0,
            operationId,
            controller.signal,
            { runId: state.runId, attempt },
          );
        } else {
          await countryRunner(
            country,
            state.value.url,
            { runId: state.runId, attempt },
            eventsFor(operationId, state.generation),
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
      state.runId,
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
    progress: {
      selected: state.regions.length,
      queued: state.regions.filter(({ stage }) => stage === "queued").length,
      running: state.regions.filter(({ stage }) =>
        inProgressStages.includes(stage),
      ).length,
      completed: state.regions.filter(({ stage }) => stage === "complete").length,
      failed: state.regions.filter(({ stage }) => stage === "failed").length,
      batch: state.batch,
      totalBatches: state.totalBatches,
    },
    regions: state.regions,
    runId: state.runId,
    retry,
    start,
    status: state.status,
    value: state.value,
  };
}
