# LocaleLens Phase 2 Secure Single-Region Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one safe, evidence-rich regional capture through Solari while keeping the API key server-only and every failure explicit.

**Architecture:** A Next.js route validates the requested URL and one supported country, then calls a dependency-injected capture service. The service owns one Solari client and one recorded browser session, extracts bounded evidence, captures a compressed screenshot, returns a typed receipt, and closes both resources in `finally`. A separate route resolves replay state without exposing provider credentials.

**Tech Stack:** Phase 1 stack plus `@solarisdk/browser` 0.1.2, Node DNS and URL APIs, Zod 4.5.4, Vitest fakes, and React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from an owner-accepted Phase 1 terminal SHA and selected visual direction.
- Work Phase 2 only and stop before multi-country live orchestration.
- Do not expose `SOLARI_API_KEY` to client code, logs, fixtures, errors, screenshots, or commits.
- Permit public `https:` URLs only. Reject credentials, non-default ports, loopback, link-local, private, reserved, and metadata-network destinations before launch and after redirects.
- One request performs one regional capture. No automatic provider retry.
- Support only `us`, `gb`, `de`, `fr`, `jp`, and `au`.
- Cap output sizes and reject malformed provider responses.
- Make at most three live Solari calls in this phase, only after all mocked checks pass.
- Stop after the evidence commit; do not push, deploy, or start Phase 3 without separate authority.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── .env.example                              # variable names and safe comments only
├── app/api/captures/route.ts                 # POST boundary and live-mode guard
├── app/api/captures/route.test.ts            # route contracts
├── app/api/replays/[id]/route.ts             # replay lookup boundary
├── app/api/replays/[id]/route.test.ts         # lookup states and validation
├── src/features/capture/capture-region.ts     # provider lifecycle
├── src/features/capture/capture-region.test.ts
├── src/features/capture/extract-page-evidence.ts
├── src/features/capture/extract-page-evidence.test.ts
├── src/features/capture/safe-error.ts         # stable public errors
├── src/features/capture/validate-public-url.ts
├── src/features/capture/validate-public-url.test.ts
├── src/lib/solari.ts                          # narrow client factory
└── src/features/capture/contracts.ts          # Phase 2 request/response additions
```

### Task 1: Add the provider boundary and environment contract

**Files:**
- Modify: `examples/localelens-web/package.json`
- Modify: `examples/localelens-web/package-lock.json`
- Create: `examples/localelens-web/.env.example`
- Create: `examples/localelens-web/src/lib/solari.ts`

**Interfaces:**
- Consumes: `process.env.SOLARI_API_KEY` at request time.
- Produces: `createSolariClient(): Solari` or a stable configuration error.

- [ ] **Step 1: Install only the required runtime dependencies**

```bash
npm install @solarisdk/browser@0.1.2
npm ls --depth=0
```

Expected: exactly one new direct dependency; Phase 0 already pins Zod. Inspect the lockfile diff.

- [ ] **Step 2: Write the failing factory test**

Test that a missing or blank key throws `SOLARI_NOT_CONFIGURED`; a present key constructs the SDK without returning or logging the value. Restore environment state after every test.

- [ ] **Step 3: Confirm RED**

```bash
npm test -- src/lib/solari.test.ts
```

- [ ] **Step 4: Implement the narrow factory**

Keep SDK construction in `src/lib/solari.ts`; do not create a module-level client, because cleanup belongs to each request. `.env.example` contains `SOLARI_API_KEY=` and `LIVE_CAPTURE_ENABLED=false`, never a real value.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/lib/solari.test.ts
npm run typecheck
npm run lint
git add examples/localelens-web/package.json examples/localelens-web/package-lock.json examples/localelens-web/.env.example examples/localelens-web/src/lib/solari.ts examples/localelens-web/src/lib/solari.test.ts
git commit -m "feat: add server-only Solari boundary"
```

### Task 2: Fail closed on unsafe destinations RED-first

**Files:**
- Create: `examples/localelens-web/src/features/capture/validate-public-url.ts`
- Create: `examples/localelens-web/src/features/capture/validate-public-url.test.ts`

**Interfaces:**

