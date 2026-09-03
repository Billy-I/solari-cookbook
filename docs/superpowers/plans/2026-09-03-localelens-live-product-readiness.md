# LocaleLens Live Product Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LocaleLens an unmistakably truthful, bounded, decision-first live Solari comparison product with safe UI-to-provider correlation.

**Architecture:** Keep orchestration in the existing client comparison hook and execute selected countries in ordered batches of at most three transports. Extend the existing strict contracts with an app run ID and safe session reference, backed by a bounded server-only in-memory registry, then derive deterministic decision signals from successful evidence while preserving country-scoped failures.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.9.3, Zod 4.5.4, Vitest 4.1.11, Testing Library, Playwright 1.62.1, `@axe-core/playwright` 4.13.0, and `@solarisdk/browser` 0.1.2 under Node.js 22.22.2.

**Spec:** `docs/superpowers/specs/2026-09-03-localelens-live-product-readiness-design.md`

## Global Constraints

- Work only on `codex/localelens-live-product-readiness`, whose merge base is `00828fa6509a051a92aca521f5b201946c1172db`.
- Use `/Users/billytompazis/.nvm/versions/node/v22.22.2/bin` first in `PATH` for every Node, npm, Vitest, Next.js, and Playwright command.
- Preserve untracked `examples/localelens-web/AGENTS.md` and `examples/localelens-web/CLAUDE.md`.
- Do not stage `examples/localelens-web/next-env.d.ts` or `examples/localelens-web/test-results/`.
- Keep `SOLARI_API_KEY` server-only; never request, print, log, screenshot, commit, or expose its value.
- Keep public HTTPS, SSRF, DNS rebinding, redirect, final-URL, response-size, screenshot-size, timeout, cleanup, and export limits.
- Demo runs make zero capture-route and zero replay-route requests.
- Live provider work starts only from a visible user action and never retries automatically.
- Permit two to fifteen selected markets while allowing no more than three concurrent provider transports.
- Add no dependency, database, queue, scheduler, account system, analytics, or background job.
- Complete every non-live gate before provider spend.
- The optional live proof uses one public HTTPS target, exactly four selected markets, at most four initial UI-initiated captures, and no retry or fifth call without separate owner approval.
- Keep unit, route, sample E2E, Browser, live Solari, dashboard, deployment, and release evidence separate.
- Stop after local evidence and local commits; do not push, open a pull request, deploy, publish, submit, merge, or release.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── app/
│   ├── api/captures/route.ts                         # validate run context, register provider session, return strict safe response
│   ├── api/replays/[id]/route.ts                    # resolve safe correlation to raw ID server-side
│   ├── globals.css                                  # existing-system styles for banners, progress, summary, and details
│   ├── page.tsx                                     # fixed demo/live control boundary and result composition
│   └── page.test.tsx                                # provenance and visible-action integration tests
├── e2e/
│   ├── accessibility.spec.ts                        # axe, keyboard, focus, and details checks
│   ├── comparison.spec.ts                           # fixed demo, summary, export, and zero-request journey
│   └── responsive.spec.ts                           # desktop/mobile reflow assertions
├── src/components/
│   ├── audit-form.tsx                               # mode-aware fixed demo or editable live controls
│   ├── comparison-results.tsx                       # decision-first hierarchy and expandable evidence
│   ├── decision-summary.tsx                         # deterministic “What changed” presentation
│   ├── export-actions.tsx                           # pass safe run identity into reports
│   ├── region-result.tsx                            # country outcome, retry, receipt, and replay UI
│   ├── replay-link.tsx                              # safe correlation-only replay lookup
│   ├── run-receipt.tsx                             # provenance, safe run ID, and total-market receipt
│   └── run-status.tsx                              # aggregate counts, batch progress, and per-country stages
├── src/features/capture/
│   ├── contracts.ts                                 # strict request/response/report schemas
│   ├── countries.ts                                 # authoritative 15-market catalogue and labels
│   ├── error-codes.ts                               # boundary-specific public error codes
│   ├── limits.ts                                    # selected-country and concurrency limits
│   ├── run-id.ts                                    # app run ID creation and validation
│   ├── run-session-registry.ts                      # bounded server-only correlation registry
│   ├── safe-error.ts                                # public error classification and messages
│   └── capture-region.ts                            # lifecycle boundaries and session registration callback
├── src/features/compare/
│   ├── compare-evidence.ts                          # compare successful regions despite sibling failure
│   └── summarize-comparison.ts                      # deterministic availability/routing/localization/consent signals
├── src/features/export/create-json-report.ts        # safe run/session references and raw-ID exclusion
├── src/features/run/
│   ├── run-comparison.ts                            # ordered batches and strict request body
│   └── use-comparison-run.ts                        # run identity, progress, cancellation, and retry attempts
├── src/lib/server-observability.ts                  # structured allowlisted correlation logs
├── src/test/fixtures.ts                             # strict sample responses with no provider identity
└── docs/evidence/
    ├── live-product-readiness.md                    # command, browser, provider, and worktree evidence
    └── live-product-readiness-manual.md             # twelve-step owner acceptance checklist
```

Every modified source file keeps its current responsibility. New files exist only where identity, registry, summary derivation, or summary presentation is independently testable.

### Task 1: Establish the authoritative market and run contracts

**Files:**
- Modify: `examples/localelens-web/src/features/capture/countries.ts`
- Modify: `examples/localelens-web/src/features/capture/limits.ts`
- Modify: `examples/localelens-web/src/features/capture/contracts.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.test.ts`
- Create: `examples/localelens-web/src/features/capture/run-id.ts`
- Create: `examples/localelens-web/src/features/capture/run-id.test.ts`
- Modify: `examples/localelens-web/src/features/capture/limits.test.ts`
- Modify: `examples/localelens-web/src/test/contracts.test.ts`
- Modify: `examples/localelens-web/src/test/fixtures.ts`
- Modify: `examples/localelens-web/src/test/fixtures.test.ts`

**Interfaces:**
- Consumes: the official Solari residential-proxy country list recorded in the approved spec.
- Produces: `SUPPORTED_COUNTRIES`, `COUNTRY_NAMES`, `COUNTRY_CATALOGUE`, `CAPTURE_LIMITS.maxSelectedCountries`, `CAPTURE_LIMITS.maxConcurrentCaptures`, `appRunIdSchema`, `createAppRunId()`, `CaptureCorrelation`, and strict capture request/response shapes used by every later task.

- [ ] **Step 1: Write failing catalogue, limit, identity, and schema tests**

Add assertions equivalent to:

```ts
expect(SUPPORTED_COUNTRIES).toEqual([
  "au", "br", "ca", "de", "es", "fr", "gb", "in",
  "it", "jp", "kr", "mx", "nl", "sg", "us",
]);
expect(COUNTRY_NAMES.fr).toBe("France");
expect(CAPTURE_LIMITS.maxSelectedCountries).toBe(15);
expect(CAPTURE_LIMITS.maxConcurrentCaptures).toBe(3);

