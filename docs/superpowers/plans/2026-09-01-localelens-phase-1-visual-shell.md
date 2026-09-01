# LocaleLens Phase 1 Visual System and Sample Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select one owner-approved visual direction and implement the complete responsive LocaleLens main journey with deterministic sample evidence only.

**Architecture:** Product Design owns visual target selection before source edits. After selection, a small set of semantic React components renders reducer-driven sample states; no capture route, Solari SDK, network call, or provider credential exists in this phase.

**Tech Stack:** Phase 0 stack plus Lucide React 1.38.0, Tailwind CSS tokens, React `useReducer`, React Testing Library, and the in-app Browser for visual verification.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from an owner-accepted Phase 0 terminal SHA.
- Work Phase 1 only and stop before Phase 2.
- Generate exactly three visual directions and wait for the owner to select one before editing UI source.
- Use the selected visual as the implementation target; do not combine the three directions.
- Use Tailwind CSS and Lucide only. Do not add shadcn, Radix, Base UI, Motion, a component suite, or a state library.
- Use deterministic fixtures; make zero Solari calls and create no API route.
- Keep the light theme only.
- Preserve the exact product scope: one URL, two or three countries, one page.
- Verify at 360x800, 768x1024, and 1440x900 after each visible task.
- Stop after the Phase 1 evidence commit; do not push or deploy without separate authority.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── app/globals.css                         # selected tokens and global primitives
├── app/page.tsx                            # page composition only
├── src/components/audit-form.tsx           # URL and country input
├── src/components/comparison-results.tsx   # responsive result composition
├── src/components/difference-table.tsx     # semantic evidence comparison
├── src/components/region-result.tsx        # screenshot and regional evidence
├── src/components/run-receipt.tsx          # run provenance summary
├── src/components/run-status.tsx           # accessible per-country status
├── src/features/run/use-sample-run.ts       # deterministic phase-1 state flow
└── src/features/run/use-sample-run.test.tsx # state transition coverage
```

### Task 1: Select the visual target before implementation

**Files:**
- Create: `docs/design/localelens-visual-direction.md`
- Create: `docs/design/evidence/phase-1-option-a.png`
- Create: `docs/design/evidence/phase-1-option-b.png`
- Create: `docs/design/evidence/phase-1-option-c.png`
- Create: `examples/localelens-web/public/sample/us.jpg`
- Create: `examples/localelens-web/public/sample/gb.jpg`
- Create: `examples/localelens-web/public/sample/de.jpg`

**Interfaces:**
- Consumes: product spec sections 5 and 14 plus deterministic US/GB/DE fixtures.
- Produces: one owner-selected visual target and written selection rationale.

- [ ] **Step 1: Run Product Design context playback**

Playback exactly this brief before ideation:

> Design a premium, responsive web application for product and localization teams comparing one public page across US, UK, and Germany. The dominant content is three regional screenshots plus aligned evidence rows. It should feel like an editorial comparison instrument, not a generic dashboard: warm neutral canvas, graphite type, fine rules, restrained signal color, accessible native controls, and no decorative data cards.

- [ ] **Step 2: Generate exactly three visual directions**

Use Product Design ideation to produce three distinct full-page desktop directions with realistic sample data. Each must include the run form, three country statuses, three screenshots, a difference table, export actions, and limitations copy.

- [ ] **Step 3: Present the three options and stop for selection**

Do not edit application files while waiting. Record owner feedback verbatim enough to preserve the decision.

- [ ] **Step 4: Freeze the selected direction**

Write `docs/design/localelens-visual-direction.md` with:

- selected option;
- rejected option trade-offs;
- screenshot path;
- visual tokens visible in the target;
- responsive adaptation rules;
- motion and reduced-motion rules;
- `owner_selected: true` and date.

- [ ] **Step 5: Create the three real sample assets**

Use Product Design/ImageGen to create a coherent set of three 1280x900 fictional storefront-page captures for US, UK, and Germany. They share one layout while visibly differing in currency, offer copy, and primary action. Use no real brand, person, provider logo, browser chrome, session data, or copied company text. Inspect each file at actual size and reject illegible or inconsistent outputs.

- [ ] **Step 6: Commit design evidence and sample assets only**

```bash
git add docs/design/localelens-visual-direction.md docs/design/evidence/phase-1-option-a.png docs/design/evidence/phase-1-option-b.png docs/design/evidence/phase-1-option-c.png examples/localelens-web/public/sample/us.jpg examples/localelens-web/public/sample/gb.jpg examples/localelens-web/public/sample/de.jpg
git commit -m "docs: select LocaleLens visual direction"
```

### Task 2: Establish selected tokens and page structure RED-first

**Files:**
- Modify: `examples/localelens-web/package.json`
- Modify: `examples/localelens-web/package-lock.json`
- Modify: `examples/localelens-web/app/globals.css`
- Modify: `examples/localelens-web/app/page.tsx`
- Modify: `examples/localelens-web/app/page.test.tsx`

**Interfaces:**
- Consumes: selected visual target and Phase 0 fixtures.
- Produces: semantic regions labeled `Run comparison`, `Run evidence`, and `Regional results`.

- [ ] **Step 1: Add the only Phase 1 dependency**

```bash
npm install lucide-react@1.38.0
```

Inspect `npm ls --depth=0` and stop if another direct dependency is introduced.

- [ ] **Step 2: Replace the Phase 0 test with the failing composition contract**

```tsx
render(<Page />)
expect(screen.getByRole("heading", { name: "Compare the experience by market" })).toBeVisible()
expect(screen.getByRole("region", { name: "Run comparison" })).toBeVisible()
expect(screen.getByRole("region", { name: "Regional results" })).toBeVisible()
expect(screen.getAllByRole("article", { name: /regional evidence/i })).toHaveLength(3)
```

- [ ] **Step 3: Confirm RED**

```bash
npm test -- app/page.test.tsx
```

Expected: FAIL against the Phase 0 shell.

- [ ] **Step 4: Implement tokens and composition**

Translate only selected target values into CSS custom properties in `globals.css`. Keep `page.tsx` responsible for composition and data wiring, not field rendering. Use semantic `header`, `main`, `section`, and `footer`; one `h1`; and visible text labels.

- [ ] **Step 5: Verify automated and Browser states**

```bash
npm test -- app/page.test.tsx
npm run typecheck
npm run lint
```

Open the page in the in-app Browser at 360x800, 768x1024, and 1440x900. Confirm no horizontal document overflow, clipped controls, or inaccessible content.

- [ ] **Step 6: Commit page structure**

```bash
git add examples/localelens-web/package.json examples/localelens-web/package-lock.json examples/localelens-web/app/globals.css examples/localelens-web/app/page.tsx examples/localelens-web/app/page.test.tsx
git commit -m "feat: establish LocaleLens visual system"
```

### Task 3: Implement the run form and input states RED-first

**Files:**
- Create: `examples/localelens-web/src/components/audit-form.tsx`
- Create: `examples/localelens-web/src/components/audit-form.test.tsx`

**Interfaces:**
- Consumes: `SupportedCountry` and selected values.
- Produces: `AuditFormValue` and `onSubmit(value: AuditFormValue): void`.

```ts
type AuditFormValue = {
  url: string
  countries: SupportedCountry[]
}
```

- [ ] **Step 1: Write failing behavioral tests**

Assert:

- default countries are `us` and `gb`;
- one cannot deselect below two countries;
- one cannot select above three countries;
- invalid or non-HTTPS URLs show one alert and do not submit;
- valid submit returns a trimmed URL and selected countries in display order;
- busy state disables URL, country changes, and submit but does not hide values.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/components/audit-form.test.tsx
```

