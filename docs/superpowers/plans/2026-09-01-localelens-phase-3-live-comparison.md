# LocaleLens Phase 3 Live Comparison and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the approved interface to independent live regional captures, show partial results as they arrive, compare evidence deterministically, and export a reviewable report.

**Architecture:** The browser sends one `POST /api/captures` request per selected country. A single reducer owns per-country state and supports explicit country-level retry; no job queue, polling coordinator, WebSocket, database, or server-side batch endpoint is added. Pure comparison and export functions derive all report content from typed capture receipts.

**Tech Stack:** Phase 2 stack, React `useReducer`, native `fetch` and `AbortController`, Vitest, React Testing Library, and the in-app Browser.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from an owner-accepted Phase 2 terminal SHA with qualified live proof.
- Work Phase 3 only and stop before release hardening.
- Keep two to three selected countries; never fan out beyond three requests.
- One country failing must not discard successful countries.
- Retry is explicit and affects one failed country only. No automatic retry.
- Do not add persistence, accounts, analytics, LLMs, streaming, a state library, or an export dependency.
- JSON and print report generation must escape untrusted page content.
- Make at most four live Solari calls after all mocked checks pass.
- Stop after the Phase 3 evidence commit; do not push or deploy without separate authority.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── app/page.tsx                                  # live/sample wiring only
├── app/report/print.css                          # print-specific layout
├── src/components/comparison-results.tsx         # live derived report
├── src/components/export-actions.tsx              # JSON and print actions
├── src/components/replay-link.tsx                 # pending/ready replay UX
├── src/components/run-status.tsx                  # partial and retry states
├── src/features/compare/compare-evidence.ts       # deterministic differences
├── src/features/compare/compare-evidence.test.ts
├── src/features/export/create-json-report.ts      # bounded JSON artifact
├── src/features/export/create-json-report.test.ts
├── src/features/run/run-comparison.ts             # request fan-out boundary
├── src/features/run/run-comparison.test.ts
├── src/features/run/use-comparison-run.ts         # reducer and retry behavior
└── src/features/run/use-comparison-run.test.tsx
```

### Task 1: Derive comparison rows deterministically RED-first

**Files:**
- Create: `examples/localelens-web/src/features/compare/compare-evidence.ts`
- Create: `examples/localelens-web/src/features/compare/compare-evidence.test.ts`
- Modify: `examples/localelens-web/src/features/capture/contracts.ts`

**Interfaces:**

```ts
type DifferenceKind = "same" | "different" | "missing" | "unavailable"

type DifferenceRow = {
  field: "final_url" | "title" | "language" | "currency" | "price" | "heading" | "primary_action" | "consent"
  values: Partial<Record<SupportedCountry, string>>
  kind: DifferenceKind
}

function compareEvidence(captures: CaptureReceipt[]): DifferenceRow[]
```

- [ ] **Step 1: Write failing matrix tests**

Prove stable row order, normalized whitespace, case-insensitive language/currency equality, price text preservation, missing values, failed-country unavailability, and input-order independence. Include malicious HTML-looking text and prove it remains data.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/compare/compare-evidence.test.ts
```

- [ ] **Step 3: Implement one-pass comparison**

Normalize only for equality; display original bounded evidence. Compare no pixels and invent no semantic claims. A row is `same` only when every successful country has a non-empty equivalent value and there are at least two successful countries.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/compare/compare-evidence.test.ts
npm run typecheck
git add examples/localelens-web/src/features/compare examples/localelens-web/src/features/capture/contracts.ts
git commit -m "feat: derive deterministic market differences"
```

### Task 2: Implement independent request fan-out RED-first

**Files:**
- Create: `examples/localelens-web/src/features/run/run-comparison.ts`
- Create: `examples/localelens-web/src/features/run/run-comparison.test.ts`

**Interfaces:**

```ts
type RunEvents = {
  started(country: SupportedCountry): void
  succeeded(country: SupportedCountry, response: CaptureResponse): void
  failed(country: SupportedCountry, error: PublicCaptureError): void
}

async function runComparison(
  input: AuditFormValue,
  events: RunEvents,
  signal: AbortSignal,
): Promise<void>
```

- [ ] **Step 1: Write failing orchestration tests**

Assert one request per selected country, maximum three, shared normalized URL, independent completion events, preserved partial success, stable handling of invalid JSON and non-2xx responses, and abort propagation. Prove there is no retry and no call for an unselected country.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/run/run-comparison.test.ts
```

- [ ] **Step 3: Implement direct fan-out**

Use `Promise.allSettled` only to know when the run is finished; emit each country result immediately. Set `Content-Type: application/json`. Treat a 45-second client timeout as a safe `navigation_failed` result while allowing the server request to clean up.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/run/run-comparison.test.ts
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/run/run-comparison.ts examples/localelens-web/src/features/run/run-comparison.test.ts
git commit -m "feat: run bounded independent market captures"
```

### Task 3: Replace sample timing with the live reducer RED-first

**Files:**
- Create: `examples/localelens-web/src/features/run/use-comparison-run.ts`
- Create: `examples/localelens-web/src/features/run/use-comparison-run.test.tsx`
- Modify: `examples/localelens-web/app/page.tsx`
- Modify: `examples/localelens-web/app/page.test.tsx`

**Interfaces:**

```ts
type ComparisonRun = {
  mode: "sample" | "live"
  status: "idle" | "running" | "partial" | "complete" | "cancelled"
  regions: RegionRunState[]
  start(value: AuditFormValue): Promise<void>
  retry(country: SupportedCountry): Promise<void>
  cancel(): void
}
```

- [ ] **Step 1: Write failing reducer and page tests**

Cover idle, staggered loading, partial success, complete success, per-country failure, single-country retry, cancellation, a second run replacing the first, and stale responses from an aborted run being ignored. Require a visible `Live Solari capture` or `Sample evidence` label.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/run/use-comparison-run.test.tsx app/page.test.tsx
```

