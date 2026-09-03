import { describe, expect, it } from "vitest";

import {
  createRunSessionRegistry,
} from "@/src/features/capture/run-session-registry";

const runId = "llr_123e4567-e89b-42d3-a456-426614174000";

function indexedRunId(index: number): `llr_${string}` {
  return `llr_${index.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

describe("run session registry", () => {
  it("returns a non-reversible reference while retaining the raw ID server-side", () => {
    let now = 1_000;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlation = registry.register({
      runId,
      country: "fr",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });

    expect(correlation).toEqual({
      runId,
      country: "fr",
      attempt: 1,
      sessionRef: "sol_dab46ee6c619545d0534",
    });
    expect(JSON.stringify(correlation)).not.toContain("raw-provider-session-id");
    now = 1_001;
    expect(registry.lookup(correlation)).toBe("raw-provider-session-id");
  });

  it("requires every safe correlation field to match", () => {
    const registry = createRunSessionRegistry({ now: () => 1_000 });
    const correlation = registry.register({
      runId,
      country: "fr",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });

    expect(registry.lookup({ ...correlation, country: "de" })).toBeNull();
    expect(registry.lookup({ ...correlation, attempt: 2 })).toBeNull();
    expect(
      registry.lookup({
        ...correlation,
        sessionRef: "sol_00000000000000000000",
      }),
    ).toBeNull();
  });

  it("expires provider IDs after one hour", () => {
    let now = 1_000;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlation = registry.register({
      runId,
      country: "fr",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });

    now = 3_600_999;
    expect(registry.lookup(correlation)).toBe("raw-provider-session-id");
    now = 3_601_000;
    expect(registry.lookup(correlation)).toBeNull();
  });

  it("evicts the oldest run after one hundred retained runs", () => {
    let now = 0;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlations = Array.from({ length: 101 }, (_, index) => {
      now = index;
      return registry.register({
        runId: indexedRunId(index),
        country: "us",
        attempt: 1,
        sessionId: `raw-session-${index}`,
      });
    });

    now = 101;
    expect(registry.lookup(correlations[0]!)).toBeNull();
    expect(registry.lookup(correlations[1]!)).toBe("raw-session-1");
    expect(registry.lookup(correlations[100]!)).toBe("raw-session-100");
  });
});
