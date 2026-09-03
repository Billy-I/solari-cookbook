# LocaleLens User-Owned Solari Keys — Live Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship LocaleLens as a live-only application that uses each user's own temporary Solari API key through an isolated, server-memory credential session and never falls back to owner credentials or sample results.

**Architecture:** A same-origin credential lifecycle route validates a user-submitted key with one non-session Solari request, stores it only in one long-lived Node process, and references it through an opaque HttpOnly session cookie. Capture and replay routes resolve that credential and bind every provider-session correlation to the same internal owner; the client exposes one live-only flow and retains no runtime fixture path.

**Tech Stack:** Next.js 16.3.4 App Router and Route Handlers, React 19.2.8, TypeScript 5.9.3, Zod 4.5.4, `@solarisdk/browser` 0.1.2, Vitest 4.1.11, Playwright 1.62.1, Axe, Node.js 22.22.2.

**Spec:** `docs/superpowers/specs/2026-09-03-localelens-user-owned-solari-keys-live-only-design.md`

## Global Constraints

- Work only in `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens` on `codex/localelens-byok-live-only`, whose ancestor is exactly `bfe73564786ba7d1a65f43d595e83d7a26530ebf`.
- Run every Node/npm command with `PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin`; verify `node --version` reports `v22.22.2`.
- Read `examples/localelens-web/AGENTS.md` and the relevant bundled Next.js 16.3.4 docs before code changes.
- Preserve and never stage or delete `examples/localelens-web/next-env.d.ts`, `examples/localelens-web/test-results/`, `examples/localelens-web/AGENTS.md`, or `examples/localelens-web/CLAUDE.md`.
- Stage only the explicit files listed in each task. Before every commit run `git diff --cached --name-only`, `git diff --cached --check`, and `git status --short`.
- Use no real API key in tests, source, environment variables, terminal commands, logs, screenshots, files, or chat. Synthetic canaries must be unmistakably fake.
- Do not add an account system, database, persistent vault, shared cache, state library, credential dependency, analytics, telemetry, or a production test-double switch.
- The supported credential runtime is one long-lived Node process. Do not claim support for serverless or horizontally scaled deployments.
- Normal `npm run dev` and `npm run build` are live-only and require no application-mode variable.
- `SOLARI_CAPTURE_DISABLED=true` is the only planned emergency switch. It disables capture and replay; it never enables sample data or changes credentials.
- Every Solari client uses `maxAttempts: 1`; every launch uses `retries: 0`; no provider retry is automatic.
- Keep the maximum-three shared transport pool, deterministic batching, cancellation, stale-response protection, SSRF/DNS/redirect/final-URL checks, bounded evidence, cleanup, and explicit retry.
- Keep historical sample evidence intact. Remove only shipped/runtime sample code and public fixture assets.
- Do not push any intermediate commit. Final push is allowed only after every non-live gate and the separately authorized visible-UI live acceptance pass.
- Do not open a pull request, merge, deploy, release, inspect hosted CI, create or rotate keys, or change repository settings.

---

### Task 1: Build server-only credential and request-security primitives

**Files:**
- Create: `examples/localelens-web/src/features/credential/credential-session-store.ts`
- Create: `examples/localelens-web/src/features/credential/credential-session-store.test.ts`
- Create: `examples/localelens-web/src/features/credential/protocol.ts`
- Create: `examples/localelens-web/src/features/credential/request-security.ts`
- Create: `examples/localelens-web/src/features/credential/request-security.test.ts`
- Modify: `examples/localelens-web/src/lib/solari.ts`
- Modify: `examples/localelens-web/src/lib/solari.test.ts`

**Interfaces:**
- Produces: `CredentialSession { ownerId: string; apiKey: string }`.
- Produces: `CredentialSessionStore.create(apiKey): { token: string; ownerId: string } | null`, `.resolve(token): CredentialSession | null`, and `.delete(token): string | null`.
- Produces: singleton `credentialSessionStore` backed by a process-local global `Map`.
- Produces from the client-safe `protocol.ts`: `LOCAL_REQUEST_HEADER = "x-localelens-request"`, `LOCAL_REQUEST_HEADER_VALUE = "1"`, and `SOLARI_SESSION_PATH = "/api/solari-session"`.
- Produces from the server-only request guard: `assertAppRequest(request, options)` and `isSecureApplicationRequest(request)`.
- Changes: `createSolariClient(apiKey: string): Solari`; there is no zero-argument overload or environment fallback.

- [ ] **Step 1: Record the protected-path baseline and read framework guidance**

Run:

```sh
git branch --show-current
git rev-parse HEAD
git status --short --branch
shasum -a 256 examples/localelens-web/next-env.d.ts examples/localelens-web/AGENTS.md examples/localelens-web/CLAUDE.md examples/localelens-web/test-results/.last-run.json
sed -n '1,220p' examples/localelens-web/AGENTS.md
sed -n '1,220p' examples/localelens-web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
sed -n '1,320p' examples/localelens-web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
```

Expected: branch is `codex/localelens-byok-live-only`; HEAD includes the approved design commit; protected paths remain dirty/untracked exactly as reported at handoff.

- [ ] **Step 2: Write failing store tests**

Add deterministic tests that construct an isolated store:

```ts
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
```

Cover 30-minute idle expiry at `1_801_000`, eight-hour absolute expiry at `28_801_000`, touch-on-resolve, explicit delete, malformed token rejection, expired-entry pruning, two-user isolation, and saturation returning `null` without evicting a live entry.

- [ ] **Step 3: Write failing request-security and explicit-client tests**

Assert:

```ts
expect(() =>
  assertAppRequest(
    new Request("http://localhost/api/solari-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "http://attacker.example",
        "sec-fetch-site": "cross-site",
        "x-localelens-request": "1",
      },
    }),
    { requireJson: true, requireOrigin: true },
  ),
).toThrowError("CROSS_ORIGIN_REQUEST");

process.env.SOLARI_API_KEY = "synthetic-owner-fallback";
expect(() => createSolariClient("")).toThrowError("SOLARI_NOT_CONFIGURED");
expect(createSolariClient("synthetic-user-key")).not.toBe(
  process.env.SOLARI_API_KEY,
);
expect(solariConstructor).toHaveBeenCalledWith({
  apiKey: "synthetic-user-key",
  maxAttempts: 1,
});
```