expect(createAppRunId(() => "123e4567-e89b-42d3-a456-426614174000"))
  .toBe("llr_123e4567-e89b-42d3-a456-426614174000");
expect(appRunIdSchema.safeParse("llr_bad").success).toBe(false);

expect(captureRequestSchema.parse({
  url: "https://example.com/",
  country: "fr",
  runId: "llr_123e4567-e89b-42d3-a456-426614174000",
  attempt: 1,
})).toMatchObject({ country: "fr", attempt: 1 });
```

Change strict sample success receipts to contain `runId`, `attempt`, and `sessionRef: null`, and remove `sessionId`. Change strict failures to include `correlation: null`.

Add a safe-error assertion that `toSafeCaptureFailure(new Error("CAPTURE_FAILED"))` returns the existing public message plus `correlation: null`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/run-id.test.ts src/features/capture/limits.test.ts src/features/capture/safe-error.test.ts src/test/contracts.test.ts src/test/fixtures.test.ts
```

Expected: FAIL because the fifteen-market catalogue, split limits, run-ID module, and safe correlation fields do not exist.

- [ ] **Step 3: Implement the centralized catalogue and split limits**

Use these exact public definitions:

```ts
export const SUPPORTED_COUNTRIES = [
  "au", "br", "ca", "de", "es", "fr", "gb", "in",
  "it", "jp", "kr", "mx", "nl", "sg", "us",
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const COUNTRY_NAMES = {
  au: "Australia", br: "Brazil", ca: "Canada", de: "Germany",
  es: "Spain", fr: "France", gb: "United Kingdom", in: "India",
  it: "Italy", jp: "Japan", kr: "South Korea", mx: "Mexico",
  nl: "Netherlands", sg: "Singapore", us: "United States",
} as const satisfies Record<SupportedCountry, string>;

export const COUNTRY_CATALOGUE = SUPPORTED_COUNTRIES.map((code) => ({
  code,
  name: COUNTRY_NAMES[code],
}));
```

Replace `maxCountries` with:

```ts
maxSelectedCountries: 15,
maxConcurrentCaptures: 3,
```

- [ ] **Step 4: Implement strict app-owned correlation contracts**

Create `run-id.ts` with a prefixed RFC 4122 UUID pattern and deterministic injection:

```ts
import { z } from "zod";

export const appRunIdSchema = z.string().regex(
  /^llr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
export type AppRunId = z.infer<typeof appRunIdSchema>;

export function createAppRunId(
  randomUUID: () => string = () => crypto.randomUUID(),
): AppRunId {
  return appRunIdSchema.parse(`llr_${randomUUID().toLowerCase()}`);
}
```

Extend `captureRequestSchema` with `runId: appRunIdSchema` and `attempt: z.number().int().min(1).max(99)`. Define a strict `captureCorrelationSchema` containing `runId`, `country`, `attempt`, and a non-null `sessionRef` matching `/^sol_[0-9a-f]{20}$/`. A success receipt contains `runId`, `country`, `attempt`, and `sessionRef: sessionRefSchema.nullable()` so fixed sample fixtures can truthfully use `null`; live capture must return the non-null correlation. A failure contains `correlation: captureCorrelationSchema.nullable()` next to its safe error. Report arrays use `maxSelectedCountries`.

Change `toSafeCaptureFailure` to accept an optional second `CaptureCorrelation | null` argument, default it to `null`, and include it in every strict failure. Task 3 will pass a non-null value only after a Solari session has been registered.

- [ ] **Step 5: Run the focused contract tests**

Run:

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/run-id.test.ts src/features/capture/limits.test.ts src/features/capture/safe-error.test.ts src/test/contracts.test.ts src/test/fixtures.test.ts
```

Expected: all focused contract tests PASS. The response-contract migration continues through Tasks 2 and 3; the first full typecheck is required at the end of Task 3 after every runtime caller has adopted the strict fields.

- [ ] **Step 6: Commit the contract checkpoint**

```bash
git add examples/localelens-web/src/features/capture/countries.ts examples/localelens-web/src/features/capture/limits.ts examples/localelens-web/src/features/capture/contracts.ts examples/localelens-web/src/features/capture/safe-error.ts examples/localelens-web/src/features/capture/safe-error.test.ts examples/localelens-web/src/features/capture/run-id.ts examples/localelens-web/src/features/capture/run-id.test.ts examples/localelens-web/src/features/capture/limits.test.ts examples/localelens-web/src/test/contracts.test.ts examples/localelens-web/src/test/fixtures.ts examples/localelens-web/src/test/fixtures.test.ts
git diff --cached --check
git commit -m "feat: establish live comparison contracts"
```

### Task 2: Queue more than three markets in deterministic batches

**Files:**
- Modify: `examples/localelens-web/src/features/run/run-comparison.ts`
- Modify: `examples/localelens-web/src/features/run/run-comparison.test.ts`
- Modify: `examples/localelens-web/src/features/run/use-comparison-run.ts`
- Modify: `examples/localelens-web/src/features/run/use-comparison-run.test.tsx`
- Modify: `examples/localelens-web/src/features/capture/contracts.ts`

**Interfaces:**
- Consumes: `AppRunId`, `CAPTURE_LIMITS.maxSelectedCountries`, `CAPTURE_LIMITS.maxConcurrentCaptures`, and strict request contracts from Task 1.
- Produces: `RunContext`, `RunProgress`, batch-aware `RunEvents`, `ComparisonRun.runId: AppRunId | null`, ordered transport batching, cancelled region stages, and same-run retry attempts.

- [ ] **Step 1: Write failing validation and batching tests**

Add a six-country test with deferred responses and assert:

```ts
const input = {
  url: "https://regional.example.test/pricing",
  countries: ["us", "gb", "de", "fr", "jp", "au"],
} satisfies AuditFormValue;
const runId = "llr_123e4567-e89b-42d3-a456-426614174000";
const run = runComparison(input, { runId, attempt: 1 }, events, signal);

