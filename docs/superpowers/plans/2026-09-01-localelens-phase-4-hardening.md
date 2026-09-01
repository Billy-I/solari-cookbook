# LocaleLens Phase 4 Hardening and Reviewer Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working comparison into a reviewer-ready, security-conscious, accessible, measured build with reproducible evidence.

**Architecture:** Keep the Phase 3 architecture intact. Add only black-box browser tests, accessibility checks, explicit request limits, a lightweight bundle budget script, and evidence documents. Fix discovered defects surgically; do not use this phase for feature expansion or redesign.

**Tech Stack:** Phase 3 stack plus Playwright Test 1.62.1 and `@axe-core/playwright` 4.13.0 for local verification only.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from an owner-accepted Phase 3 terminal SHA.
- Work Phase 4 only and stop before public repository and submission work.
- Preserve the selected design. Fix defects; do not add themes, pages, onboarding, accounts, or new capture fields.
- Use the in-app Browser for exploratory visual checks. Do not switch to another user browser.
- Automated E2E runs in sample mode by default and must spend zero Solari credits.
- A live smoke run is bounded to four calls and starts only after every non-live check passes.
- Evidence distinguishes mocked, Browser, automated E2E, live provider, deployed, and assistive-technology results.
- Record unavailable evidence as `NOT PROVEN`.
- Stop after the Phase 4 evidence commit; do not push, deploy, or post without separate authority.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── e2e/accessibility.spec.ts                   # automated accessibility states
├── e2e/comparison.spec.ts                      # sample-mode main journey
├── e2e/responsive.spec.ts                      # bounded viewport assertions
├── playwright.config.ts                        # local test server and projects
├── scripts/check-client-budget.mjs             # built client JS gzip ceiling
├── src/features/capture/limits.ts              # shared explicit caps
├── src/features/capture/limits.test.ts
├── docs/evidence/phase-4.md                     # evidence register
├── docs/evidence/security-review.md             # threat and secret checks
└── docs/evidence/visual-review.md               # viewport/state findings
```

### Task 1: Centralize and prove resource limits RED-first

**Files:**
- Create: `examples/localelens-web/src/features/capture/limits.ts`
- Create: `examples/localelens-web/src/features/capture/limits.test.ts`
- Modify: `examples/localelens-web/src/features/capture/capture-region.ts`
- Modify: `examples/localelens-web/app/api/captures/route.ts`
- Modify: affected tests

**Interfaces:**

```ts
export const CAPTURE_LIMITS = {
  requestBytes: 2_048,
  navigationMs: 30_000,
  settleMs: 2_000,
  screenshotBytes: 1_500_000,
  responseBytes: 3_000_000,
  exportBytes: 262_144,
  maxCountries: 3,
} as const
```

- [ ] **Step 1: Write failing boundary tests**

Test exactly-at-limit and one-byte-over behavior for request, screenshot, and export data; two and three countries accepted; one and four rejected; navigation timeout mapped safely; and settle time controlled by an injected clock in unit tests.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/capture/limits.test.ts app/api/captures/route.test.ts
```

- [ ] **Step 3: Replace duplicated literals only**