Also cover missing/wrong custom header, missing Origin for a mutation, exact same-origin success, optional Origin for GET, wrong content type, local HTTP allowance, hosted HTTPS, one trusted `x-forwarded-proto: https`, and ambiguous comma-separated forwarded protocol rejection.

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/credential/credential-session-store.test.ts src/features/credential/request-security.test.ts src/lib/solari.test.ts
```

Expected: FAIL because the credential modules and explicit client signature do not exist.

- [ ] **Step 5: Implement the bounded in-memory store**

Use these exact public types and defaults:

```ts
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
```

Hash the 32-byte base64url token with SHA-256, store the digest as `ownerId`, prune expired records before every operation, update `lastUsedAt` only on a successful resolve, and place the singleton map at `globalThis[Symbol.for("localelens.credential-session-store")]`.

- [ ] **Step 6: Implement request guards and explicit Solari construction**

Put the shared constants in `protocol.ts`:

```ts
export const LOCAL_REQUEST_HEADER = "x-localelens-request";
export const LOCAL_REQUEST_HEADER_VALUE = "1";
export const SOLARI_SESSION_PATH = "/api/solari-session";
```

Import those constants into `request-security.ts`, then use:

```ts
export type AppRequestOptions = {
  requireJson?: boolean;
  requireOrigin: boolean;
};
```

`assertAppRequest` must validate the custom header before reading credentials, reject `Sec-Fetch-Site` values other than `same-origin` when present, compare required Origin to `new URL(request.url).origin`, and require `application/json` for JSON mutations. `isSecureApplicationRequest` returns true for HTTPS, for exactly one `x-forwarded-proto: https`, or for local development hosts `localhost`, `127.0.0.1`, and `[::1]`; production credential use rejects anything else.

Replace the client factory with:

```ts
export function createSolariClient(apiKey: string): Solari {
  if (!apiKey) throw new Error("SOLARI_NOT_CONFIGURED");
  return new Solari({ apiKey, maxAttempts: 1 });
}
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run the Step 4 command again.

Expected: all focused tests PASS and no test reads a real environment key.

- [ ] **Step 8: Commit the server-primitives checkpoint**

Run:

```sh
git add examples/localelens-web/src/features/credential/credential-session-store.ts examples/localelens-web/src/features/credential/credential-session-store.test.ts examples/localelens-web/src/features/credential/protocol.ts examples/localelens-web/src/features/credential/request-security.ts examples/localelens-web/src/features/credential/request-security.test.ts examples/localelens-web/src/lib/solari.ts examples/localelens-web/src/lib/solari.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: add ephemeral Solari credential sessions"
```

Expected: exactly seven task files are committed; protected paths remain unstaged.

### Task 2: Add the same-origin Solari connection lifecycle route

**Files:**
- Create: `examples/localelens-web/app/api/solari-session/route.ts`
- Create: `examples/localelens-web/app/api/solari-session/route.test.ts`
- Create: `examples/localelens-web/src/features/credential/session-cookie.ts`
- Create: `examples/localelens-web/src/features/credential/session-cookie.test.ts`
- Modify: `examples/localelens-web/proxy.ts`
- Modify: `examples/localelens-web/scripts/check-api-methods.mjs`

**Interfaces:**
- Produces: cookie name `localelens_session` and helpers `readSessionToken(request)`, `setSessionCookie(response, token, secure)`, and `clearSessionCookie(response, secure)`.
- Produces: `GET /api/solari-session -> { status: "ready" | "missing" }`.
- Produces: `POST /api/solari-session` accepting strict `{ apiKey: string }` and returning `{ status: "ready" }` or one safe failure object.
- Produces: idempotent `DELETE /api/solari-session` returning 204 and deleting the credential entry; owner-bound replay-record deletion is added in Task 3 after that API exists.
- Extends proxy method policy for the new lifecycle route.

- [ ] **Step 1: Write failing cookie tests**

Assert that setting produces one cookie whose serialized form includes:

```ts
expect(response.headers.getSetCookie()).toEqual([
  expect.stringContaining(
    "localelens_session=opaque-token; Path=/; HttpOnly; SameSite=Strict",
  ),
]);
expect(response.headers.getSetCookie()[0]).not.toContain("Max-Age");
expect(response.headers.getSetCookie()[0]).not.toContain("Expires");
```

Cover `Secure` in production, no `Secure` for local HTTP, no Domain, token read from `NextRequest.cookies`, and clearing with an empty value plus `Max-Age=0`.

- [ ] **Step 2: Write failing lifecycle route tests**

Hoist and mock only `createSolariClient` and `credentialSessionStore`. Use a distinctive synthetic key and assert:

```ts
const response = await POST(
  new NextRequest("http://localhost/api/solari-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "http://localhost",
      "sec-fetch-site": "same-origin",
      "x-localelens-request": "1",
    },
    body: JSON.stringify({ apiKey: "synthetic-user-auth-canary" }),
  }),
);

expect(request).toHaveBeenCalledWith("GET", "/profiles");
expect(sessionsCreate).not.toHaveBeenCalled();
expect(credentialSessionStore.create).toHaveBeenCalledWith(
  "synthetic-user-auth-canary",
);
expect(await response.json()).toEqual({ status: "ready" });
expect(JSON.stringify([...response.headers])).not.toContain(
  "synthetic-user-auth-canary",
);
expect(response.url).not.toContain("synthetic-user-auth-canary");
```

Cover POST 401/403 authentication failure, 429/capacity, 5xx/unavailable, transport failure, oversized body, invalid JSON, extra fields, empty/over-512-character key, fixed request pathname with no key/query-string interpolation, exact no-store headers, client cleanup, zero retry, store saturation, prior-session deletion on failure, rotated cookie on success, GET ready/missing/expired, idempotent DELETE, cross-origin zero-store/zero-provider behavior, HTTPS production failure, and 405/OPTIONS methods including HEAD rejection.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/credential/session-cookie.test.ts app/api/solari-session/route.test.ts
```

Expected: FAIL because the cookie helpers and route do not exist.

- [ ] **Step 4: Implement cookie helpers**

Use `NextRequest.cookies.get` for reads and `NextResponse.cookies.set` for writes. Set:

```ts
{
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  secure,
}
```

Do not set Domain, Expires, or Max-Age on a live session cookie. Clearing sets the same path/security/sameSite attributes and `maxAge: 0`.

- [ ] **Step 5: Implement the lifecycle route**

Use strict body parsing:

```ts
const connectSchema = z
  .object({ apiKey: z.string().min(1).max(512) })
  .strict();