expect(fetch).toHaveBeenCalledTimes(3);
expect(events.batchStarted).toHaveBeenNthCalledWith(1, 1, 2);
resolveFirstBatch();
await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
expect(maximumObservedPendingRequests).toBe(3);
expect(events.batchStarted).toHaveBeenNthCalledWith(2, 2, 2);
```

Assert every request body includes the same `runId` and `attempt: 1`. Replace the old “more than three” rejection with rejection for sixteen countries and the exact message `Select 2 to 15 unique supported countries.`

- [ ] **Step 2: Write failing hook tests for progress, cancellation, and retry identity**

Add hook assertions equivalent to:

```ts
expect(result.current.runId).toBe(runId);
expect(result.current.progress).toEqual({
  selected: 6, queued: 3, running: 3, completed: 0, failed: 0,
  batch: 1, totalBatches: 2,
});

act(() => result.current.cancel());
expect(result.current.status).toBe("cancelled");
expect(result.current.regions.filter(({ stage }) => stage === "cancelled"))
  .toHaveLength(6);
expect(fetch).toHaveBeenCalledTimes(3);

await result.current.retry("fr");
expect(countryRunner).toHaveBeenCalledWith(
  "fr",
  value.url,
  { runId, attempt: 2 },
  expect.anything(),
  expect.any(AbortSignal),
  expect.anything(),
);
```

Inject `createRunId` through `ComparisonRunOptions` so tests never depend on random output.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/run/run-comparison.test.ts src/features/run/use-comparison-run.test.tsx
```

Expected: FAIL because four-plus selection, batch callbacks, progress, cancelled stages, and run context are absent.

- [ ] **Step 4: Implement ordered batch orchestration**

Add `batchStarted(batch: number, totalBatches: number)` to `RunEvents`. Change country execution to accept:

```ts
export type RunContext = { runId: AppRunId; attempt: number };
```

Use these signatures consistently:

```ts
runComparison(input, context, events, signal, transportPool)
runCountryCapture(country, url, context, events, signal, transportPool)
```

Post `{ country, url, runId, attempt }`. Run batches with the existing transport pool:

```ts
const batchSize = CAPTURE_LIMITS.maxConcurrentCaptures;
const totalBatches = Math.ceil(countries.length / batchSize);

for (let offset = 0; offset < countries.length; offset += batchSize) {
  if (signal.aborted) throw abortReason(signal);
  const batch = countries.slice(offset, offset + batchSize);
  events.batchStarted(offset / batchSize + 1, totalBatches);
  const settlements = await Promise.allSettled(
    batch.map((country) =>
      runCountryRequest(country, url, context, events, signal, transportPool),
    ),
  );
  const callbackFailure = settlements.find(
    (item): item is PromiseRejectedResult => item.status === "rejected",
  );
  if (callbackFailure) throw callbackFailure.reason;
}
```

Use `maxConcurrentCaptures` inside `createCaptureTransportPool` rather than another numeric constant.

- [ ] **Step 5: Extend hook state without a new state library**

Create one run ID in `start`, keep attempt `1` for initial countries, increment a per-country attempt counter only on explicit retry, and expose:

```ts
export type RunProgress = {
  selected: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  batch: number;
  totalBatches: number;
};
```

Add `cancelled` to `CAPTURE_STAGES`. On cancel, change every unsettled region to `cancelled`, preserve completed and failed responses, abort active transports, and retain generation/operation guards against late callbacks.

- [ ] **Step 6: Run the focused orchestration tests**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/run/run-comparison.test.ts src/features/run/use-comparison-run.test.tsx
```

Expected: PASS with a measured maximum of three unresolved transports and zero second-batch requests after cancellation. Full typecheck follows the server response-contract propagation in Task 3.

- [ ] **Step 7: Commit the orchestration checkpoint**

```bash
git add examples/localelens-web/src/features/run/run-comparison.ts examples/localelens-web/src/features/run/run-comparison.test.ts examples/localelens-web/src/features/run/use-comparison-run.ts examples/localelens-web/src/features/run/use-comparison-run.test.tsx examples/localelens-web/src/features/capture/contracts.ts
git diff --cached --check
git commit -m "feat: batch regional captures deterministically"
```

### Task 3: Correlate UI runs to Solari without exposing raw session IDs

**Files:**
- Create: `examples/localelens-web/src/features/capture/run-session-registry.ts`
- Create: `examples/localelens-web/src/features/capture/run-session-registry.test.ts`
- Modify: `examples/localelens-web/src/features/capture/capture-region.ts`
- Modify: `examples/localelens-web/src/features/capture/capture-region.test.ts`
- Modify: `examples/localelens-web/app/api/captures/route.ts`
- Modify: `examples/localelens-web/app/api/captures/route.test.ts`
- Modify: `examples/localelens-web/app/api/replays/[id]/route.ts`
- Modify: `examples/localelens-web/app/api/replays/[id]/route.test.ts`
- Modify: `examples/localelens-web/src/components/replay-link.tsx`
- Modify: `examples/localelens-web/src/components/replay-link.test.tsx`
- Modify: `examples/localelens-web/src/components/region-result.tsx`
- Modify: `examples/localelens-web/src/components/region-result.test.tsx`
- Modify: `examples/localelens-web/src/lib/server-observability.ts`

**Interfaces:**
- Consumes: `CaptureCorrelation`, strict `runId/country/attempt` requests, and `browser.id` inside the server capture boundary.
- Produces: `registerRunSession()`, `lookupRunSession()`, `resetRunSessionRegistryForTests()`, allowlisted correlation logs, correlation-only replay requests, and zero raw session IDs in client response data.

- [ ] **Step 1: Write failing registry tests**

Use fixed IDs and a controllable clock:

```ts
const correlation = registerRunSession({
  runId: "llr_123e4567-e89b-42d3-a456-426614174000",
  country: "fr",
  attempt: 1,
  sessionId: "raw-provider-session-id",
}, { now: () => 1_000 });

expect(correlation).toMatchObject({
  country: "fr",
  attempt: 1,
  sessionRef: expect.stringMatching(/^sol_[0-9a-f]{20}$/),
});
expect(JSON.stringify(correlation)).not.toContain("raw-provider-session-id");
expect(lookupRunSession(correlation, { now: () => 1_001 }))
  .toBe("raw-provider-session-id");
expect(lookupRunSession(correlation, { now: () => 3_601_001 }))
  .toBeNull();
```

Register 101 unique run IDs and assert the oldest run is evicted while the newest 100 remain. Reset the registry in `beforeEach` and `afterEach`.

- [ ] **Step 2: Run the registry test and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/run-session-registry.test.ts
```

Expected: FAIL because the server registry does not exist.

- [ ] **Step 3: Implement the bounded server registry**

