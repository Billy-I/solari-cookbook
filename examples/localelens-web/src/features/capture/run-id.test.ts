import { describe, expect, it } from "vitest";

import { appRunIdSchema } from "@/src/features/capture/contracts";
import { createAppRunId } from "@/src/features/capture/run-id";

describe("application run IDs", () => {
  it("creates one safe prefixed ID from an RFC 4122 version 4 UUID", () => {
    expect(
      createAppRunId(() => "123e4567-e89b-42d3-a456-426614174000"),
    ).toBe("llr_123e4567-e89b-42d3-a456-426614174000");
  });

  it.each([
    "llr_bad",
    "123e4567-e89b-42d3-a456-426614174000",
    "llr_123e4567-e89b-12d3-a456-426614174000",
    "llr_123e4567-e89b-42d3-c456-426614174000",
    "llr_123E4567-E89B-42D3-A456-426614174000",
  ])("rejects malformed or unscoped ID %s", (value) => {
    expect(appRunIdSchema.safeParse(value).success).toBe(false);
  });

  it("fails closed when the UUID source is malformed", () => {
    expect(() => createAppRunId(() => "not-a-uuid")).toThrow(
      "Unable to create a valid application run ID.",
    );
  });
});