```

On POST, call `client.request("GET", "/profiles")`, inspect only status, cancel `providerResponse.body`, and always `await client.close()` in `finally`. Create the store entry only for a 2xx response. Map 401/403 to `authentication_failed`, map other statuses and transport failure to `authentication_unavailable`, and return no provider body. All JSON responses use `Cache-Control: private, no-store`, `Pragma: no-cache`, and `Expires: 0`.

- [ ] **Step 6: Extend route method protection**

Update `proxy.ts` so:

```ts
const methodsByPath = {
  "/api/captures": ["POST", "OPTIONS"],
  "/api/solari-session": ["GET", "POST", "DELETE", "OPTIONS"],
} as const;
```

Replay routes allow only `GET, OPTIONS`; export an explicit no-store 405 handler for HEAD so a probe cannot trigger a provider replay lookup. Update `check-api-methods.mjs` to probe the lifecycle route without a key and assert safe no-store responses; never call Solari.

- [ ] **Step 7: Run route, proxy, and method tests**

Run:

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/credential/session-cookie.test.ts app/api/solari-session/route.test.ts
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 8: Commit the lifecycle-route checkpoint**

```sh
git add examples/localelens-web/app/api/solari-session/route.ts examples/localelens-web/app/api/solari-session/route.test.ts examples/localelens-web/src/features/credential/session-cookie.ts examples/localelens-web/src/features/credential/session-cookie.test.ts examples/localelens-web/proxy.ts examples/localelens-web/scripts/check-api-methods.mjs
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: add Solari connection lifecycle"
```

### Task 3: Bind provider-session correlations to credential owners

**Files:**
- Modify: `examples/localelens-web/src/features/capture/run-session-registry.ts`
- Modify: `examples/localelens-web/src/features/capture/run-session-registry.test.ts`
- Modify: `examples/localelens-web/app/api/solari-session/route.ts`
- Modify: `examples/localelens-web/app/api/solari-session/route.test.ts`

**Interfaces:**
- Changes: `RegisterRunSessionInput` adds `ownerId: string`.
- Changes: `RunSessionRegistry.lookup(ownerId, correlation): string | null`.
- Produces: `RunSessionRegistry.deleteOwner(ownerId): void`.
- Changes: global wrappers become `registerRunSession(input)`, `lookupRunSession(ownerId, correlation)`, and `deleteRunSessionsForOwner(ownerId)`.
- Changes: successful lifecycle DELETE calls `credentialSessionStore.delete(token)`, receives the deleted owner ID, and passes it to `deleteRunSessionsForOwner(ownerId)`.

- [ ] **Step 1: Write failing owner-isolation tests**

Add:

```ts
const correlation = registry.register({
  ownerId: "a".repeat(64),
  runId,
  country: "us",
  attempt: 1,
  sessionId: "raw-provider-session-id",
});

expect(registry.lookup("a".repeat(64), correlation)).toBe(
  "raw-provider-session-id",
);
expect(registry.lookup("b".repeat(64), correlation)).toBeNull();
registry.deleteOwner("a".repeat(64));
expect(registry.lookup("a".repeat(64), correlation)).toBeNull();
```

Assert an invalid owner ID is rejected, safe correlation never serializes ownerId or raw session ID, owner deletion removes only that owner's entries, and existing one-hour/100-run bounds remain effective per process.

- [ ] **Step 2: Run the registry test and verify RED**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/capture/run-session-registry.test.ts
```

Expected: FAIL because the registry is not owner-bound.

- [ ] **Step 3: Implement owner binding**

Validate owner IDs with `/^[0-9a-f]{64}$/`. Include ownerId only in the internal record and key:

```ts
function entryKey(
  ownerId: string,
  country: SupportedCountry,
  attempt: number,
): string {
  return ownerId + ":" + country + ":" + String(attempt);
}
```

Never add ownerId to `CaptureCorrelation`, response contracts, logs, exports, or UI. `deleteOwner` iterates bounded in-memory records and removes matching internal entries.

- [ ] **Step 4: Run the registry test and verify GREEN**

Wire lifecycle DELETE to the new owner-deletion wrapper, add a route assertion that only the deleted owner's correlations are invalidated, then run:

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/capture/run-session-registry.test.ts app/api/solari-session/route.test.ts
```

Expected: PASS with cross-owner lookup returning null and zero raw-ID leakage.

- [ ] **Step 5: Commit the owner-bound registry checkpoint**

```sh
git add examples/localelens-web/src/features/capture/run-session-registry.ts examples/localelens-web/src/features/capture/run-session-registry.test.ts examples/localelens-web/app/api/solari-session/route.ts examples/localelens-web/app/api/solari-session/route.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: isolate Solari session ownership"
```

### Task 4: Migrate capture and replay routes to user-owned credentials

**Files:**
- Modify: `examples/localelens-web/app/api/captures/route.ts`
- Modify: `examples/localelens-web/app/api/captures/route.test.ts`
- Modify: `examples/localelens-web/app/api/replays/[id]/route.ts`
- Modify: `examples/localelens-web/app/api/replays/[id]/route.test.ts`
- Modify: `examples/localelens-web/src/features/capture/error-codes.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.test.ts`
- Modify: `examples/localelens-web/src/features/run/run-comparison.ts`
- Modify: `examples/localelens-web/src/features/run/run-comparison.test.ts`
- Modify: `examples/localelens-web/src/components/replay-link.tsx`
- Modify: `examples/localelens-web/src/components/replay-link.test.tsx`
- Modify: `examples/localelens-web/.env.example`

**Interfaces:**
- Capture and replay accept the opaque cookie and resolve `CredentialSession` before creating a Solari client.
- Capture registration passes the resolved `ownerId`; replay lookup requires the same `ownerId`.
- `run-comparison.ts` and `ReplayLink` send `x-localelens-request: 1`.
- `SOLARI_CAPTURE_DISABLED=true` disables provider capture and replay only.
- `SOLARI_AUTH` remains the public capture category and invalidates the credential session when the provider proves 401/403.

- [ ] **Step 1: Replace owner-key route tests with failing BYOK tests**

Remove environment-key setup from both route tests. Hoist a mocked credential store:

```ts
credentialSessionStore.resolve.mockReturnValue({
  ownerId: "a".repeat(64),
  apiKey: "synthetic-user-capture-canary",
});
```

Assert missing/expired cookie causes zero `createSolariClient` and zero `captureRegion` calls. Set `process.env.SOLARI_API_KEY = "synthetic-owner-fallback"` and assert it is never passed to any client.

For capture success assert:

```ts
expect(createSolariClient).toHaveBeenCalledWith(
  "synthetic-user-capture-canary",
);
expect(registerRunSession).toHaveBeenCalledWith({
  ownerId: "a".repeat(64),
  runId,
  country: "us",
  attempt: 1,
  sessionId: "raw-provider-session-id",
});
```

For replay assert owner A can resolve its session, owner B receives unavailable and makes zero provider calls, and provider 401/403 deletes the credential plus the owner's run correlations.

- [ ] **Step 2: Add failing client-request header tests**

In `run-comparison.test.ts` assert each capture fetch has:

```ts
expect(fetch).toHaveBeenCalledWith(
  "/api/captures",
  expect.objectContaining({
    headers: {
      "Content-Type": "application/json",
      "x-localelens-request": "1",
    },
  }),
);
```

In `replay-link.test.tsx`, assert the replay fetch includes the same custom header. Add cross-origin/missing-header route tests that make zero store or provider calls.

- [ ] **Step 3: Run focused tests and verify RED**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- app/api/captures/route.test.ts app/api/replays/'[id]'/route.test.ts src/features/capture/safe-error.test.ts src/features/run/run-comparison.test.ts src/components/replay-link.test.tsx
```