Start the module with `import "server-only"`. Use Node `createHash("sha256")`, expose the first twenty lowercase hex characters as `sol_<digest>`, and store the raw ID only in a `Map` held on `globalThis[Symbol.for("localelens.run-session-registry")]`. Group entries by run ID, prune records older than 3,600,000 ms on every lookup and registration, and evict the oldest run when the run count exceeds 100. `lookupRunSession` must compare `runId`, `country`, `attempt`, and `sessionRef` before returning the raw ID.

- [ ] **Step 4: Write failing capture and route correlation tests**

Add assertions that:

```ts
expect(registerSession).toHaveBeenCalledWith({
  runId,
  country: "fr",
  attempt: 1,
  sessionId: "raw-provider-session-id",
});
expect(success.receipt).toMatchObject({ runId, country: "fr", attempt: 1, sessionRef });
expect(JSON.stringify(success)).not.toContain("raw-provider-session-id");
expect(failureAfterLaunch.correlation).toEqual({ runId, country: "fr", attempt: 1, sessionRef });
```

Capture-route tests must assert `registerRunSession` receives the raw `browser.id`, while the serialized response and every `console.error` call omit it. Replay-route tests must pass safe lookup fields, assert `getReplayUrl` receives the raw ID returned by `lookupRunSession`, and assert malformed, expired, or mismatched lookups make zero provider calls.

- [ ] **Step 5: Run capture and route tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/capture-region.test.ts app/api/captures/route.test.ts app/api/replays/'[id]'/route.test.ts
```

Expected: FAIL because capture registration, safe response correlation, and registry-backed replay lookup are absent.

- [ ] **Step 6: Wire registration at the provider lifecycle boundary**

Add this dependency:

```ts
registerSession(input: {
  runId: AppRunId;
  country: SupportedCountry;
  attempt: number;
  sessionId: string;
}): CaptureCorrelation;
```

Call it immediately after `browser = await launchPromise` succeeds and before page creation. Store the returned correlation. Success receipts include the correlation and exclude `browser.id`; failures occurring after registration include the correlation. A registration error fails the capture closed and still executes browser/client cleanup.

In the capture route, inject `registerRunSession` and emit one structured `session_registered` event containing only `category`, `requestId`, `runId`, `country`, `attempt`, and `sessionRef`.

- [ ] **Step 7: Replace raw replay lookup with safe correlation lookup**

Keep the existing `[id]` route filename, but interpret `id` as `sessionRef`. Parse `runId`, `country`, and integer `attempt` from the request URL. Resolve the raw provider ID through `lookupRunSession`; return `{ status: "unavailable" }` with 404 when it is absent. Only the route passes the resolved raw ID to `client.sessions.getReplayUrl`.

Change `ReplayLink` to accept `correlation: CaptureCorrelation` and fetch:

```ts
const query = new URLSearchParams({
  runId: correlation.runId,
  country: correlation.country,
  attempt: String(correlation.attempt),
});
fetch(`/api/replays/${correlation.sessionRef}?${query}`, { signal });
```

Render replay controls only for a live success with a non-null correlation. Never render or export the raw provider session ID.

- [ ] **Step 8: Run focused tests, typecheck, and raw-ID scans**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/run-session-registry.test.ts src/features/capture/capture-region.test.ts app/api/captures/route.test.ts app/api/replays/'[id]'/route.test.ts src/components/replay-link.test.tsx src/components/region-result.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
rg -n 'sessionId|browser\.id' examples/localelens-web/app examples/localelens-web/src --glob '!**/*.test.*'
```

Expected: tests and typecheck PASS. The scan finds raw ID access only inside `capture-region.ts` and `run-session-registry.ts`; client components, response contracts, exports, and observability contain none.

- [ ] **Step 9: Commit the attribution checkpoint**

```bash
git add examples/localelens-web/src/features/capture/run-session-registry.ts examples/localelens-web/src/features/capture/run-session-registry.test.ts examples/localelens-web/src/features/capture/capture-region.ts examples/localelens-web/src/features/capture/capture-region.test.ts examples/localelens-web/app/api/captures/route.ts examples/localelens-web/app/api/captures/route.test.ts examples/localelens-web/app/api/replays/'[id]'/route.ts examples/localelens-web/app/api/replays/'[id]'/route.test.ts examples/localelens-web/src/components/replay-link.tsx examples/localelens-web/src/components/replay-link.test.tsx examples/localelens-web/src/components/region-result.tsx examples/localelens-web/src/components/region-result.test.tsx examples/localelens-web/src/lib/server-observability.ts
git diff --cached --check
git commit -m "feat: correlate Solari sessions safely"
```

### Task 4: Classify failures at their real lifecycle boundaries

**Files:**
- Modify: `examples/localelens-web/src/features/capture/error-codes.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.ts`
- Modify: `examples/localelens-web/src/features/capture/safe-error.test.ts`
- Modify: `examples/localelens-web/src/features/capture/capture-region.ts`
- Modify: `examples/localelens-web/src/features/capture/capture-region.test.ts`
- Modify: `examples/localelens-web/app/api/captures/route.ts`
- Modify: `examples/localelens-web/app/api/captures/route.test.ts`

**Interfaces:**
- Consumes: existing validation, provider status, timeout, proxy, navigation, extraction, and cleanup boundaries.
- Produces: safe `SOLARI_LAUNCH`, `NAVIGATION_FAILED`, and `EXTRACTION_FAILED` categories in addition to the existing validated categories.

- [ ] **Step 1: Write failing classification tests**

Add table-driven expectations:

```ts
expect(toSafeCaptureFailure(new Error("SOLARI_LAUNCH"))).toEqual({
  ok: false,
  correlation: null,
  error: { code: "SOLARI_LAUNCH", message: "Solari could not start this regional browser.", retryable: true },
});
expect(toSafeCaptureFailure(new Error("NAVIGATION_FAILED")).error.code)
  .toBe("NAVIGATION_FAILED");
expect(toSafeCaptureFailure(new Error("EXTRACTION_FAILED")).error.code)
  .toBe("EXTRACTION_FAILED");
```

In `capture-region.test.ts`, make launch, `goto`, and `evaluate` reject independently and assert the exact category, retryability, cleanup counts, and retained correlation for failures after launch.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/safe-error.test.ts src/features/capture/capture-region.test.ts app/api/captures/route.test.ts
```

Expected: FAIL because lifecycle-specific codes and messages are absent.

- [ ] **Step 3: Add safe codes and narrow boundary wrappers**

Add:

```ts
"SOLARI_LAUNCH",
"NAVIGATION_FAILED",
"EXTRACTION_FAILED",
```

Preserve known `SOLARI_AUTH`, `SOLARI_CAPACITY`, `NAVIGATION_TIMEOUT`, `PRIVATE_TARGET_BLOCKED`, `TARGET_BLOCKED`, and proxy mismatch errors. Wrap only otherwise-unclassified launch, navigation, and extraction exceptions with their boundary code. Do not relabel timeout or validated target errors. Map launch/navigation/extraction failures to 502 in the route.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/capture/safe-error.test.ts src/features/capture/capture-region.test.ts app/api/captures/route.test.ts
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
```