```ts
type ResolveHost = (hostname: string) => Promise<readonly string[]>

async function validatePublicUrl(
  rawUrl: string,
  resolveHost: ResolveHost,
): Promise<URL>
```

- [ ] **Step 1: Write a complete rejection matrix**

Cover malformed strings, `http:`, credentials, fragments, ports other than 443, `localhost`, `.local`, IPv4 and IPv6 loopback, RFC1918, carrier-grade NAT, link-local, unique-local, multicast, documentation, benchmark, broadcast, and cloud metadata destinations. Cover public DNS success, a hostname resolving to mixed public/private addresses, and Unicode host normalization.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/capture/validate-public-url.test.ts
```

- [ ] **Step 3: Implement one direct validator**

Parse with `URL`, normalize the hostname, resolve with `dns.promises.lookup(host, { all: true, verbatim: true })`, and reject when any returned address is non-public. Return the normalized `URL`. Do not maintain a domain allowlist.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/capture/validate-public-url.test.ts
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/capture/validate-public-url.ts examples/localelens-web/src/features/capture/validate-public-url.test.ts
git commit -m "feat: reject unsafe capture destinations"
```

### Task 3: Extract bounded, deterministic page evidence RED-first

**Files:**
- Create: `examples/localelens-web/src/features/capture/extract-page-evidence.ts`
- Create: `examples/localelens-web/src/features/capture/extract-page-evidence.test.ts`
- Modify: `examples/localelens-web/src/features/capture/contracts.ts`

**Interfaces:**

```ts
type ExtractedPageEvidence = {
  finalUrl: string
  title: string | null
  documentLanguage: string | null
  currencies: string[]
  priceSnippets: string[]
  primaryHeading: string | null
  primaryAction: string | null
  ctas: string[]
  consentText: string | null
  httpStatus: number | null
}
```

- [ ] **Step 1: Write failing extraction tests**

Use small DOM fixtures to prove normalized whitespace, document-order preservation, deduplication, and caps: title 200 characters, heading/action 240, at most 12 currency tokens, at most 8 price snippets, each snippet 160. Assert script/style/hidden text is excluded.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/capture/extract-page-evidence.test.ts
```

- [ ] **Step 3: Implement a pure browser-evaluable function**

Prefer visible `h1`, then the first visible heading. Prefer a visible button or link whose text is non-empty. Recognize common currency symbols and ISO codes deterministically; do not infer price meaning with an LLM. Keep the extractor free of SDK imports.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/capture/extract-page-evidence.test.ts
npm run typecheck
git add examples/localelens-web/src/features/capture/extract-page-evidence.ts examples/localelens-web/src/features/capture/extract-page-evidence.test.ts examples/localelens-web/src/features/capture/contracts.ts
git commit -m "feat: extract bounded regional evidence"
```

### Task 4: Implement the recorded capture lifecycle RED-first

**Files:**
- Create: `examples/localelens-web/src/features/capture/capture-region.ts`
- Create: `examples/localelens-web/src/features/capture/capture-region.test.ts`
- Create: `examples/localelens-web/src/features/capture/safe-error.ts`
- Create: `examples/localelens-web/src/features/capture/safe-error.test.ts`

**Interfaces:**

```ts
type CaptureDependencies = {
  createClient: () => SolariLike
  now: () => Date
  resolveHost: ResolveHost
}

async function captureRegion(
  request: CaptureRequest,
  dependencies: CaptureDependencies,
): Promise<CaptureResponse>
```

- [ ] **Step 1: Write failing lifecycle tests with fakes**