Expected: FAIL because routes still use `process.env.SOLARI_API_KEY` and client fetches lack the request header.

- [ ] **Step 4: Migrate the capture route**

Order the route boundary as:

```ts
assertAppRequest(request, { requireJson: true, requireOrigin: true });
if (process.env.SOLARI_CAPTURE_DISABLED === "true") return disabledFailure();
const parsedRequest = await parseBoundedCaptureRequest(request);
const token = readSessionToken(request);
const credential = token
  ? credentialSessionStore.resolve(token)
  : null;
if (!credential) return authenticationFailure();
```

Inject `createClient: () => createSolariClient(credential.apiKey)` and register sessions with `ownerId: credential.ownerId`. If the safe result is `SOLARI_AUTH`, delete the credential entry, delete that owner's run correlations, and clear the response cookie. Keep all existing body, validation, status, cleanup, logging, and no-store behavior.

- [ ] **Step 5: Migrate the replay route**

Validate the custom header and emergency switch before resolving credentials. Parse correlation before provider work. Resolve:

```ts
const providerSessionId = lookupRunSession(
  credential.ownerId,
  parsedCorrelation.data,
);
```

Create the client with `credential.apiKey`. On provider 401/403, invalidate the credential owner and return only `{ status: "unavailable" }`. Preserve safe HTTPS replay URL validation and client cleanup.

- [ ] **Step 6: Add the request header and disable-only environment example**

Add `LOCAL_REQUEST_HEADER: LOCAL_REQUEST_HEADER_VALUE` to capture and replay fetches. Replace `.env.example` contents with:

```dotenv
# Optional emergency stop. Normal live-only development omits this variable.
SOLARI_CAPTURE_DISABLED=false
```

No key or application-mode variable may remain.

- [ ] **Step 7: Run focused and retained security tests**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- app/api/captures/route.test.ts app/api/replays/'[id]'/route.test.ts src/features/capture/safe-error.test.ts src/features/capture/capture-region.test.ts src/features/capture/run-session-registry.test.ts src/features/capture/validate-public-url.test.ts src/features/run/run-comparison.test.ts src/components/replay-link.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
```

Expected: PASS; retained SSRF, cleanup, timeout, no-retry, and replay protections remain green.

- [ ] **Step 8: Run owner-fallback and raw-ID scans**

```sh
rg -n 'process\.env\.SOLARI_API_KEY|SOLARI_API_KEY' app src --glob '!**/*.test.*'
rg -n 'sessionId|browser\.id' app src --glob '!**/*.test.*'
```

Expected: first scan is empty. Second scan finds raw provider IDs only at the capture lifecycle and server registry boundaries; no client component, response contract, export, or log contains one.

- [ ] **Step 9: Commit the route-migration checkpoint**

```sh
git add examples/localelens-web/app/api/captures/route.ts examples/localelens-web/app/api/captures/route.test.ts examples/localelens-web/app/api/replays/'[id]'/route.ts examples/localelens-web/app/api/replays/'[id]'/route.test.ts examples/localelens-web/src/features/capture/error-codes.ts examples/localelens-web/src/features/capture/safe-error.ts examples/localelens-web/src/features/capture/safe-error.test.ts examples/localelens-web/src/features/run/run-comparison.ts examples/localelens-web/src/features/run/run-comparison.test.ts examples/localelens-web/src/components/replay-link.tsx examples/localelens-web/src/components/replay-link.test.tsx examples/localelens-web/.env.example
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: authorize captures with user credentials"
```

### Task 5: Remove every shipped sample path and make run contracts live-only

**Files:**
- Modify: `examples/localelens-web/src/features/run/use-comparison-run.ts`
- Modify: `examples/localelens-web/src/features/run/use-comparison-run.test.tsx`
- Delete: `examples/localelens-web/src/features/run/use-sample-run.ts`
- Delete: `examples/localelens-web/src/features/run/use-sample-run.test.tsx`
- Modify: `examples/localelens-web/src/features/capture/contracts.ts`
- Modify: `examples/localelens-web/src/test/contracts.test.ts`
- Modify: `examples/localelens-web/src/features/export/create-json-report.ts`
- Modify: `examples/localelens-web/src/features/export/create-json-report.test.ts`
- Modify: `examples/localelens-web/src/components/run-receipt.tsx`
- Modify: `examples/localelens-web/src/components/run-receipt.test.tsx`
- Modify: `examples/localelens-web/src/components/export-actions.tsx`
- Modify: `examples/localelens-web/src/components/export-actions.test.tsx`
- Modify: `examples/localelens-web/src/components/comparison-results.tsx`
- Modify: `examples/localelens-web/src/components/comparison-results.test.tsx`
- Modify: `examples/localelens-web/src/components/region-result.tsx`
- Modify: `examples/localelens-web/src/components/region-result.test.tsx`
- Delete: `examples/localelens-web/public/sample/us.jpg`
- Delete: `examples/localelens-web/public/sample/gb.jpg`
- Delete: `examples/localelens-web/public/sample/de.jpg`

**Interfaces:**
- Removes: `ComparisonRun.mode`, `ComparisonRunOptions.mode`, `fixtureLookup`, sample timers, and sample country execution.
- Changes: `useComparisonRun(options)` always calls the live comparison/country runners.
- Changes: receipt, result, and export components no longer accept a mode prop.
- Changes: JSON report to `schemaVersion: 3` and `provenance: "live_solari"`; no sample/live union remains in production contracts.
- Keeps: `src/test/fixtures.ts` as a test-only data factory imported exclusively by test files.

- [ ] **Step 1: Write failing live-only run tests**

Replace mode-loop tests with assertions that the default hook calls the injected comparison runner immediately after explicit `start`:

```ts
const comparisonRunner = vi.fn<ComparisonRunner>(async () => undefined);
const { result } = renderHook(() =>
  useComparisonRun({ comparisonRunner, createRunId: () => runId }),
);

await act(async () => {
  await result.current.start(value);
});

