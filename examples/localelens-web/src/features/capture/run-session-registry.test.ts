import { describe, expect, it } from "vitest";

import {
  createRunSessionRegistry,
} from "@/src/features/capture/run-session-registry";

const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const ownerA = "a".repeat(64);
const ownerB = "b".repeat(64);

function indexedRunId(index: number): `llr_${string}` {
  return `llr_${index.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

describe("run session registry", () => {
  it("returns a non-reversible reference while retaining the raw ID server-side", () => {
    let now = 1_000;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlation = registry.register({
      ownerId: ownerA,
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
    expect(registry.lookup(ownerA, correlation)).toBe("raw-provider-session-id");
    expect(registry.lookup(ownerB, correlation)).toBeNull();
  });

  it("requires every safe correlation field to match", () => {
    const registry = createRunSessionRegistry({ now: () => 1_000 });
    const correlation = registry.register({
      ownerId: ownerA,
      runId,
      country: "fr",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });

    expect(registry.lookup(ownerA, { ...correlation, country: "de" })).toBeNull();
    expect(registry.lookup(ownerA, { ...correlation, attempt: 2 })).toBeNull();
    expect(
      registry.lookup(ownerA, {
        ...correlation,
        sessionRef: "sol_00000000000000000000",
      }),
    ).toBeNull();
  });

  it("expires provider IDs after one hour", () => {
    let now = 1_000;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlation = registry.register({
      ownerId: ownerA,
      runId,
      country: "fr",
      attempt: 1,
      sessionId: "raw-provider-session-id",
    });

    now = 3_600_999;
    expect(registry.lookup(ownerA, correlation)).toBe("raw-provider-session-id");
    now = 3_601_000;
    expect(registry.lookup(ownerA, correlation)).toBeNull();
  });

  it("evicts the oldest run after one hundred retained runs", () => {
    let now = 0;
    const registry = createRunSessionRegistry({ now: () => now });
    const correlations = Array.from({ length: 101 }, (_, index) => {
      now = index;
      return registry.register({
        ownerId: ownerA,
        runId: indexedRunId(index),
        country: "us",
        attempt: 1,
        sessionId: `raw-session-${index}`,
      });
    });

    now = 101;
    expect(registry.lookup(ownerA, correlations[0]!)).toBeNull();
    expect(registry.lookup(ownerA, correlations[1]!)).toBe("raw-session-1");
    expect(registry.lookup(ownerA, correlations[100]!)).toBe("raw-session-100");
  });

  it("deletes only the selected owner's internal records", () => {
    const registry = createRunSessionRegistry({ now: () => 1_000 });
    const alpha = registry.register({
      ownerId: ownerA,
      runId,
      country: "us",
      attempt: 1,
      sessionId: "raw-alpha-session",
    });
    const beta = registry.register({
      ownerId: ownerB,
      runId,
      country: "us",
      attempt: 1,
      sessionId: "raw-beta-session",
    });

    registry.deleteOwner(ownerA);

    expect(registry.lookup(ownerA, alpha)).toBeNull();
    expect(registry.lookup(ownerB, beta)).toBe("raw-beta-session");
    expect(JSON.stringify(alpha)).not.toContain(ownerA);
    expect(JSON.stringify(alpha)).not.toContain("raw-alpha-session");
  });

  it("rejects malformed owner identifiers", () => {
    const registry = createRunSessionRegistry({ now: () => 1_000 });

    expect(() =>
      registry.register({
        ownerId: "not-an-owner-id",
        runId,
        country: "us",
        attempt: 1,
        sessionId: "raw-provider-session-id",
      }),
    ).toThrow("Invalid credential owner ID");
    expect(registry.lookup("not-an-owner-id", {
      runId,
      country: "us",
      attempt: 1,
      sessionRef: "sol_00000000000000000000",
    })).toBeNull();
  });
});
