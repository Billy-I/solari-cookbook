# LocaleLens Phase 2 Secure Single-Region Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one safe, evidence-rich regional capture through Solari while keeping the API key server-only and every failure explicit.

**Architecture:** A Next.js route validates the requested URL and one supported country, then calls a dependency-injected capture service. The service owns one Solari client and one recorded browser session, extracts bounded evidence, captures a compressed screenshot, returns a typed receipt, and closes both resources in `finally`. A separate route resolves replay state without exposing provider credentials.

**Tech Stack:** Phase 1 stack plus `@solarisdk/browser` 0.1.2, Node DNS and URL APIs, Zod 4.5.4, Vitest fakes, and React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from a reviewed planning checkpoint that descends from the owner-accepted Phase 1 terminal SHA and selected visual direction.
- The repository must be the official cookbook clone with Billy's fork configured as writable `origin` and `https://github.com/solari-sdk/solari-cookbook.git` retained as `upstream`. Stop before source edits if the fork does not exist or remote ownership is ambiguous.
- Work Phase 2 only and stop before multi-country live orchestration.
- Do not expose `SOLARI_API_KEY` to client code, logs, fixtures, errors, screenshots, or commits.
- Permit public `https:` URLs only. Reject credentials, non-default ports, loopback, link-local, private, reserved, and metadata-network destinations before launch and after redirects.
- One request performs one regional capture. No automatic provider retry.
- Construct `Solari` with `maxAttempts: 1` and call `launch()` with
  `retries: 0`; the SDK's documented `maxAttempts` default is `2`, which would
  otherwise retry transient HTTP failures once.
- Support only `us`, `gb`, `de`, `fr`, `jp`, and `au`.
- Cap output sizes and reject malformed provider responses.
- Make at most three live Solari calls in this phase, only after all mocked checks pass.
- Stop after the evidence commit; do not push, deploy, or start Phase 3 without separate authority.

---

## Phase 2 preflight gate

Complete this gate before installing the SDK or editing application source:

1. Confirm repository root, clean tracked worktree, branch, `HEAD`, remotes, and exact predecessor. Preserve the untracked Next.js-generated `examples/localelens-web/AGENTS.md` and `examples/localelens-web/CLAUDE.md` unless the owner separately scopes them.
2. Verify `origin` is Billy's fork of `solari-sdk/solari-cookbook`, `upstream` is the official repository, and the completed Phase 1 branch has remote SHA parity. Do not push to the official upstream.
3. Create `codex/localelens-phase-2-secure-capture` from the exact reviewed planning checkpoint. Keep Phase 2 commits on that branch.
4. Recheck the official [Solari quickstart](https://docs.getsolari.com/quickstart), [session lifecycle](https://docs.getsolari.com/sessions), [proxy](https://docs.getsolari.com/proxies), and [recording](https://docs.getsolari.com/recording) documentation. Confirm `@solarisdk/browser@0.1.2` remains the registry `latest` version and that the documented API still matches this plan; stop and revise the plan if either changed.
   The 2026-09-01 recheck confirmed `0.1.2` remains `latest` and the planned
   `Solari`, `BrowserSession.proxy`, cleanup, and replay APIs remain current.
   The SDK reference also documents a two-attempt HTTP default, so this plan
   now requires `maxAttempts: 1` explicitly.
   The Browser API reference documents signed composite session IDs containing
   `:`, `.`, `_`, and `-`, and an intentionally ambiguous replay `404` that can
   mean finalization is pending, recording was absent, or the session is not
   owned. Replay validation and states below reflect that live contract.
5. Billy creates or supplies a Solari `slr_live_` key from the console through an approved local secret path. The executor may verify only redacted presence/absence and must never print, paste, log, commit, or place the value in a `NEXT_PUBLIC_` variable.
6. Confirm the live-call budget remains at most three. No provider call occurs before mocked tests, typecheck, lint, build, secret scan, and live-mode guards pass.

### Test-target strategy

- Do not create or deploy a second locale website in Phase 2.
- Use `https://example.com/` for the bounded provider smoke proof. It is intentionally stable and proves that LocaleLens can launch, navigate, extract, screenshot, close, and retrieve replay state through the real Solari system.
- Accept regional proof only when the returned `browser.proxy` metadata matches the requested country; a successful page response alone is insufficient.
- Treat content sameness on `example.com` as expected. It does not prove regional content variation.
- Phase 3 uses a real public locale-sensitive target for the end-to-end multi-country product proof. If that target is blocked or unstable, record `FAIL`, `PARTIAL`, or `NOT PROVEN`; do not silently build or deploy a controlled fixture to manufacture a pass.

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
- Modify: `examples/localelens-web/.env.example`
- Create: `examples/localelens-web/src/lib/solari.ts`

**Interfaces:**
- Consumes: `process.env.SOLARI_API_KEY` at request time.
- Produces: `createSolariClient(): Solari` configured with `maxAttempts: 1`, or
  a stable configuration error.

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

Keep SDK construction in `src/lib/solari.ts`; pass `maxAttempts: 1` so the SDK
cannot perform its documented transient HTTP retry. Do not create a
module-level client, because cleanup belongs to each request. `.env.example`
contains `SOLARI_API_KEY=` and `LIVE_CAPTURE_ENABLED=false`, never a real value.

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

Assert exact order: validate input, construct client, launch `{ stealth: true,
proxy: country, recording: true, retries: 0 }`, set viewport `1280x900`, install
a top-level navigation guard, navigate with `waitUntil: "domcontentloaded"` and
30-second timeout, wait a bounded 2 seconds, validate the final URL again,
verify `browser.proxy.country`, evaluate evidence, take full-page JPEG at
quality 72, build receipt, close browser, close client. Prove the guard aborts
a redirect to a non-public destination and both close calls happen when launch,
navigation, extraction, screenshot, or receipt construction fails.

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

Cover invalid JSON, oversized body, unsupported country,
`LIVE_CAPTURE_ENABLED !== "true"`, missing key, success, safe error mapping,
replay ID syntax, the provider's ambiguous `404` pending/unavailable state,
ready replay, and provider failure. Require `Cache-Control: no-store` on every
response. Do not claim that a replay is definitively missing from a `404`.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- app/api/captures/route.test.ts 'app/api/replays/[id]/route.test.ts'
```

- [ ] **Step 3: Implement the smallest route adapters**

Parse with Zod, cap the JSON body at 2 KB, call the domain service, and return
stable status codes. The replay route accepts IDs matching
`^[A-Za-z0-9_.:-]{6,500}$`, which admits the documented signed composite format
without admitting slashes, query strings, whitespace, or percent escapes. It
returns only an HTTPS replay URL supplied by Solari. Create the replay client
per request and always call `solari.close()` in `finally`; a provider `404`
remains pending/unavailable because the API intentionally does not distinguish
finalization from an absent or unowned recording. Do not persist requests or
responses, poll automatically, or claim a definitive missing state.

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

Load the real key through the approved local secret path without printing it. Confirm `.env*` except `.env.example` is ignored. Use `git diff --cached`, `git grep`, and production-build inspection to ensure no key value or `NEXT_PUBLIC_SOLARI` alias is present.

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
- [ ] At least one real capture proves requested country, matching reported proxy metadata, bounded screenshot, extracted evidence, client/browser cleanup, and recording receipt; replay is either retrieved or honestly recorded as pending within the bounded polling window.
- [ ] Live call count is three or fewer.
- [ ] No Phase 3 file or multi-country live orchestration has started.