expect(comparisonRunner).toHaveBeenCalledOnce();
expect(result.current).not.toHaveProperty("mode");
```

Add a source-boundary assertion that `use-comparison-run.ts` contains neither `src/test/fixtures`, `NEXT_PUBLIC_APP_MODE`, `fixtureLookup`, nor `sample`.

- [ ] **Step 2: Write failing component and export provenance tests**

Assert:

```ts
expect(createJsonReport(input).json).toContain(
  '"provenance": "live_solari"',
);
expect(createJsonReport(input).json).not.toContain('"mode"');
expect(screen.getByText("Live Solari capture")).toBeVisible();
expect(screen.queryByText(/sample|demo/i)).not.toBeInTheDocument();
```

Update region tests so a successful response always renders its base64 screenshot, **Live evidence**, safe correlation, and replay control. No production component may resolve `/sample/*.jpg`.

- [ ] **Step 3: Run focused tests and verify RED**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/run/use-comparison-run.test.tsx src/test/contracts.test.ts src/features/export/create-json-report.test.ts src/components/run-receipt.test.tsx src/components/export-actions.test.tsx src/components/comparison-results.test.tsx src/components/region-result.test.tsx
```

Expected: FAIL because mode and fixture branches still exist.

- [ ] **Step 4: Simplify the run hook**

Remove all fixture imports, `mode`, `FixtureLookup`, sample delays, and `runSampleCountry`. The only start path is:

```ts
await comparisonRunner(
  validatedValue,
  { runId, attempt: 1 },
  eventsFor(operationId, generation),
  controller.signal,
  transportPoolRef.current,
);
```

The only retry path calls `countryRunner`. Keep handoff settlement, generation guards, operation IDs, cancellation, attempt counting, deterministic batching, and the shared three-slot pool unchanged.

- [ ] **Step 5: Make response presentation and exports live-only**

Remove mode props and branches. `RunReceipt` always renders `Live Solari capture`. `RegionResult` always uses:

```tsx
<p className="capture-provenance">Live evidence</p>
<Image
  alt={countryName + " evidence for " + host + ", captured " + capturedAt}
  height={900}
  src={"data:image/jpeg;base64," + region.response.screenshot.base64}
  unoptimized
  width={region.response.screenshot.width}
/>
```

Define the report provenance exactly:

```ts
type JsonReport = {
  schemaVersion: 3;
  provenance: "live_solari";
  generatedAt: string;
  runId: AppRunId;
  status: "complete" | "partial";
};
```

Retain the current safe target, result, failure, comparison, limitation, size, and correlation fields.

- [ ] **Step 6: Delete only the explicit runtime sample files**

Use `apply_patch` to delete the two sample-hook files. Delete each named public image as an individual explicit operation; do not use wildcards, recursive deletion, or a cleanup loop. Do not delete `src/test/fixtures.ts`, historical evidence images, phase evidence, or archived documentation.

After the two text-file patches, run these three literal commands separately:

```sh
rm examples/localelens-web/public/sample/us.jpg
rm examples/localelens-web/public/sample/gb.jpg
rm examples/localelens-web/public/sample/de.jpg
```

- [ ] **Step 7: Run focused and retained orchestration tests**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/run/run-comparison.test.ts src/features/run/use-comparison-run.test.tsx src/test/contracts.test.ts src/features/export/create-json-report.test.ts src/components/run-receipt.test.tsx src/components/export-actions.test.tsx src/components/comparison-results.test.tsx src/components/region-result.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
```

Expected: PASS. No production source imports a test fixture or sample hook.

- [ ] **Step 8: Run the production sample-path scan**

```sh
rg -n 'NEXT_PUBLIC_APP_MODE|useSampleRun|use-sample-run|fixtureLookup|featured sample|featured demo|sampleCaptureByCountry|/sample/' app src/components src/features --glob '!**/*.test.*'
```

Expected: no matches.

- [ ] **Step 9: Commit the live-only domain checkpoint**

```sh
git add examples/localelens-web/src/features/run/use-comparison-run.ts examples/localelens-web/src/features/run/use-comparison-run.test.tsx examples/localelens-web/src/features/run/use-sample-run.ts examples/localelens-web/src/features/run/use-sample-run.test.tsx examples/localelens-web/src/features/capture/contracts.ts examples/localelens-web/src/test/contracts.test.ts examples/localelens-web/src/features/export/create-json-report.ts examples/localelens-web/src/features/export/create-json-report.test.ts examples/localelens-web/src/components/run-receipt.tsx examples/localelens-web/src/components/run-receipt.test.tsx examples/localelens-web/src/components/export-actions.tsx examples/localelens-web/src/components/export-actions.test.tsx examples/localelens-web/src/components/comparison-results.tsx examples/localelens-web/src/components/comparison-results.test.tsx examples/localelens-web/src/components/region-result.tsx examples/localelens-web/src/components/region-result.test.tsx examples/localelens-web/public/sample/us.jpg examples/localelens-web/public/sample/gb.jpg examples/localelens-web/public/sample/de.jpg
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "refactor: make LocaleLens live only"
```

### Task 6: Add the session-only Solari connection UI and comparison gate

**Files:**
- Create: `examples/localelens-web/src/features/credential/use-solari-connection.ts`
- Create: `examples/localelens-web/src/features/credential/use-solari-connection.test.tsx`
- Create: `examples/localelens-web/src/components/solari-connection.tsx`
- Create: `examples/localelens-web/src/components/solari-connection.test.tsx`
- Modify: `examples/localelens-web/src/components/audit-form.tsx`
- Modify: `examples/localelens-web/src/components/audit-form.test.tsx`
- Modify: `examples/localelens-web/app/page.tsx`
- Modify: `examples/localelens-web/app/page.test.tsx`
- Modify: `examples/localelens-web/app/globals.css`

**Interfaces:**
- Produces: `SolariConnectionState = "checking" | "missing" | "entered" | "authenticating" | "authentication_failed" | "authentication_unavailable" | "ready" | "disconnecting"`.
- Produces: `useSolariConnection(): SolariConnectionController` with `apiKey`, `setApiKey`, `state`, `message`, `ready`, `connect()`, `disconnect()`, and `markAuthenticationFailed()`.
- Changes: `AuditForm` accepts `connectionReady: boolean` and `onNeedsConnection(): void`; it no longer accepts mode.
- Page owns both hooks, renders connection first, and marks connection failed when a region returns `SOLARI_AUTH`.

- [ ] **Step 1: Write failing connection-hook tests**

Test the status bootstrap:

```ts
expect(fetch).toHaveBeenCalledWith("/api/solari-session", {
  cache: "no-store",
  headers: { "x-localelens-request": "1" },
});
expect(result.current.state).toBe("missing");
```

For explicit connection:

```ts
act(() => result.current.setApiKey("synthetic-browser-key-canary"));
expect(result.current.state).toBe("entered");
expect(fetch).toHaveBeenCalledTimes(1);