Expected: PASS with one truthful category per simulated boundary and no raw error detail in public messages.

- [ ] **Step 5: Commit the failure checkpoint**

```bash
git add examples/localelens-web/src/features/capture/error-codes.ts examples/localelens-web/src/features/capture/safe-error.ts examples/localelens-web/src/features/capture/safe-error.test.ts examples/localelens-web/src/features/capture/capture-region.ts examples/localelens-web/src/features/capture/capture-region.test.ts examples/localelens-web/app/api/captures/route.ts examples/localelens-web/app/api/captures/route.test.ts
git diff --cached --check
git commit -m "feat: report capture lifecycle failures"
```

### Task 5: Make demo and live runtime modes unmistakable

**Files:**
- Modify: `examples/localelens-web/src/components/audit-form.tsx`
- Modify: `examples/localelens-web/src/components/audit-form.test.tsx`
- Modify: `examples/localelens-web/src/components/run-receipt.tsx`
- Create: `examples/localelens-web/src/components/run-receipt.test.tsx`
- Modify: `examples/localelens-web/app/page.tsx`
- Modify: `examples/localelens-web/app/page.test.tsx`
- Modify: `examples/localelens-web/app/globals.css`

**Interfaces:**
- Consumes: `COUNTRY_CATALOGUE`, two-to-fifteen live selection, fixed US/GB/DE sample fixtures, and `ComparisonRun.runId/progress/cancel`.
- Produces: an immutable sample action, editable live action, exact provenance copy, visible cancellation, centralized labels, and displayed safe run ID.

- [ ] **Step 1: Read framework and design guidance immediately before UI edits**

Read the applicable Next.js 16 App Router documentation under `examples/localelens-web/node_modules/next/dist/docs/` for client components and environment variables. Then read `/Users/billytompazis/.agents/skills/impeccable/reference/craft-floor.md` in full. This is the required just-in-time UI craft gate.

- [ ] **Step 2: Write failing component and page tests**

In sample mode, assert:

```ts
expect(screen.getByText("Demo data — this URL will not be visited.")).toBeVisible();
expect(screen.queryByRole("textbox", { name: "URL (HTTPS)" })).not.toBeInTheDocument();
expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
fireEvent.click(screen.getByRole("button", { name: "Run featured demo" }));
expect(onSubmit).toHaveBeenCalledWith({
  url: "https://regional.example.test/pricing",
  countries: ["us", "gb", "de"],
});
```

In live mode, assert all fifteen markets are present, four may be selected, the copy `Live through Solari.` is visible, and the submit action reads `Compare live through Solari`. After starting, assert the run receipt shows the generated `llr_…` ID and the Cancel button invokes `run.cancel()`.

- [ ] **Step 3: Run focused UI tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/components/audit-form.test.tsx src/components/run-receipt.test.tsx app/page.test.tsx
```

Expected: FAIL because sample controls are editable, exact provenance copy is absent, total selection is capped at three, run ID is hidden, and cancel is not visible.

- [ ] **Step 4: Implement the mode-aware control boundary**

Add `mode: "sample" | "live"` to `AuditForm`. Sample mode renders a read-only description of `regional.example.test` and US/GB/DE plus one `Run featured demo` button; it contains no URL input or market checkbox. Live mode renders the existing URL field and maps `COUNTRY_CATALOGUE` into checkboxes, enforcing only the two-country minimum and fifteen-country maximum.

Render an adjacent provenance banner with the exact sample or live sentence. Keep the featured sample evidence explicitly labelled Preview until a run starts. Do not combine a live-form hostname with sample evidence.

- [ ] **Step 5: Expose run identity, progress, and cancellation**

Pass `run.runId` into `RunReceipt` and display it as `Run ID` only after a UI action creates a run. Pass `run.progress` into `RunStatus`. While `run.status` is `running` or `partial` with unfinished regions, render a normal button labelled `Cancel comparison` that calls `run.cancel`; do not use `aria-disabled` for this active control.

- [ ] **Step 6: Style within the existing visual system**

Add only the classes required for the provenance banner, expanded market grid, aggregate progress row, safe run ID wrapping, and cancel action. Reuse current warm neutral colors, borders, radius, typography, spacing tokens, button shapes, focus ring, reduced-motion handling, and the 1000px/680px breakpoints. Do not add gradients, decorative cards, new fonts, or custom icons.

- [ ] **Step 7: Run focused tests, typecheck, and lint**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/components/audit-form.test.tsx src/components/run-receipt.test.tsx app/page.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run lint
```

Expected: PASS. Sample mode exposes no editable URL, live mode exposes fifteen validated markets, and cancel remains keyboard focusable.

- [ ] **Step 8: Commit the runtime-truth checkpoint**

```bash
git add examples/localelens-web/src/components/audit-form.tsx examples/localelens-web/src/components/audit-form.test.tsx examples/localelens-web/src/components/run-receipt.tsx examples/localelens-web/src/components/run-receipt.test.tsx examples/localelens-web/app/page.tsx examples/localelens-web/app/page.test.tsx examples/localelens-web/app/globals.css
git diff --cached --check
git commit -m "feat: clarify demo and live runtime modes"
```

### Task 6: Put resilient decision signals before raw evidence

**Files:**
- Modify: `examples/localelens-web/src/features/compare/compare-evidence.ts`
- Modify: `examples/localelens-web/src/features/compare/compare-evidence.test.ts`
- Create: `examples/localelens-web/src/features/compare/summarize-comparison.ts`
- Create: `examples/localelens-web/src/features/compare/summarize-comparison.test.ts`
- Create: `examples/localelens-web/src/components/decision-summary.tsx`
- Create: `examples/localelens-web/src/components/decision-summary.test.tsx`
- Modify: `examples/localelens-web/src/components/comparison-results.tsx`
- Modify: `examples/localelens-web/src/components/comparison-results.test.tsx`
- Modify: `examples/localelens-web/src/components/difference-table.tsx`
- Modify: `examples/localelens-web/src/components/difference-table.test.tsx`
- Modify: `examples/localelens-web/src/components/region-result.tsx`
- Modify: `examples/localelens-web/app/globals.css`

**Interfaces:**
- Consumes: settled `RegionRunState[]` and `DifferenceRow[]`.
- Produces: `DecisionSignal[]` for availability, routing, localization, and consent; resilient row comparison; and an accessible summary-first results hierarchy.