Assert exact order: validate input, construct client, launch `{ stealth: true, proxy: country, recording: true }`, set viewport `1280x900`, install a top-level navigation guard, navigate with `waitUntil: "domcontentloaded"` and 30-second timeout, wait a bounded 2 seconds, validate the final URL again, verify `browser.proxy.country`, evaluate evidence, take full-page JPEG at quality 72, build receipt, close browser, close client. Prove the guard aborts a redirect to a non-public destination and both close calls happen when launch, navigation, extraction, screenshot, or receipt construction fails.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/capture/capture-region.test.ts src/features/capture/safe-error.test.ts
```

- [ ] **Step 3: Implement without hidden retries**

Guard every top-level document navigation with the same public-target validator before continuing the request; validate the final URL again after navigation. Reject screenshots above 1.5 MB before base64 encoding. Return the stable uppercase error union defined in the product spec, including `INVALID_INPUT`, `PRIVATE_TARGET_BLOCKED`, `NAVIGATION_TIMEOUT`, `SOLARI_CAPACITY`, `SOLARI_AUTH`, `SOLARI_PROXY_MISMATCH`, and `CAPTURE_FAILED`, with safe messages and retryability. Never include provider bodies, stack traces, URLs containing credentials, or environment values.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/capture
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/capture/capture-region.ts examples/localelens-web/src/features/capture/capture-region.test.ts examples/localelens-web/src/features/capture/safe-error.ts examples/localelens-web/src/features/capture/safe-error.test.ts
git commit -m "feat: capture one recorded regional session"
```

### Task 5: Expose guarded capture and replay routes RED-first

**Files:**
- Create: `examples/localelens-web/app/api/captures/route.ts`
- Create: `examples/localelens-web/app/api/captures/route.test.ts`
- Create: `examples/localelens-web/app/api/replays/[id]/route.ts`
- Create: `examples/localelens-web/app/api/replays/[id]/route.test.ts`

**Interfaces:**
- `POST /api/captures` accepts `{ url, country }` and returns `CaptureResponse`.
- `GET /api/replays/:id` returns `{ status, replayUrl? }` for an opaque provider ID.

- [ ] **Step 1: Write failing route tests**

Cover invalid JSON, oversized body, unsupported country, `LIVE_CAPTURE_ENABLED !== "true"`, missing key, success, safe error mapping, replay ID syntax, pending replay, ready replay, missing replay, and provider failure. Require `Cache-Control: no-store` on every response.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- app/api/captures/route.test.ts 'app/api/replays/[id]/route.test.ts'
```

- [ ] **Step 3: Implement the smallest route adapters**

Parse with Zod, cap the JSON body at 2 KB, call the domain service, and return stable status codes. The replay route accepts IDs matching `^[A-Za-z0-9_-]{6,128}$` and returns only an HTTPS replay URL supplied by Solari. Do not persist requests or responses.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- app/api src/features/capture
npm run typecheck
npm run lint
npm run build
git add examples/localelens-web/app/api examples/localelens-web/src/features/capture/contracts.ts
git commit -m "feat: expose guarded capture and replay routes"
```

### Task 6: Run the bounded live proof and freeze the gate

**Files:**
- Create: `examples/localelens-web/docs/evidence/phase-2.md`
- Modify: `examples/localelens-web/README.md`

- [ ] **Step 1: Run all non-live checks first**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

- [ ] **Step 2: Confirm secret-safe local configuration**

Load the real key through the approved local secret path. Confirm `.env*` except `.env.example` is ignored. Use `git diff --cached` and `git grep` to ensure no key value is present.

- [ ] **Step 3: Spend at most three live calls**

Use `https://example.com/` for the first US capture because it is stable and contains no account data. If that passes, capture the same URL from GB to prove proxy separation. Reserve the third call for one diagnosed retry only; do not retry automatically.

- [ ] **Step 4: Record qualified evidence**

Record UTC time, commit SHA, target hostname only, requested and reported countries, safe timing, screenshot byte count, replay status, cleanup result, and pass/fail. Do not record the key, full provider payload, replay bearer URL, or local environment values.

- [ ] **Step 5: Commit and stop**

```bash
git add examples/localelens-web/docs/evidence/phase-2.md examples/localelens-web/README.md
git commit -m "docs: record LocaleLens Phase 2 evidence"
git status --short --branch
```

Report the predecessor SHA, terminal SHA, checks, number of live calls, and exact statement: `Phase 2 complete; Phase 3 not started.` Do not push or deploy without separate owner authorization.

## Phase 2 exit gate

- [ ] All automated checks pass.
- [ ] Unsafe URL and redirect behavior fails closed.
- [ ] Server-only key boundary is proven by source and build inspection.
- [ ] Browser and client cleanup passes every failure-path test.
- [ ] At least one real capture proves requested country, reported proxy, bounded screenshot, evidence, and recording receipt.
- [ ] Live call count is three or fewer.
- [ ] No Phase 3 file or multi-country live orchestration has started.