await act(async () => result.current.connect());
expect(fetch).toHaveBeenLastCalledWith(
  "/api/solari-session",
  expect.objectContaining({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-localelens-request": "1",
    },
  }),
);
expect(result.current.apiKey).toBe("");
expect(result.current.state).toBe("ready");
```

Cover malformed responses, rejected fetch, authentication failure, unavailable service, double-submit prevention, unmount abort, disconnect, state restoration, and `markAuthenticationFailed`. Assert no key, substring sentinel, response body, or token is copied into messages.

- [ ] **Step 2: Write failing UI and page tests**

Assert the connection UI contains:

```tsx
expect(screen.getByRole("heading", { name: "Solari connection" })).toBeVisible();
expect(screen.getByLabelText("Solari API key")).toHaveAttribute("type", "password");
expect(screen.getByRole("button", { name: "Use my Solari key" })).toBeVisible();
expect(screen.getByRole("link", { name: "Get a Solari API key" })).toHaveAttribute(
  "href",
  "https://console.getsolari.com/",
);
expect(screen.getByRole("link", { name: "Get a Solari API key" })).toHaveAttribute(
  "rel",
  expect.stringContaining("noopener"),
);
```

Assert the page initially has no regional results, sample/demo text, mode switch, or fixture host. The compare button is disabled before ready. Typing/pasting the key causes no POST and no capture. After mocked ready, the form enables. Invalid authentication creates no results.

- [ ] **Step 3: Run focused tests and verify RED**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/credential/use-solari-connection.test.tsx src/components/solari-connection.test.tsx src/components/audit-form.test.tsx app/page.test.tsx
```

Expected: FAIL because the connection hook/component and live-only page gate do not exist.

- [ ] **Step 4: Implement the connection state hook**

Use a strict response parser that accepts only exact-key objects:

```ts
type StatusResponse =
  | { status: "missing" }
  | { status: "ready" }
  | {
      status: "authentication_failed" | "authentication_unavailable";
      message: string;
    };
```

The initial GET checks only the local credential session. `setApiKey` changes state without fetching. `connect` copies the current key into one request body, immediately clears React state, and never restores it after failure. `disconnect` sends DELETE, clears local state in `finally`, and returns to missing even if the network response is unavailable.

- [ ] **Step 5: Implement the accessible connection component**

Use a real form, visible password label, status region, and links:

```tsx
<a
  href="https://console.getsolari.com/"
  rel="noopener noreferrer"
  target="_blank"
>
  Get a Solari API key
</a>
```

Copy must state:

- “Captures use your Solari account and may consume your Solari credits.”
- “Your key is temporary. LocaleLens keeps it only for this browser session and does not save it.”
- “Solari shows a newly created key once. Copy it when you create it and keep it private.”

Use **Use my Solari key**, **Authenticating…**, **Ready for this session**, **Authentication failed**, and **Disconnect** exactly. Do not render a fingerprint, length, prefix, suffix, or masked echo after submission.

- [ ] **Step 6: Gate the audit form and rebuild the page**

`AuditForm` starts with an empty URL string rather than the historical fixture target. Its `submit` starts with:

```ts
if (!connectionReady) {
  onNeedsConnection();
  return;
}
```

Disable only the submit action while disconnected; keep URL and market inputs available unless a comparison is busy. Set `aria-describedby` to the connection guidance.

In `page.tsx`, remove featured fixtures and render no receipt, status, results, or export evidence before `run.value` exists. Render `SolariConnection` before `AuditForm`. Watch region failures for `SOLARI_AUTH` and call `markAuthenticationFailed()` once per invalidated connection.

- [ ] **Step 7: Add focused styling without redesigning the product**

Add only connection-section, state, guidance, input, and responsive styles using existing colors, spacing, focus outlines, action classes, 44px targets, and reduced-motion rules. Remove obsolete `.sample-control` and `.sample-definition` rules. Do not reformat unrelated CSS.

