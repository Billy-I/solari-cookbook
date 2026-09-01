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

const originalApiKey = process.env.SOLARI_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  solariConstructor.mockClear();

  if (originalApiKey === undefined) {
    delete process.env.SOLARI_API_KEY;
  } else {
    process.env.SOLARI_API_KEY = originalApiKey;
  }
});

describe("createSolariClient", () => {
  it.each([undefined, "", "   "])(
    "fails closed when SOLARI_API_KEY is %s",
    (apiKey) => {
      if (apiKey === undefined) {
        delete process.env.SOLARI_API_KEY;
      } else {
        process.env.SOLARI_API_KEY = apiKey;
      }

      expect(() => createSolariClient()).toThrow("SOLARI_NOT_CONFIGURED");
      expect(solariConstructor).not.toHaveBeenCalled();
    },
  );

  it("constructs a single-attempt SDK client without logging or returning the key", () => {
    process.env.SOLARI_API_KEY = "unit-test-key";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = createSolariClient();

    expect(solariConstructor).toHaveBeenCalledOnce();
    expect(solariConstructor).toHaveBeenCalledWith({
      apiKey: "unit-test-key",
      maxAttempts: 1,
    });
    expect(result).toBe(client);
    expect(result).not.toBe(process.env.SOLARI_API_KEY);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
