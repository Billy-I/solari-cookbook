import { describe, expect, it, vi } from "vitest";

import {
  CREDENTIAL_ABSOLUTE_MS,
  CREDENTIAL_IDLE_MS,
  createCredentialSessionStore,
} from "@/src/features/credential/credential-session-store";

function deterministicRandomBytes() {
  let value = 6;
  return vi.fn(() => Buffer.alloc(32, ++value));
}

describe("credential session store", () => {
  it("returns an opaque token and resolves the full key only inside the store", () => {
    const clock = { now: 1_000 };
    const random = vi.fn(() => Buffer.alloc(32, 7));
    const store = createCredentialSessionStore({
      now: () => clock.now,
      randomBytes: random,
      maxEntries: 2,
    });

    const created = store.create("synthetic-key-alpha");

    expect(created).toEqual({
      token: Buffer.alloc(32, 7).toString("base64url"),
      ownerId: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(store.resolve(created!.token)).toEqual({
      ownerId: created!.ownerId,
      apiKey: "synthetic-key-alpha",
    });
    expect(JSON.stringify(created)).not.toContain("synthetic-key-alpha");
    expect(random).toHaveBeenCalledOnce();
  });

  it("expires after thirty idle minutes and touches only successful resolves", () => {
    const clock = { now: 1_000 };
    const store = createCredentialSessionStore({
      now: () => clock.now,
      randomBytes: deterministicRandomBytes(),
      maxEntries: 2,
    });
    const created = store.create("synthetic-key-alpha")!;

    clock.now = 1_800_999;
    expect(store.resolve(created.token)).not.toBeNull();
    clock.now += CREDENTIAL_IDLE_MS - 1;
    expect(store.resolve(created.token)).not.toBeNull();
    clock.now += CREDENTIAL_IDLE_MS;
    expect(store.resolve("malformed-token")).toBeNull();
    expect(store.resolve(created.token)).toBeNull();
  });

  it("expires at the eight-hour absolute limit even after recent use", () => {
    const clock = { now: 1_000 };
    const store = createCredentialSessionStore({
      now: () => clock.now,
      randomBytes: deterministicRandomBytes(),
      maxEntries: 2,
    });
    const created = store.create("synthetic-key-alpha")!;

    for (
      clock.now = 1_800_999;
      clock.now < 1_000 + CREDENTIAL_ABSOLUTE_MS;
      clock.now += CREDENTIAL_IDLE_MS - 1
    ) {
      expect(store.resolve(created.token)).not.toBeNull();
    }
    clock.now = 1_000 + CREDENTIAL_ABSOLUTE_MS;
    expect(store.resolve(created.token)).toBeNull();
  });

  it("deletes explicitly and returns only the deleted owner ID", () => {
    const store = createCredentialSessionStore({
      now: () => 1_000,
      randomBytes: deterministicRandomBytes(),
      maxEntries: 2,
    });
    const created = store.create("synthetic-key-alpha")!;

    expect(store.delete(created.token)).toBe(created.ownerId);
    expect(store.resolve(created.token)).toBeNull();
    expect(store.delete(created.token)).toBeNull();
    expect(store.delete("malformed-token")).toBeNull();
  });

  it("keeps users isolated and refuses saturation without evicting live entries", () => {
    const store = createCredentialSessionStore({
      now: () => 1_000,
      randomBytes: deterministicRandomBytes(),
      maxEntries: 2,
    });
    const alpha = store.create("synthetic-key-alpha")!;
    const beta = store.create("synthetic-key-beta")!;

    expect(alpha.token).not.toBe(beta.token);
    expect(alpha.ownerId).not.toBe(beta.ownerId);
    expect(store.resolve(alpha.token)?.apiKey).toBe("synthetic-key-alpha");
    expect(store.resolve(beta.token)?.apiKey).toBe("synthetic-key-beta");
    expect(store.create("synthetic-key-gamma")).toBeNull();
    expect(store.resolve(alpha.token)?.apiKey).toBe("synthetic-key-alpha");
    expect(store.resolve(beta.token)?.apiKey).toBe("synthetic-key-beta");
  });

  it("prunes expired entries before admitting a replacement", () => {
    const clock = { now: 1_000 };
    const store = createCredentialSessionStore({
      now: () => clock.now,
      randomBytes: deterministicRandomBytes(),
      maxEntries: 1,
    });
    const expired = store.create("synthetic-key-alpha")!;

    clock.now = 1_801_000;
    const replacement = store.create("synthetic-key-beta");

    expect(replacement).not.toBeNull();
    expect(store.resolve(expired.token)).toBeNull();
    expect(store.resolve(replacement!.token)?.apiKey).toBe("synthetic-key-beta");
  });
});