- [ ] **Step 8: Run focused tests, typecheck, and lint**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test -- src/features/credential/use-solari-connection.test.tsx src/components/solari-connection.test.tsx src/components/audit-form.test.tsx app/page.test.tsx src/features/run/use-comparison-run.test.tsx src/components/run-status.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run lint
```

Expected: focused tests, typecheck, and lint PASS.

- [ ] **Step 9: Commit the connection-UI checkpoint**

```sh
git add examples/localelens-web/src/features/credential/use-solari-connection.ts examples/localelens-web/src/features/credential/use-solari-connection.test.tsx examples/localelens-web/src/components/solari-connection.tsx examples/localelens-web/src/components/solari-connection.test.tsx examples/localelens-web/src/components/audit-form.tsx examples/localelens-web/src/components/audit-form.test.tsx examples/localelens-web/app/page.tsx examples/localelens-web/app/page.test.tsx examples/localelens-web/app/globals.css
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: add session-only Solari connection"
```

### Task 7: Replace sample E2E with live-only test doubles and enforce production boundaries

**Files:**
- Modify: `examples/localelens-web/playwright.config.ts`
- Modify: `examples/localelens-web/e2e/comparison.spec.ts`
- Modify: `examples/localelens-web/e2e/accessibility.spec.ts`
- Modify: `examples/localelens-web/e2e/responsive.spec.ts`
- Create: `examples/localelens-web/e2e/support/solari-test-double.ts`
- Create: `examples/localelens-web/scripts/check-production-boundaries.mjs`
- Modify: `examples/localelens-web/package.json`
- Modify: `examples/localelens-web/scripts/check-client-budget.mjs`

**Interfaces:**
- Playwright starts the normal live-only `npm run dev` command with no mode or credential environment variable.
- Test-only route interception lives exclusively under `e2e/support`.
- Produces: `npm run check:production-boundaries`, run after a production build.
- Production boundary script scans source imports, public assets, `.next/static`, and `.next/server/app` for forbidden sample/credential markers.

- [ ] **Step 1: Write the failing production-boundary script tests in the script itself**

Make the script export pure helpers and run as a CLI. Its assertions must fail on a temporary in-memory file list containing:

```js
[
  'app/page.tsx -> @/src/test/fixtures',
  'src/features/run/use-sample-run.ts',
  'public/sample/us.jpg',
  '.next/static/chunks/app.js -> synthetic-secret-build-canary',
]
```

and pass on production files containing user-facing words such as “sample mode is historical” only in current documentation, not runtime code. The CLI scans:

- `app/**/*.ts,tsx`;
- production `src/components`, `src/features`, and `src/lib`;
- `public/`;
- `.next/static/`; and
- `.next/server/app/`; and
- client-reference manifests for imports of credential-store, session-cookie, or server Solari modules.

- [ ] **Step 2: Write failing live-only Playwright journeys**

The test helper intercepts `/api/solari-session`, `/api/captures`, and `/api/replays/*` in the browser test only. It records authentication and capture calls separately and returns strict synthetic `.test` evidence.

The desktop journey must assert:

```ts
await page.goto("/");
await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
await expect(page.getByRole("button", { name: "Compare live through Solari" }))
  .toBeDisabled();

await page.getByLabel("Solari API key").fill("synthetic-playwright-key");
expect(testDouble.captureCalls).toHaveLength(0);
await page.getByRole("button", { name: "Use my Solari key" }).click();
expect(testDouble.authenticationCalls).toHaveLength(1);
expect(testDouble.captureCalls).toHaveLength(0);
expect(await page.content()).not.toContain("synthetic-playwright-key");
```

Then select a target and markets, click compare once, assert the exact capture count, no automatic retry after one synthetic provider failure, live provenance, partial comparisons, safe export, disconnect, blocked comparison, and no console errors. Never call the production SDK.

- [ ] **Step 3: Run E2E and boundary checks to verify RED**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run test:e2e
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:production-boundaries
```

Expected: FAIL because Playwright still expects the featured demo and the new script does not exist.

- [ ] **Step 4: Implement the test-only route double**

Keep every synthetic response and key under `e2e/`. The helper exposes:

```ts
export type SolariTestDouble = {
  authenticationCalls: string[];
  captureCalls: Array<{ country: string; attempt: number }>;
  install(page: Page): Promise<void>;
};
```

The helper may inspect the submitted key only to record the literal category `authentication`; it must not store or print the value. Return one synthetic retryable country failure and successful siblings. Do not add any `NODE_ENV=test` or environment-controlled double to production code.

- [ ] **Step 5: Update Playwright configuration and journeys**

Remove `NEXT_PUBLIC_APP_MODE` from `webServer.env`. Keep `NEXT_DIST_DIR=.next-e2e`, a dedicated non-reused server, zero CI retries, and the existing Chromium project. Update responsive, keyboard, focus, target-size, reduced-motion, export, and Axe journeys for the connection-first live-only UI.

Tests must distinguish:

- one authentication request after button click;
- zero captures before explicit comparison;
- exact initial captures after comparison;
- zero automatic retry after a failure; and
- one extra capture only after explicit retry.

- [ ] **Step 6: Implement production-boundary and budget scans**

The boundary command exits nonzero if it finds runtime `NEXT_PUBLIC_APP_MODE`, `process.env.SOLARI_API_KEY`, imports from `src/test`, `use-sample-run`, files under `public/sample`, the synthetic build canary in `.next/static` or `.next/server/app`, or client-manifest references to credential-bearing server modules.

Update `check-client-budget.mjs` to keep its existing gzip limit and also fail if a main-route client chunk contains `SOLARI_API_KEY`, `credential-session-store`, `createSolariClient`, or the synthetic canary.

Add:

```json
{
  "scripts": {
    "check:production-boundaries": "node scripts/check-production-boundaries.mjs"
  }
}
```

Preserve every existing required script except remove the obsolete `test:e2e:sample` alias.

The production-boundary script must also reject credential code that writes to `localStorage`, `sessionStorage`, `indexedDB`, the Cache API, filesystem APIs, or analytics/telemetry sinks. Test-only files remain outside this scan.

- [ ] **Step 7: Build with a synthetic owner-fallback canary and run checks**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin SOLARI_API_KEY=synthetic-secret-build-canary npm run build
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:budget
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:production-boundaries
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run test:e2e
```

Expected: build and all three checks PASS; the canary is absent from browser chunks and rendered/RSC server output under `.next/static` and `.next/server/app`; no provider call occurs.

- [ ] **Step 8: Commit the E2E and boundary checkpoint**

```sh
git add examples/localelens-web/playwright.config.ts examples/localelens-web/e2e/comparison.spec.ts examples/localelens-web/e2e/accessibility.spec.ts examples/localelens-web/e2e/responsive.spec.ts examples/localelens-web/e2e/support/solari-test-double.ts examples/localelens-web/scripts/check-production-boundaries.mjs examples/localelens-web/package.json examples/localelens-web/scripts/check-client-budget.mjs
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: prove live-only credential boundaries"
```

### Task 8: Rewrite current documentation and pass the complete credential-free gate

**Files:**
- Modify: `examples/localelens-web/README.md`
- Modify: `examples/localelens-web/docs/evidence/live-product-readiness/manual-acceptance.md`
- Create: `examples/localelens-web/docs/evidence/byok-live-only.md`

**Interfaces:**
- README becomes the current live-only operating guide.
- Manual acceptance becomes the owner-entered visible-UI procedure.
- Evidence report separates unit, route, E2E double, Browser, live provider, dashboard, hosted, and assistive-technology claims.

- [ ] **Step 1: Write the current live-only README**

Document the normal command:

```sh
cd examples/localelens-web
nvm use 22.22.2
npm install
npm run dev
```

State that users obtain a key at `https://console.getsolari.com/`, Solari displays a new key once, and the key must remain private. Explain connect/disconnect, 30-minute idle and eight-hour absolute expiry, process restart, session-cookie/browser-restore limitations, single-instance/HTTPS support, per-country capture count and credit use, the disable-only switch, real-result recognition, failure categories, safe stopping, historical sample evidence, and test-only doubles.

Remove every instruction to set `SOLARI_API_KEY`, use Keychain, set `NEXT_PUBLIC_APP_MODE`, or start sample mode.

- [ ] **Step 2: Rewrite manual acceptance as a credential-safe visible-UI procedure**

The procedure must require:

1. all credential-free checks passing;
2. one exact local server and port;
3. Browser inspection before key entry;
4. user takeover for masked key entry;
5. separate reporting of the non-session authentication request;
6. exact target, market list, and capture count stated before billing approval;
7. comparison initiated only through the visible UI;
8. no curl, script, test, or developer-tool capture;
9. actual result/failure and dashboard correlation only;
10. UI disconnect and exact-process shutdown.

Do not retain the old Keychain wrapper or owner credential instructions.

- [ ] **Step 3: Create the evidence report from observed outputs**

Record exact commit range and command outputs already observed during Tasks 1–7. Use separate verdict rows for unit/component, route security, Playwright test double, production build/bundle, Browser desktop/mobile, live provider, dashboard, hosted deployment, and assistive technology. Mark any unrun category `NOT RUN` and any insufficient category `NOT PROVEN`; do not use fixture or browser evidence to close provider claims.

- [ ] **Step 4: Run the complete non-live verification gate**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin node --version
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run lint
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin SOLARI_API_KEY=synthetic-secret-build-canary npm run build
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:budget
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:api-methods
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:production-boundaries
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run test:e2e
```

Expected: Node `v22.22.2`; all commands PASS; no live Solari capture occurs.

- [ ] **Step 5: Run scoped source, secret, and public-bundle scans**

```sh
rg -n 'NEXT_PUBLIC_APP_MODE|process\.env\.SOLARI_API_KEY|useSampleRun|use-sample-run|sampleCaptureByCountry|fixtureLookup|/sample/' app src/components src/features public --glob '!**/*.test.*'
rg -n 'synthetic-secret-build-canary|synthetic-user-auth-canary|synthetic-user-capture-canary|synthetic-playwright-key' .next/static .next/server/app
rg -n 'credential-session-store|session-cookie|createSolariClient|@solarisdk/browser' .next/static
git diff --check bfe73564786ba7d1a65f43d595e83d7a26530ebf..HEAD
```

Expected: source scan empty; canary scan empty; server-module scan empty; diff check clean.

- [ ] **Step 6: Inspect the UI in the named in-app Browser without a credential**

Start `npm run dev` normally on one inspected free port. Use the Browser workflow to inspect 1440×900, 640×720, and 360×800. Verify no sample results, connection guidance, masked field, safe links, blocked comparison, keyboard focus, reflow, and no console errors. Do not enter any key and do not start a capture. Stop the exact server after recording the Browser-only evidence.

- [ ] **Step 7: Recheck protected paths and update evidence with exact results**

Compare the protected-path hashes and status to the Task 1 baseline. If a tool changed `next-env.d.ts` or test results, restore only the tool-caused delta to the exact pre-task bytes without staging or deleting the protected path. Never use a broad checkout, reset, wildcard deletion, or recursive cleanup.

- [ ] **Step 8: Commit documentation and verified non-live evidence**

```sh
git add examples/localelens-web/README.md examples/localelens-web/docs/evidence/live-product-readiness/manual-acceptance.md examples/localelens-web/docs/evidence/byok-live-only.md
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "docs: document live-only user keys"
```

Expected: exactly three documentation files are committed. Do not push.

### Task 9: Perform owner-authorized live acceptance, publish final evidence, and push

**Files:**
- Modify: `examples/localelens-web/docs/evidence/byok-live-only.md`
- Modify: `examples/localelens-web/docs/evidence/live-product-readiness/manual-acceptance.md` only if the observed procedure requires a truthful correction

**Interfaces:**
- Consumes: fully green credential-free gate and Browser inspection from Task 8.
- Produces: exact live authentication-request count, billable capture-call count, UI outcome, dashboard outcome, disconnect proof, server-stop proof, final evidence commit, and remote SHA parity.

- [ ] **Step 1: Re-run pre-live safety checks**

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run build
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:production-boundaries
git status --short --branch
```