Move the existing numeric caps into `limits.ts` and consume them from the exact call sites. Do not create a generic configuration layer.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/capture app/api/captures/route.test.ts src/features/export
npm run typecheck
npm run lint
git add examples/localelens-web/src/features/capture examples/localelens-web/app/api/captures/route.ts examples/localelens-web/app/api/captures/route.test.ts examples/localelens-web/src/features/export
git commit -m "test: enforce LocaleLens resource limits"
```

### Task 2: Add sample-mode browser journeys

**Files:**
- Modify: `examples/localelens-web/package.json`
- Modify: `examples/localelens-web/package-lock.json`
- Create: `examples/localelens-web/playwright.config.ts`
- Create: `examples/localelens-web/e2e/comparison.spec.ts`
- Create: `examples/localelens-web/e2e/responsive.spec.ts`

- [ ] **Step 1: Install verification-only dependencies**

```bash
npm install --save-dev @playwright/test@1.62.1 @axe-core/playwright@4.13.0
npx playwright install chromium
```

The browser binary is local tooling, not committed.

- [ ] **Step 2: Write failing main-journey tests**

At 1440x900 and 360x800, load sample mode, enter a public HTTPS URL, select US/GB/DE, run the comparison, wait for independent statuses, inspect the difference table, download JSON, open print mode, and start a second run. Assert no console errors and no horizontal document overflow.

- [ ] **Step 3: Confirm RED before configuration is complete**

```bash
npm run test:e2e
```

- [ ] **Step 4: Configure the narrow local runner**

Use one Chromium project, reuse a locally started `npm run dev`, set `NEXT_PUBLIC_APP_MODE=sample`, retain trace only on first retry, screenshot only on failure, and forbid retries in CI. Do not add cross-browser or visual-snapshot infrastructure.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:e2e
git add examples/localelens-web/package.json examples/localelens-web/package-lock.json examples/localelens-web/playwright.config.ts examples/localelens-web/e2e/comparison.spec.ts examples/localelens-web/e2e/responsive.spec.ts
git commit -m "test: cover LocaleLens browser journey"
```

### Task 3: Audit accessibility in code and browser

**Files:**
- Create: `examples/localelens-web/e2e/accessibility.spec.ts`
- Modify: components only when a failing check requires it
- Modify: component tests paired with each fix

- [ ] **Step 1: Add failing automated checks**

Run axe on idle, validation-error, running, complete, and partial-failure sample states. Test keyboard order, visible focus, error-summary focus, live-region announcements, screenshot alternative text, table/list labels, target size, reduced motion, and 200% browser zoom without loss of content.

- [ ] **Step 2: Run and classify failures**

```bash
npm run test:e2e -- e2e/accessibility.spec.ts
```

For every failure, record element, rule, impact, and smallest correction before editing.

- [ ] **Step 3: Fix only evidenced defects RED-first**

Add or change the paired unit test, confirm it fails, apply the smallest semantic or token fix, and rerun the focused test. Do not silence axe rules globally.

- [ ] **Step 4: Verify and commit**

```bash
npm test
npm run test:e2e -- e2e/accessibility.spec.ts
npm run typecheck
npm run lint
git add examples/localelens-web/e2e/accessibility.spec.ts examples/localelens-web/src examples/localelens-web/app
git commit -m "fix: close LocaleLens accessibility findings"
```

If VoiceOver or another screen reader is not directly exercised, record `screen_reader: NOT PROVEN`; automated axe is not equivalent.

### Task 4: Measure the client budget and remove accidental weight

**Files:**
- Create: `examples/localelens-web/scripts/check-client-budget.mjs`
- Modify: `examples/localelens-web/package.json`
- Modify: source only if the measurement exceeds the budget

- [ ] **Step 1: Build and record the baseline**

```bash
npm run build
```

Read the emitted client manifest and gzip the JavaScript files used by the main route. Record the exact baseline before changing code.

- [ ] **Step 2: Write a failing budget command**

Add `npm run check:budget` backed by a Node script that exits nonzero when first-load main-route JavaScript exceeds 180 KB gzip. The script reports file names and totals and fails if the manifest cannot be read.

- [ ] **Step 3: Reduce weight only if measured over budget**

First remove accidental client boundaries, duplicate imports, or unused packages. Do not replace working accessible UI with custom lower-level controls merely to hit the budget. If 180 KB cannot be reached without harming correctness, document the measured exception instead of falsifying the result.

- [ ] **Step 4: Verify and commit**

```bash
npm run build
npm run check:budget
npm ls --depth=0
git add examples/localelens-web/scripts/check-client-budget.mjs examples/localelens-web/package.json examples/localelens-web/package-lock.json examples/localelens-web/app examples/localelens-web/src
git commit -m "perf: enforce LocaleLens client budget"
```