- [ ] **Step 1: Write the failing resilient comparison test**

Replace the test that makes every row unavailable after one failure with three regions: two successes with different titles and one failure. Assert:

```ts
expect(rows.find(({ field }) => field === "title")).toEqual({
  field: "title",
  kind: "different",
  values: { gb: "GB plans", us: "US plans" },
});
expect(rows.find(({ field }) => field === "language")?.kind).toBe("same");
```

Also assert one success plus one failure remains globally unavailable because fewer than two successful regions can be compared.

- [ ] **Step 2: Write failing deterministic summary tests**

Define:

```ts
export type DecisionSignal = {
  category: "availability" | "routing" | "localization" | "consent";
  state: "consistent" | "attention" | "unavailable";
  title: string;
  detail: string;
};
```

Assert stable category order, exact success/failure counts, routing attention for `final_url`, localization attention when any of language/currency/price/heading/primary action differs or is missing, and consent attention only from the consent row. Assert input permutations produce identical signals and no text includes `score`, `cause`, or `compliance`.

- [ ] **Step 3: Write failing presentation tests**

Render `ComparisonResults` with two successful fixtures and one failed country. Assert `What changed` precedes `Screenshots and regional evidence` in DOM order, the summary exposes availability and localization signals, the successful-country title row remains comparable, and raw evidence/detail tables are inside labelled `<details>` elements. Retry must still invoke only the failed country.

- [ ] **Step 4: Run comparison and summary tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/compare/compare-evidence.test.ts src/features/compare/summarize-comparison.test.ts src/components/decision-summary.test.tsx src/components/comparison-results.test.tsx src/components/difference-table.test.tsx
```

Expected: FAIL because failed siblings erase comparisons and no decision-summary layer exists.

- [ ] **Step 5: Correct comparison semantics**

For every field:

```ts
const kind: DifferenceKind = successfulCaptureCount < 2
  ? "unavailable"
  : normalizedValues.length !== successfulCaptureCount
    ? "missing"
    : normalizedValues.every((value) => value === normalizedValues[0])
      ? "same"
      : "different";
```

Failed countries keep empty cells through the existing country list, but do not change `same`, `different`, or `missing` among two or more successful regions.

- [ ] **Step 6: Derive and render the decision summary**

Implement `summarizeComparison(regions)` as a pure function. Always return four signals in the specified order. Use only counts and `compareEvidence` rows. Phrase unavailable states as lack of comparable evidence, not absence of a site feature. Render them under a level-two heading `What changed` before any screenshot.

Place the country cards inside `<details><summary>Screenshots and regional evidence</summary>…</details>` and the normalized table inside `<details><summary>Detailed field comparison</summary>…</details>`. Keep headings, table captions, country labels, retry buttons, and image alt text available when details are open.

- [ ] **Step 7: Style summary and details surgically**

Reuse the existing signal color for attention, neutral borders for consistent/unavailable states, and the current typography scale. Use a simple responsive grid/list with no nested decorative card stack. Give `<summary>` a visible focus state and at least a 44px coarse-pointer target.

- [ ] **Step 8: Run focused tests, typecheck, and lint**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/compare/compare-evidence.test.ts src/features/compare/summarize-comparison.test.ts src/components/decision-summary.test.tsx src/components/comparison-results.test.tsx src/components/difference-table.test.tsx src/components/region-result.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run lint
```

Expected: PASS with deterministic summary order and successful-market comparisons preserved across a sibling failure.

- [ ] **Step 9: Commit the decision-first checkpoint**

```bash
git add examples/localelens-web/src/features/compare/compare-evidence.ts examples/localelens-web/src/features/compare/compare-evidence.test.ts examples/localelens-web/src/features/compare/summarize-comparison.ts examples/localelens-web/src/features/compare/summarize-comparison.test.ts examples/localelens-web/src/components/decision-summary.tsx examples/localelens-web/src/components/decision-summary.test.tsx examples/localelens-web/src/components/comparison-results.tsx examples/localelens-web/src/components/comparison-results.test.tsx examples/localelens-web/src/components/difference-table.tsx examples/localelens-web/src/components/difference-table.test.tsx examples/localelens-web/src/components/region-result.tsx examples/localelens-web/app/globals.css
git diff --cached --check
git commit -m "feat: prioritize resilient comparison decisions"
```

### Task 7: Preserve provenance and redaction in exports

**Files:**
- Modify: `examples/localelens-web/src/features/export/create-json-report.ts`
- Modify: `examples/localelens-web/src/features/export/create-json-report.test.ts`
- Modify: `examples/localelens-web/src/components/export-actions.tsx`
- Modify: `examples/localelens-web/src/components/export-actions.test.tsx`
- Modify: `examples/localelens-web/app/page.tsx`
- Modify: `examples/localelens-web/app/report/print.css`

**Interfaces:**
- Consumes: `AppRunId`, safe `CaptureCorrelation`, resilient comparisons, and sample/live provenance.
- Produces: schema-version-2 JSON containing safe run/session references, plus print output whose provenance and decision summary match the UI.

- [ ] **Step 1: Write failing export tests**

For a live partial result, assert:

```ts
expect(report).toMatchObject({
  schemaVersion: 2,
  runId,
  mode: "live",
  status: "partial",
  results: [expect.objectContaining({
    receipt: expect.objectContaining({ sessionRef: "sol_0123456789abcdefabcd" }),
  })],
  failures: [expect.objectContaining({
    correlation: expect.objectContaining({ runId, country: "fr" }),
  })],
});
expect(output.json).not.toContain("sessionId");
expect(output.json).not.toContain("raw-provider-session-id");
expect(output.json).not.toContain("SOLARI_API_KEY");
```

For a sample report, assert `mode: "sample"`, the safe app run ID is present, and every provider session reference is `null`.

- [ ] **Step 2: Run export tests and verify RED**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/export/create-json-report.test.ts src/components/export-actions.test.tsx
```

Expected: FAIL because run identity and safe correlation are not in the report.

- [ ] **Step 3: Implement safe export schema version 2**

Add `runId` to `JsonReportInput` and the report root. Include only `runId`, `country`, `attempt`, and `sessionRef` from correlation. Preserve hostname-only target, stripped query/fragment final URLs, omitted screenshots, omitted replay links, the 256 KiB limit, stable ordering, failures, resilient comparisons, and limitations. Update `ExportActions` and `Page` to pass `run.runId`. Keep preview export actions disabled while `runId` is `null`; clicking `Run featured demo` creates the sample run ID and enables export after two fixture captures settle.

- [ ] **Step 4: Keep print evidence truthful**

Ensure the printed page includes provenance, run ID, decision summary, country outcome, and detailed evidence while hiding interactive-only buttons. Do not force closed `<details>` content to remain hidden in print; use the existing print stylesheet to display it.

- [ ] **Step 5: Run focused tests, typecheck, and lint**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test -- src/features/export/create-json-report.test.ts src/components/export-actions.test.tsx app/page.test.tsx
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run lint
```