Expected: PASS and only protected unrelated/generated paths remain dirty or untracked. If any check fails, stop; live acceptance is `NOT RUN`.

- [ ] **Step 2: Start one exact normal live-only server**

Choose one free localhost port after checking it with `lsof`. Start the normal command with Node 22.22.2 and no key, mode, or enabled flag. Record the exact PID, parent PID, command, working directory, and listener port. Do not start a second server or reuse an unverified listener.

- [ ] **Step 3: Open the visible UI and hand off key entry**

Use the named in-app Browser to open the exact local URL. Confirm the disconnected UI first. Ask the owner to take over and enter their own key into the masked field, then press **Use my Solari key**. Do not ask them to paste it into chat, terminal, an environment variable, a file, a screenshot, or automation.

After handback, confirm only the **Ready for this session** state. Do not inspect browser storage, cookies, password managers, request headers, or developer-tool payloads.

- [ ] **Step 4: State the exact spend proposal and obtain action-time approval**

Before pressing compare, report the exact public target URL, selected country codes/names, and the exact number of initial captures. Explain that each selected country creates one Solari browser capture and may consume the user's credits. Wait for explicit approval for that exact count. Authentication is recorded separately and does not authorize capture.

- [ ] **Step 5: Run the comparison through the visible UI only**

After approval, press **Compare live through Solari** once in the in-app Browser. Do not invoke capture or replay routes with curl, scripts, tests, or developer tools. Observe deterministic batches of at most three, cancellation availability, terminal country states, and the absence of any fixture fallback.

Do not press Retry unless the owner separately approves one additional capture after seeing the failed country and current call count.

- [ ] **Step 6: Verify real-result and dashboard truth**

Confirm every displayed country is either an actual provider result or an honest failure. Record the exact number of initial captures and separately authorized retries. In the Solari console, confirm the expected user-owned session-count delta and correlate only safe country/time facts. Do not expose raw provider session IDs, cookie tokens, key material, profile data, or request headers.

If the dashboard delta is missing or ambiguous, record `NOT PROVEN`; do not infer success from timestamps or UI alone.

- [ ] **Step 7: Disconnect and stop safely**

Press **Disconnect** in the UI and confirm the comparison action returns to blocked. Inspect the exact listener PID and working directory, terminate only that LocaleLens process, and verify the port has no listener. Do not use wildcard process matching, broad process-group termination, or recursive cleanup.

- [ ] **Step 8: Record exact live evidence and rerun the final gate**

Update `byok-live-only.md` with the actual authentication-request count, capture count, retries, country outcomes, dashboard delta, disconnect result, shutdown result, and remaining risks. Run:

```sh
cd examples/localelens-web
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm test
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run lint
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run build
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:budget
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:api-methods
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run check:production-boundaries
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run test:e2e
git diff --check
```

Expected: every command PASS after the live run; protected paths remain unstaged.

- [ ] **Step 9: Commit final live evidence**

```sh
git add examples/localelens-web/docs/evidence/byok-live-only.md
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "docs: record user-owned live acceptance"
```

If a truthful procedural correction was required, add the manual-acceptance file explicitly and explain the reason before committing. Do not stage any other file.

- [ ] **Step 10: Push only the completed branch and verify parity**

```sh
git push -u origin codex/localelens-byok-live-only
git rev-parse HEAD
git rev-parse '@{upstream}'
git ls-remote --heads origin refs/heads/codex/localelens-byok-live-only
```

Expected: local HEAD, tracking SHA, and remote SHA are identical.

- [ ] **Step 11: Report completion without expanding scope**

Report the exact commit list, all test commands and counts, authentication-request count, billable capture count, retry count, dashboard result, protected-path status, local/tracking/remote SHA, and remaining risks. State explicitly that no pull request, merge, deployment, release, or hosted-CI inspection occurred.