- [ ] **Step 3: Implement one reducer with an operation ID**

Use a monotonically increasing in-memory operation ID to ignore late results. Keep screenshots and receipts in reducer state only. Sample mode remains deterministic when `NEXT_PUBLIC_APP_MODE=sample`; live mode calls the route. Do not copy the API key or live flag into public variables.

- [ ] **Step 4: Verify behavior and commit**

```bash
npm test -- src/features/run app/page.test.tsx
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/run/use-comparison-run.ts examples/localelens-web/src/features/run/use-comparison-run.test.tsx examples/localelens-web/app/page.tsx examples/localelens-web/app/page.test.tsx
git commit -m "feat: connect LocaleLens to partial live results"
```

### Task 4: Render differences, retries, and replay states

**Files:**
- Modify: `examples/localelens-web/src/components/comparison-results.tsx`
- Modify: `examples/localelens-web/src/components/difference-table.tsx`
- Modify: `examples/localelens-web/src/components/region-result.tsx`
- Modify: `examples/localelens-web/src/components/run-status.tsx`
- Create: `examples/localelens-web/src/components/replay-link.tsx`
- Create: `examples/localelens-web/src/components/replay-link.test.tsx`
- Modify: related component tests

- [ ] **Step 1: Write failing interaction tests**

Require successful countries to remain visible when one fails, a `Retry Germany` control to call only `de`, loading to be announced without stealing focus, replay pending to remain non-clickable, replay ready to open safely in a new tab, and missing replay to show `Replay unavailable`.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/components
```

- [ ] **Step 3: Implement within the selected visual system**

Keep screenshot `alt` text specific to country and target hostname. Render tables as semantic tables on wide screens and labeled definition lists at 360px. Use Lucide icons with adjacent text for status and actions.

- [ ] **Step 4: Browser verification and commit**

Inspect success, partial, failure, retrying, and replay-ready states at 360x800, 768x1024, and 1440x900. Then:

```bash
npm test -- src/components
npm run typecheck
npm run lint
git add examples/localelens-web/src/components
git commit -m "feat: present partial results and replay evidence"
```

### Task 5: Add dependency-free export RED-first

**Files:**
- Create: `examples/localelens-web/src/features/export/create-json-report.ts`
- Create: `examples/localelens-web/src/features/export/create-json-report.test.ts`
- Create: `examples/localelens-web/src/components/export-actions.tsx`
- Create: `examples/localelens-web/src/components/export-actions.test.tsx`
- Create: `examples/localelens-web/app/report/print.css`
- Modify: `examples/localelens-web/app/globals.css`

- [ ] **Step 1: Write failing export tests**

Assert schema version, deterministic country and row ordering, ISO timestamp, hostname-only target summary, inclusion of failures and limitations, omission of screenshot base64 and temporary replay URLs, 256 KB serialized cap, safe filename, and disabled actions before two receipts exist.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/export src/components/export-actions.test.tsx
```

- [ ] **Step 3: Implement JSON download and print**

Use `JSON.stringify`, `Blob`, and `URL.createObjectURL`; revoke the URL after download. Print the existing semantic report with CSS. Do not generate HTML strings from captured content and do not add PDF or spreadsheet packages.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/export src/components/export-actions.test.tsx
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/export examples/localelens-web/src/components/export-actions.tsx examples/localelens-web/src/components/export-actions.test.tsx examples/localelens-web/app/report/print.css examples/localelens-web/app/globals.css
git commit -m "feat: export bounded comparison reports"
```

### Task 6: Run bounded live comparison evidence and freeze the gate

**Files:**
- Create: `examples/localelens-web/docs/evidence/phase-3.md`
- Modify: `examples/localelens-web/README.md`

- [ ] **Step 1: Pass the complete mocked suite**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

- [ ] **Step 2: Run one three-country comparison**

With owner-controlled local live mode, compare `https://www.spotify.com/premium/` across US, GB, and DE. This spends three calls. Confirm requested country equals Solari-reported proxy country for every success, all three cards update independently, export excludes binary data, and cleanup completes. If the public target blocks automation or changes unexpectedly, record FAIL or PARTIAL and diagnose it; do not silently switch targets to manufacture a pass.

- [ ] **Step 3: Spend the fourth call only if needed**

If exactly one country fails for a retryable reason, use its visible retry control once. Otherwise do not consume the reserved call.

- [ ] **Step 4: Record qualified evidence**

Document commit, UTC time, hostname, per-country status, call count, export byte size, keyboard result, viewports inspected, replay states, and limitations. A provider or target failure is recorded as FAIL or NOT PROVEN, not rewritten as success.

- [ ] **Step 5: Commit and stop**

```bash
git add examples/localelens-web/docs/evidence/phase-3.md examples/localelens-web/README.md
git commit -m "docs: record LocaleLens Phase 3 evidence"
git status --short --branch
```

Report the predecessor SHA, terminal SHA, checks, exact live call count, and exact statement: `Phase 3 complete; Phase 4 not started.`

## Phase 3 exit gate

- [ ] Two- and three-country runs update independently and never exceed three concurrent requests.
- [ ] Partial success and one-country retry are proven.
- [ ] Differences are deterministic and make no unsupported semantic claims.
- [ ] JSON and print exports are bounded, safe, and exclude screenshots and temporary replay URLs.
- [ ] Sample/live provenance is always visible.
- [ ] Live call count is four or fewer.
- [ ] No Phase 4 hardening or release work has started.