Expected: PASS with no raw provider ID, API key value, query string, fragment, screenshot payload, or replay URL in JSON.

- [ ] **Step 6: Commit the export checkpoint**

```bash
git add examples/localelens-web/src/features/export/create-json-report.ts examples/localelens-web/src/features/export/create-json-report.test.ts examples/localelens-web/src/components/export-actions.tsx examples/localelens-web/src/components/export-actions.test.tsx examples/localelens-web/app/page.tsx examples/localelens-web/app/report/print.css
git diff --cached --check
git commit -m "feat: export safe run provenance"
```

### Task 8: Prove the full sample journey, reflow, keyboard use, and zero provider requests

**Files:**
- Modify: `examples/localelens-web/e2e/comparison.spec.ts`
- Modify: `examples/localelens-web/e2e/accessibility.spec.ts`
- Modify: `examples/localelens-web/e2e/responsive.spec.ts`
- Modify: `examples/localelens-web/playwright.config.ts` only if an existing-server mismatch prevents the governed sample command from owning its port.

**Interfaces:**
- Consumes: final sample UI and the current Playwright sample server configuration.
- Produces: browser-level evidence for fixed demo truth, decision hierarchy, export availability, keyboard focus, axe checks, responsive reflow, and zero capture/replay traffic.

- [ ] **Step 1: Write failing sample E2E assertions**

Record forbidden requests before navigation:

```ts
const providerRequests: string[] = [];
page.on("request", (request) => {
  if (/\/api\/(captures|replays)/.test(new URL(request.url()).pathname)) {
    providerRequests.push(request.url());
  }
});
```

Run the featured demo through its visible button. Assert exact demo copy, fixed hostname, three fixed markets, `What changed` before screenshots, export readiness after settlement, no editable URL/checkboxes, and `expect(providerRequests).toEqual([])`.

- [ ] **Step 2: Add accessibility and responsive assertions**

At 1440x900 and 360x800, assert there is no horizontal page overflow, the provenance banner and summary are visible, market/progress content reflows, and detail summaries remain reachable. Use `@axe-core/playwright` after the demo settles and require zero violations.

For keyboard evidence, tab from the demo action through summary/detail/export controls, press Enter or Space to open both details, verify `:focus-visible` has a non-zero outline, and confirm focus does not jump when status updates.

- [ ] **Step 3: Run the sample E2E and verify RED or newly passing coverage**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run test:e2e:sample
```

Expected before final adjustments: at least one new assertion fails if hierarchy, fixed controls, reflow, or keyboard behavior is incomplete. The request recorder must remain empty even on a failed UI assertion.

- [ ] **Step 4: Make the smallest source/style corrections required by E2E evidence**

Touch only the owning component or existing CSS rule associated with a failing assertion. Do not weaken an axe rule, request recorder, accessible name, viewport, or overflow assertion to obtain a pass.

- [ ] **Step 5: Run the complete non-live automated gate**

```bash
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin node --version
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm test
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run typecheck
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run lint
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run check:budget
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run check:api-methods
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run build
PATH=/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin npm run test:e2e:sample
```

Expected: Node reports `v22.22.2`; every command exits 0; sample E2E records zero capture and replay requests.

- [ ] **Step 6: Run scoped security and public-bundle scans**

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!test-results/**' '(SOLARI_API_KEY\s*=\s*[^$]|NEXT_PUBLIC_.*SOLARI|sk-[A-Za-z0-9_-]{16,}|sessionId)' .
rg -n 'SOLARI_API_KEY|raw-provider-session-id|sessionId' .next/static .next/server/app/index.html
git diff --check
```

Expected: no credential value, public Solari variable, raw provider ID, or `sessionId` appears in a client bundle or rendered page. Expected source matches are limited to server-only environment checks, synthetic redaction tests, and the two server-only raw-ID modules documented in Task 3.

- [ ] **Step 7: Run the Impeccable detector exactly once**

After the UI is final, run:

```bash
/Users/billytompazis/.nvm/versions/node/v22.22.2/bin/node /Users/billytompazis/.agents/skills/impeccable/scripts/detect.mjs --json app/page.tsx app/globals.css src/components/audit-form.tsx src/components/run-receipt.tsx src/components/run-status.tsx src/components/comparison-results.tsx src/components/decision-summary.tsx src/components/region-result.tsx src/components/difference-table.tsx src/components/export-actions.tsx
```

Review every finding. Fix material accessibility, hierarchy, density, interaction, and responsive findings; record non-material or false-positive findings in the evidence report. Do not run the detector a second time.

- [ ] **Step 8: Inspect desktop and mobile in the requested Browser**

Use the in-app Browser against the locally running sample server. Verify the visible demo sentence, fixed target, summary-first order, details, export state, 1440x900 layout, 360x800 reflow, keyboard traversal, and visible focus. Save `sample-desktop-1440x900.png`, `sample-mobile-360x800.png`, and `sample-keyboard-focus-1440x900.png` under `examples/localelens-web/docs/evidence/live-product-readiness/`; include no secrets or raw session IDs.

- [ ] **Step 9: Commit the non-live evidence checkpoint**

```bash
git add examples/localelens-web/e2e/comparison.spec.ts examples/localelens-web/e2e/accessibility.spec.ts examples/localelens-web/e2e/responsive.spec.ts examples/localelens-web/playwright.config.ts examples/localelens-web/app/page.tsx examples/localelens-web/app/globals.css examples/localelens-web/src/components/audit-form.tsx examples/localelens-web/src/components/run-receipt.tsx examples/localelens-web/src/components/run-status.tsx examples/localelens-web/src/components/comparison-results.tsx examples/localelens-web/src/components/decision-summary.tsx examples/localelens-web/src/components/region-result.tsx examples/localelens-web/src/components/difference-table.tsx examples/localelens-web/src/components/export-actions.tsx examples/localelens-web/docs/evidence/live-product-readiness/sample-desktop-1440x900.png examples/localelens-web/docs/evidence/live-product-readiness/sample-mobile-360x800.png examples/localelens-web/docs/evidence/live-product-readiness/sample-keyboard-focus-1440x900.png
git diff --cached --check
git commit -m "test: verify LocaleLens product readiness"
```