### Task 5: Perform security and privacy review

**Files:**
- Create: `examples/localelens-web/docs/evidence/security-review.md`
- Modify: source and paired tests only for confirmed findings

- [ ] **Step 1: Inspect tracked and built output for secrets**

```bash
git grep -nE 'slr_(live|test)_[A-Za-z0-9_-]{12,}|SOLARI_API_KEY=.+'
rg -n 'SOLARI_API_KEY|LIVE_CAPTURE_ENABLED' .next --glob '!cache/**'
git status --ignored --short
```

Expected: no key-shaped values; only intended server references and safe variable names. Review the complete staged diff manually before any commit.

- [ ] **Step 2: Re-run the threat matrix**

Verify SSRF rejection including redirect revalidation, response `no-store`, safe provider errors, screenshot and export caps, replay URL validation, no credential logging, disabled live mode by default, and browser/client cleanup.

- [ ] **Step 3: Probe route failures locally**

Exercise invalid method, invalid JSON, oversized body, unsafe URL, unsupported country, live-disabled, and replay-ID failures. Confirm responses reveal neither filesystem paths nor stack traces.

- [ ] **Step 4: Fix confirmed findings with focused tests**

For each finding: add a failing regression test, make the smallest fix, rerun the focused suite, and append evidence. Do not broaden the security layer beyond this public-page capture boundary.

- [ ] **Step 5: Commit the review**

```bash
npm test
npm run typecheck
npm run lint
git add examples/localelens-web/docs/evidence/security-review.md examples/localelens-web/app examples/localelens-web/src
git commit -m "docs: record LocaleLens security review"
```

### Task 6: Run visual and bounded live evidence, then freeze the gate

**Files:**
- Create: `examples/localelens-web/docs/evidence/visual-review.md`
- Create: `examples/localelens-web/docs/evidence/phase-4.md`
- Modify: `examples/localelens-web/README.md`

- [ ] **Step 1: Run the full non-live gate**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run check:budget
npm run test:e2e
git diff --check
```

- [ ] **Step 2: Inspect real rendered states in the in-app Browser**

At 360x800, 768x1024, and 1440x900 inspect idle, invalid input, running, success, partial failure, retrying, replay pending, and replay ready. Check type hierarchy, rules, spacing, radii, image crop, overflow, focus, 200% zoom, and reduced motion against the selected reference.

- [ ] **Step 3: Run one bounded real comparison**

Use owner-controlled local live mode and `https://www.spotify.com/premium/` across US, GB, and DE. Reserve one call for a single explicit retry only. Record target blocking or instability as FAIL or PARTIAL; do not silently switch targets. Keep the live result separate from sample E2E and Browser visual evidence.

- [ ] **Step 4: Freeze the evidence register**

Record exact predecessor and terminal SHAs, commands, pass/fail, live call count, client budget, viewports, accessibility scope, provider proof, known limitations, and any `NOT PROVEN` rows. Do not call a deployment or screen-reader pass proven unless it happened.

- [ ] **Step 5: Commit and stop**

```bash
git add examples/localelens-web/docs/evidence/visual-review.md examples/localelens-web/docs/evidence/phase-4.md examples/localelens-web/README.md
git commit -m "docs: record LocaleLens Phase 4 readiness"
git status --short --branch
```

Report the predecessor SHA, terminal SHA, all checks, exact live call count, known risks, and exact statement: `Phase 4 complete; Phase 5 not started.`

## Phase 4 exit gate

- [ ] Unit, component, route, build, budget, and sample E2E checks pass.
- [ ] Accessibility results are honest and scoped by evidence type.
- [ ] Security review shows no committed or built secret values.
- [ ] Main-route client JavaScript is at or below 180 KB gzip, or a measured exception is documented.
- [ ] Selected visual direction is verified across required states and viewports.
- [ ] Live call count is four or fewer.
- [ ] No public push, deployment, or social post has occurred.
