import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

export const CREDENTIAL_IDLE_MS = 30 * 60 * 1_000;
export const CREDENTIAL_ABSOLUTE_MS = 8 * 60 * 60 * 1_000;
export const CREDENTIAL_MAX_ENTRIES = 1_000;

export type CredentialSession = Readonly<{
  ownerId: string;
  apiKey: string;
}>;

export type CredentialSessionStore = {
  create(apiKey: string): { token: string; ownerId: string } | null;
  resolve(token: string): CredentialSession | null;
  delete(token: string): string | null;
};

type CredentialRecord = {
  apiKey: string;
  createdAt: number;
  lastUsedAt: number;
  absoluteExpiresAt: number;
};

type CredentialStoreMap = Map<string, CredentialRecord>;

type CredentialSessionStoreOptions = {
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
  maxEntries?: number;
  store?: CredentialStoreMap;
};

const storeSymbol = Symbol.for("localelens.credential-session-store");
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function ownerIdForToken(token: string): string | null {
  if (!tokenPattern.test(token)) return null;

  try {
    const decoded = Buffer.from(token, "base64url");
    if (decoded.length !== 32 || decoded.toString("base64url") !== token) {
      return null;
    }
  } catch {
    return null;
  }

  return createHash("sha256").update(token).digest("hex");
}

function pruneExpired(store: CredentialStoreMap, now: number): void {
  for (const [ownerId, record] of store) {
    if (
      record.lastUsedAt + CREDENTIAL_IDLE_MS <= now ||
      record.absoluteExpiresAt <= now
    ) {
      store.delete(ownerId);
    }
  }
}

export function createCredentialSessionStore(
  options: CredentialSessionStoreOptions = {},
): CredentialSessionStore {
  const now = options.now ?? Date.now;
  const randomBytes = options.randomBytes ?? nodeRandomBytes;
  const maxEntries = options.maxEntries ?? CREDENTIAL_MAX_ENTRIES;
  const store = options.store ?? new Map<string, CredentialRecord>();

  return {
    create(apiKey) {
      const timestamp = now();
      pruneExpired(store, timestamp);
      if (store.size >= maxEntries) return null;

      const token = randomBytes(32).toString("base64url");
      const ownerId = ownerIdForToken(token);
      if (!ownerId || store.has(ownerId)) return null;

      store.set(ownerId, {
        apiKey,
        createdAt: timestamp,
        lastUsedAt: timestamp,
        absoluteExpiresAt: timestamp + CREDENTIAL_ABSOLUTE_MS,
      });
      return { token, ownerId };
    },

    resolve(token) {
      const timestamp = now();
      pruneExpired(store, timestamp);
      const ownerId = ownerIdForToken(token);
      if (!ownerId) return null;

      const record = store.get(ownerId);
      if (!record) return null;
      record.lastUsedAt = timestamp;
      return { ownerId, apiKey: record.apiKey };
    },

    delete(token) {
      pruneExpired(store, now());
      const ownerId = ownerIdForToken(token);
      if (!ownerId || !store.delete(ownerId)) return null;
      return ownerId;
    },
  };
}

function globalStore(): CredentialStoreMap {
  const storeGlobal = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  const existing = storeGlobal[storeSymbol];
  if (existing instanceof Map) return existing as CredentialStoreMap;

  const store: CredentialStoreMap = new Map();
  storeGlobal[storeSymbol] = store;
  return store;
}

export const credentialSessionStore = createCredentialSessionStore({
  store: globalStore(),
});