- [ ] **Step 3: Implement native accessible controls**

Use a labeled native URL input and labeled native checkboxes. Do not recreate checkboxes with divs. Move focus to the error summary after invalid submit. `Compare markets` is the only primary action.

- [ ] **Step 4: Verify and inspect**

```bash
npm test -- src/components/audit-form.test.tsx
npm run typecheck
npm run lint
```

In Browser, operate the entire form with keyboard only and inspect 360px wrapping.

- [ ] **Step 5: Commit the form**

```bash
git add examples/localelens-web/src/components/audit-form.tsx examples/localelens-web/src/components/audit-form.test.tsx
git commit -m "feat: add bounded market comparison form"
```

### Task 4: Implement deterministic run states RED-first

**Files:**
- Create: `examples/localelens-web/src/features/run/use-sample-run.ts`
- Create: `examples/localelens-web/src/features/run/use-sample-run.test.tsx`
- Create: `examples/localelens-web/src/components/run-status.tsx`
- Create: `examples/localelens-web/src/components/run-status.test.tsx`

**Interfaces:**
- Consumes: `AuditFormValue` and `sampleCaptureByCountry`.
- Produces:

```ts
type RegionRunState = {
  country: SupportedCountry
  stage: CaptureStage
  response: CaptureResponse | null
}

type SampleRunController = {
  status: "idle" | "running" | "complete" | "partial"
  regions: RegionRunState[]
  start(value: AuditFormValue): Promise<void>
  retry(country: SupportedCountry): Promise<void>
}
```

