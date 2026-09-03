import { afterEach, describe, expect, it, vi } from "vitest";

const { client, solariConstructor } = vi.hoisted(() => ({
  client: { kind: "solari-client" },
  solariConstructor: vi.fn(),
}));

vi.mock("@solarisdk/browser", () => ({
  Solari: solariConstructor.mockImplementation(function MockSolari() {
    return client;
  }),
}));

import { createSolariClient } from "@/src/lib/solari";

afterEach(() => {
  vi.restoreAllMocks();
  solariConstructor.mockClear();
  delete process.env.SOLARI_API_KEY;
});

describe("createSolariClient", () => {
  it("fails closed when the explicit key is empty", () => {
    process.env.SOLARI_API_KEY = "synthetic-owner-fallback";

    expect(() => createSolariClient("")).toThrow("SOLARI_NOT_CONFIGURED");
    expect(solariConstructor).not.toHaveBeenCalled();
  });

  it("constructs a single-attempt SDK client only from the explicit user key", () => {
    process.env.SOLARI_API_KEY = "synthetic-owner-fallback";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = createSolariClient("synthetic-user-key");

    expect(solariConstructor).toHaveBeenCalledOnce();
    expect(solariConstructor).toHaveBeenCalledWith({
      apiKey: "synthetic-user-key",
      maxAttempts: 1,
    });
    expect(result).toBe(client);
    expect(result).not.toBe(process.env.SOLARI_API_KEY);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
