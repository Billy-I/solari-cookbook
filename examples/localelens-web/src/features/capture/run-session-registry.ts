import { createHash } from "node:crypto";

import {
  captureCorrelationSchema,
  type AppRunId,
  type CaptureCorrelation,
  type SupportedCountry,
} from "./contracts";

const registryLifetimeMs = 60 * 60 * 1_000;
const maximumRetainedRuns = 100;
const registrySymbol = Symbol.for("localelens.run-session-registry");

type RegisterRunSessionInput = {
  runId: AppRunId;
  country: SupportedCountry;
  attempt: number;
  sessionId: string;
};

type SessionRecord = {
  correlation: CaptureCorrelation;
  sessionId: string;
};

type RunRecord = {
  entries: Map<string, SessionRecord>;
  updatedAt: number;
};

type RegistryStore = Map<AppRunId, RunRecord>;

export type RunSessionRegistry = {
  register(input: RegisterRunSessionInput): CaptureCorrelation;
  lookup(correlation: CaptureCorrelation): string | null;
};

type RegistryOptions = {
  now?: () => number;
};

function entryKey(country: SupportedCountry, attempt: number): string {
  return `${country}:${attempt}`;
}

function pruneExpired(store: RegistryStore, now: number): void {
  for (const [runId, record] of store) {
    if (record.updatedAt + registryLifetimeMs <= now) {
      store.delete(runId);
    }
  }
}

function safeSessionRef(sessionId: string): string {
  const digest = createHash("sha256").update(sessionId).digest("hex");
  return `sol_${digest.slice(0, 20)}`;
}

function registryForStore(
  store: RegistryStore,
  now: () => number,
): RunSessionRegistry {
  return {
    register(input) {
      if (
        typeof input.sessionId !== "string" ||
        input.sessionId.length === 0 ||
        input.sessionId.length > 500
      ) {
        throw new Error("Invalid provider session ID");
      }

      const timestamp = now();
      pruneExpired(store, timestamp);
      const correlation = captureCorrelationSchema.parse({
        runId: input.runId,
        country: input.country,
        attempt: input.attempt,
        sessionRef: safeSessionRef(input.sessionId),
      });
      const record = store.get(input.runId) ?? {
        entries: new Map<string, SessionRecord>(),
        updatedAt: timestamp,
      };
      record.entries.set(entryKey(input.country, input.attempt), {
        correlation,
        sessionId: input.sessionId,
      });
      record.updatedAt = timestamp;
      store.delete(input.runId);
      store.set(input.runId, record);

      while (store.size > maximumRetainedRuns) {
        const oldestRunId = store.keys().next().value;
        if (oldestRunId === undefined) break;
        store.delete(oldestRunId);
      }

      return correlation;
    },

    lookup(correlation) {
      const parsed = captureCorrelationSchema.safeParse(correlation);
      if (!parsed.success) return null;

      pruneExpired(store, now());
      const record = store.get(parsed.data.runId);
      const entry = record?.entries.get(
        entryKey(parsed.data.country, parsed.data.attempt),
      );
      return entry && entry.correlation.sessionRef === parsed.data.sessionRef
        ? entry.sessionId
        : null;
    },
  };
}

export function createRunSessionRegistry(
  options: RegistryOptions = {},
): RunSessionRegistry {
  return registryForStore(new Map(), options.now ?? Date.now);
}

function globalStore(): RegistryStore {
  const registryGlobal = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  const existing = registryGlobal[registrySymbol];
  if (existing instanceof Map) return existing as RegistryStore;

  const store: RegistryStore = new Map();
  registryGlobal[registrySymbol] = store;
  return store;
}

const sharedRegistry = registryForStore(globalStore(), Date.now);

export function registerRunSession(
  input: RegisterRunSessionInput,
): CaptureCorrelation {
  return sharedRegistry.register(input);
}

export function lookupRunSession(
  correlation: CaptureCorrelation,
): string | null {
  return sharedRegistry.lookup(correlation);
}