- [ ] **Step 1: Write failing reducer/hook tests**

Use fake timers. Assert independent country progression, first-result visibility before the last result, explicit one-country retry, and partial status when one fixture is replaced with a safe failure.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/features/run/use-sample-run.test.tsx
```

- [ ] **Step 3: Implement the smallest reducer-backed hook**

Use `useReducer`, a fixed stage order, and injected fixture lookup. Do not create a context provider or global store. Sample delays are presentation-only and capped at 600ms per region.

- [ ] **Step 4: Implement accessible status text**

Render country name, exact stage label, and failure copy as text. One parent polite live region announces meaningful stage changes; do not add a live region per row.

- [ ] **Step 5: Verify**

```bash
npm test -- src/features/run/use-sample-run.test.tsx src/components/run-status.test.tsx
npm test
npm run typecheck
```

- [ ] **Step 6: Commit run states**

```bash
git add examples/localelens-web/src/features/run/use-sample-run.ts examples/localelens-web/src/features/run/use-sample-run.test.tsx examples/localelens-web/src/components/run-status.tsx examples/localelens-web/src/components/run-status.test.tsx
git commit -m "feat: add deterministic comparison run states"
```

### Task 5: Render regional results and differences RED-first

**Files:**
- Create: `examples/localelens-web/src/components/region-result.tsx`
- Create: `examples/localelens-web/src/components/region-result.test.tsx`
- Create: `examples/localelens-web/src/components/difference-table.tsx`
- Create: `examples/localelens-web/src/components/difference-table.test.tsx`
- Create: `examples/localelens-web/src/components/comparison-results.tsx`
- Create: `examples/localelens-web/src/components/run-receipt.tsx`

**Interfaces:**
- Consumes: `RegionRunState[]`, `ComparedField[]`, and redacted sample screenshots.
- Produces: the complete sample comparison surface.

- [ ] **Step 1: Write failing component tests**

Assert screenshot alt text contains country, host, and timestamp; `null` consent renders `Not detected` rather than `None`; failed region retains safe error copy and retry; table headers associate with cells; and comparison state is written as text.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- src/components/region-result.test.tsx src/components/difference-table.test.tsx
```

- [ ] **Step 3: Implement result components**

Keep screenshots dominant. Use one article per country and quiet row dividers. Do not nest decorative cards. Render untrusted evidence as text only. Use icons as secondary decoration with `aria-hidden="true"`.

- [ ] **Step 4: Integrate the main journey**

Wire `AuditForm`, `useSampleRun`, run receipt, statuses, results, and limitations in `page.tsx`. Export actions remain disabled future controls with the visible label `Available after Phase 3`; they must not download a file in Phase 1.

- [ ] **Step 5: Run automated gates**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 6: Run visual comparison**

Capture the implementation at the same state and viewport as the selected design target. Compare them side by side, fix visible spacing, type, radius, border, and responsive mismatches, then repeat at all three required viewports.

- [ ] **Step 7: Commit the sample experience**

```bash
git add examples/localelens-web/app/page.tsx examples/localelens-web/src/components
git commit -m "feat: complete LocaleLens sample experience"
```

### Task 6: Freeze Phase 1 evidence and stop

**Files:**
- Create: `docs/evidence/localelens-phase-1.md`
- Modify: `examples/localelens-web/README.md`

**Interfaces:**
- Consumes: automated outputs and Browser captures.
- Produces: owner-reviewable Phase 1 gate.

- [ ] **Step 1: Run terminal verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

- [ ] **Step 2: Record qualified evidence**

Include selected design path, viewport observations, keyboard result, automated commands, dependency list, and:

```text
live_solari_calls: 0
sample_mode: PASS
direct_screen_reader: NOT_PROVEN
hosted: NOT_PROVEN
phase_2_authorized: false
```

- [ ] **Step 3: Commit evidence**

```bash
git add docs/evidence/localelens-phase-1.md examples/localelens-web/README.md
git commit -m "docs: record LocaleLens Phase 1 evidence"
```

- [ ] **Step 4: Stop**

Report exact predecessor and terminal SHAs, checks, visual evidence, and `Phase 1 complete; Phase 2 not started.`