Stage only files actually changed for the E2E/browser checkpoint; do not stage `next-env.d.ts`, `test-results/`, `AGENTS.md`, or `CLAUDE.md`.

### Task 9: Run the budgeted live proof, report evidence, and stop locally

**Files:**
- Create: `examples/localelens-web/docs/evidence/live-product-readiness.md`
- Create: `examples/localelens-web/docs/evidence/live-product-readiness-manual.md`
- Modify: `docs/EXECUTION_INDEX.md`
- Modify: `docs/README.md`
- Modify: `examples/localelens-web/README.md`

**Interfaces:**
- Consumes: passing non-live gates, local Browser UI, owner-provided runtime-only Solari key environment, and the Solari dashboard.
- Produces: qualified live/UI/dashboard evidence, exact call accounting, manual acceptance instructions, terminal local commit SHAs, and an explicit no-publication stop.

- [ ] **Step 1: Re-run the non-live gate immediately before spend**

Run the complete Task 8 Step 5 command set again if any source, test, configuration, or documentation that affects runtime changed after its recorded pass. If any command fails, record the failure and set live proof to `NOT RUN`.

- [ ] **Step 2: State and enforce the live-call budget**

Before touching the live Compare action, record:

```text
Planned target: one public HTTPS URL
Selected markets: exactly four verified catalogue entries
Initial capture budget: four calls
Concurrency: first batch three, second batch one
Retry budget: zero
Stop: any target block, ambiguous correlation, or unexpected fifth request
```

Confirm the live server was started with `NEXT_PUBLIC_APP_MODE=live`, `LIVE_CAPTURE_ENABLED=true`, and `SOLARI_API_KEY` supplied only through the runtime environment. Never display or transcribe the key.

- [ ] **Step 3: Establish the dashboard baseline without mutating credentials**

Use the requested Browser to record the visible Browser-session count and current timestamp. Recommend a dedicated dashboard key label `LocaleLens Production` in documentation, but do not create, reveal, rotate, rename, or screenshot credentials. Do not attribute Sandbox/VM activity to LocaleLens.

- [ ] **Step 4: Perform one UI-only four-market live comparison**

Through the visible Browser UI only: enter the chosen public HTTPS target, select exactly four markets, press `Compare live through Solari`, and make no direct route, curl, script, or terminal capture request. Record the displayed app run ID. Observe batch 1/2 with at most three running countries, then batch 2/2 with one. Do not press Retry.

- [ ] **Step 5: Correlate results to the Solari dashboard**

For each country, compare app run ID, country, safe session reference, and capture timestamp with the server’s allowlisted registration record and the corresponding dashboard Browser session. Confirm the dashboard Browser-session count changed by exactly the observed number of launched sessions, up to four. Record success, failure, unsupported, pending replay, and unavailable replay states exactly as observed. If correlation is not directly observed, label it `NOT PROVEN`.

- [ ] **Step 6: Write the evidence report**

In `live-product-readiness.md`, record:

- branch, base SHA, every local commit SHA, and final worktree state;
- every verification command, exit status, test count, build result, and timestamp;
- sample E2E zero capture/replay request count;
- Browser desktop/mobile/keyboard observations and screenshot paths;
- Impeccable detector findings and dispositions;
- secret/public-bundle scan results with synthetic-fixture qualifications;
- planned and actual live call count;
- app run ID and safe session references, never raw session IDs;
- dashboard count before/after and exact observed correlation;
- live country successes/failures and replay state;
- deployment, publication, submission, and release as `NOT RUN`;
- remaining risks, including process-local registry lifetime and public-site variability.

- [ ] **Step 7: Write the twelve-step manual acceptance guide**

In `live-product-readiness-manual.md`, give exact instructions for safely starting sample mode, recognizing fixed fixtures, starting live mode with a runtime-only key, selecting four or more markets, reading batch counts, following country stages, verifying Solari provenance, explicitly retrying one failed market with a separately approved call, reading the decision summary, confirming comparisons survive a sibling failure, cross-checking the dashboard, checking mobile/keyboard behavior, and stopping the server safely. Include warnings that replay can remain pending and that no site-wide compatibility or compliance claim is made.

- [ ] **Step 8: Update governed documentation indexes**

Add the new spec, plan, evidence report, manual checklist, terminal commit, live-proof status, and no-publication stop to `docs/README.md`, `docs/EXECUTION_INDEX.md`, and the example README. Keep older phase evidence historical and unchanged.

- [ ] **Step 9: Verify documentation and protected workspace state**

```bash
rg -n 'TO[D]O|TB[D]|PLACEHOLD[E]R|FIXM[E]' docs examples/localelens-web/docs examples/localelens-web/README.md
rg -n 'SOLARI_API_KEY\s*=\s*[^$]|NEXT_PUBLIC_.*SOLARI|raw-provider-session-id' docs/README.md docs/EXECUTION_INDEX.md examples/localelens-web/README.md examples/localelens-web/docs/evidence/live-product-readiness.md examples/localelens-web/docs/evidence/live-product-readiness-manual.md
git diff --check
git status --short
shasum -a 256 examples/localelens-web/AGENTS.md examples/localelens-web/CLAUDE.md
```

Expected: no incomplete marker, credential assignment, or raw session ID in documentation; generated/protected files remain unstaged; protected-file hashes match the preflight record.

- [ ] **Step 10: Commit the terminal local documentation checkpoint**

```bash
git add docs/README.md docs/EXECUTION_INDEX.md examples/localelens-web/README.md examples/localelens-web/docs/evidence/live-product-readiness.md examples/localelens-web/docs/evidence/live-product-readiness-manual.md examples/localelens-web/docs/evidence/live-product-readiness
git diff --cached --check
git commit -m "docs: record LocaleLens live readiness evidence"
```

- [ ] **Step 11: Run the completion audit and stop**

Verify the branch, exact merge base, local commit list, clean task diff, remaining protected/generated changes, and absence of any push:

```bash
git branch --show-current
git merge-base HEAD 00828fa6509a051a92aca521f5b201946c1172db
git log --oneline 00828fa6509a051a92aca521f5b201946c1172db..HEAD
git diff --check 00828fa6509a051a92aca521f5b201946c1172db..HEAD
git status --short --branch
git rev-parse HEAD
git rev-parse refs/remotes/origin/codex/localelens-live-product-readiness 2>/dev/null || true
```

Expected: current branch is `codex/localelens-live-product-readiness`; merge base is the exact required SHA; all task commits are local; only the pre-existing protected/generated paths may remain outside task commits; no remote target-branch ref was created. Stop without push, PR, deployment, publication, submission, merge, or release.
