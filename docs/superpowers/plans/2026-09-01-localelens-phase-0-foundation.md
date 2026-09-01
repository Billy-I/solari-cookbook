# LocaleLens Phase 0 Repository Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a fork-aligned, testable LocaleLens example with exact contracts and deterministic sample data, without implementing UI or calling Solari.

**Architecture:** Work inside `examples/localelens-web/` in the public Solari cookbook fork. Phase 0 creates the minimal Next.js/TypeScript test foundation and pure domain contracts that later phases consume; all provider, UI, export, and deployment work remains absent.

**Tech Stack:** Node.js 22 LTS, npm, Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind CSS 4.3.3, Zod 4.5.4, Vitest 4.1.11.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Work Phase 0 only and stop before Phase 1.
- Start from the current `upstream/main` commit of `solari-sdk/solari-cookbook`; record the exact SHA in the phase evidence.
- Do not call Solari, request an API key, create a browser, generate visual options, deploy, push, open a pull request, or post publicly.
- Keep all application files under `examples/localelens-web/` and shared planning docs under repository-root `docs/`.
- Use npm and commit `package-lock.json`.
- Use TypeScript `strict: true` and no `any`.
- Add only packages listed in this plan.
- Preserve unrelated or untracked files and stage explicit paths only.

---

## Planned file responsibilities

```text
examples/localelens-web/
├── package.json                       # commands and exact dependency surface
├── package-lock.json                  # reproducible npm resolution
├── tsconfig.json                      # strict TypeScript configuration
├── next.config.ts                     # minimal Next configuration
├── postcss.config.mjs                 # Tailwind PostCSS registration
├── eslint.config.mjs                  # Next and TypeScript lint rules
├── vitest.config.ts                   # unit-test configuration
├── .env.example                       # names only; no secret values
├── .nvmrc                             # pinned Node 22 runtime
├── app/layout.tsx                     # minimal valid document shell
├── app/page.tsx                       # explicit Phase 0 foundation status copy only
├── app/globals.css                    # Tailwind import and minimal base tokens
├── src/features/capture/contracts.ts  # schemas and public domain types
├── src/test/fixtures.ts               # deterministic redacted sample results
├── src/test/setup.ts                  # DOM test cleanup
└── src/test/contracts.test.ts         # contract parsing and invariant tests
```

### Task 1: Anchor the fork and create the example package

**Files:**
- Create: `examples/localelens-web/package.json`
- Create: `examples/localelens-web/tsconfig.json`
- Create: `examples/localelens-web/next.config.ts`
- Create: `examples/localelens-web/postcss.config.mjs`
- Create: `examples/localelens-web/eslint.config.mjs`
- Create: `examples/localelens-web/vitest.config.ts`
- Create: `examples/localelens-web/.env.example`
- Create: `examples/localelens-web/.nvmrc`

**Interfaces:**
- Consumes: repository root and exact `upstream/main` SHA.
- Produces: commands `dev`, `build`, `start`, `test`, `typecheck`, and `lint` for later tasks.

- [ ] **Step 1: Record repository lineage before editing**

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git rev-parse HEAD
git remote -v
git ls-remote upstream refs/heads/main
```

Expected: the root is the cookbook fork, the current branch is a dedicated `codex/localelens-phase-0-foundation` branch, and local `HEAD` equals the recorded upstream-main SHA at branch creation.

- [ ] **Step 2: Create the package manifest**

Create `examples/localelens-web/package.json` with this dependency boundary:

```json
{
  "name": "localelens-web",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=22.12.0 <23"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "4.5.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/node": "22.20.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.5",
    "@vitejs/plugin-react": "6.1.1",
    "eslint": "10.9.1",
    "eslint-config-next": "16.3.4",
    "jsdom": "30.0.1",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vite": "8.2.2",
    "vitest": "4.1.11"
  }
}
```

Before installation, run `npm view <package> version` for every pinned package. If any exact version is unavailable, stop and report the mismatch; do not silently substitute another version.

- [ ] **Step 3: Add strict configuration and pin Node 22**

Create `.nvmrc` containing `22.20.0`. Create `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and the `@/*` path alias. Create minimal Next, PostCSS, ESLint flat-config, and Vitest configuration. Vitest must use `jsdom`, load `src/test/setup.ts`, and include `src/**/*.test.{ts,tsx}`. Before installation, confirm `node --version` satisfies the package engine; switch to the pinned Node 22 runtime when it does not.

- [ ] **Step 4: Add environment names without values**

Create `.env.example`:

```text
SOLARI_API_KEY=
LIVE_CAPTURE_ENABLED=false
```

No other environment variable is introduced.

- [ ] **Step 5: Install and inspect the dependency tree**

Run:

```bash
cd examples/localelens-web
npm install
npm ls --depth=0
```

Expected: installation succeeds, the lockfile is created, and only the manifest's direct packages appear at depth zero.

- [ ] **Step 6: Commit the package foundation**

```bash
git add examples/localelens-web/package.json examples/localelens-web/package-lock.json examples/localelens-web/.nvmrc examples/localelens-web/tsconfig.json examples/localelens-web/next.config.ts examples/localelens-web/postcss.config.mjs examples/localelens-web/eslint.config.mjs examples/localelens-web/vitest.config.ts examples/localelens-web/.env.example
git commit -m "chore: add LocaleLens package foundation"
```

### Task 2: Define capture and comparison contracts RED-first

**Files:**
- Create: `examples/localelens-web/src/features/capture/contracts.ts`
- Create: `examples/localelens-web/src/test/contracts.test.ts`
- Create: `examples/localelens-web/src/test/setup.ts`

**Interfaces:**
- Consumes: Zod 4.5.4.
- Produces: `SUPPORTED_COUNTRIES`, `captureRequestSchema`, `pageEvidenceSchema`, `captureResponseSchema`, `reportSchema`, and their inferred TypeScript types.

- [ ] **Step 1: Write failing contract tests**

Cover these exact behaviors:

```ts
expect(captureRequestSchema.parse({ url: "https://example.com", country: "gb" }))
  .toEqual({ url: "https://example.com", country: "gb" })

expect(() => captureRequestSchema.parse({ url: "https://example.com", country: "xx" }))
  .toThrow()

expect(() => captureResponseSchema.parse({
  ok: true,
  evidence: validEvidence,
  receipt: { ...validReceipt, proxyCountry: "us", country: "gb" },
  screenshot: validScreenshot,
})).toThrow()
```

Also assert array caps, ISO timestamps, JPEG media type, safe error-code membership, proxy/request country equality, and absence of an API-key field.

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npm test -- src/test/contracts.test.ts
```

Expected: FAIL because `contracts.ts` does not exist.

- [ ] **Step 3: Implement the minimal schemas and inferred types**

Define the exact unions from the product spec. Implement successful-response refinement so `receipt.country === receipt.proxyCountry`. Cap CTA and currency arrays at 20 and string lengths at the values in the spec.

- [ ] **Step 4: Run focused and type checks**

```bash
npm test -- src/test/contracts.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit contracts**

```bash
git add examples/localelens-web/src/features/capture/contracts.ts examples/localelens-web/src/test/contracts.test.ts examples/localelens-web/src/test/setup.ts
git commit -m "test: define LocaleLens evidence contracts"
```

### Task 3: Add deterministic redacted fixtures

**Files:**
- Create: `examples/localelens-web/src/test/fixtures.ts`
- Create: `examples/localelens-web/src/test/fixtures.test.ts`

**Interfaces:**
- Consumes: contract types from Task 2.
- Produces: `sampleCaptureByCountry` and `sampleReport` for Phase 1 UI and sample-mode E2E.

- [ ] **Step 1: Write a failing fixture validation test**

```ts
expect(reportSchema.parse(sampleReport)).toEqual(sampleReport)
expect(Object.keys(sampleCaptureByCountry)).toEqual(["us", "gb", "de"])
expect(JSON.stringify(sampleReport)).not.toMatch(/slr_live_|sessionId|replayUrl/i)
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npm test -- src/test/fixtures.test.ts
```

Expected: FAIL because fixtures do not exist.

- [ ] **Step 3: Implement fixtures with synthetic content**

Use `https://regional.example.test/pricing` as the requested URL. Use clearly synthetic headings, CTA labels, currencies, and consent text. Do not copy a real company's page text or include a real session ID, replay URL, IP, person, or account.

- [ ] **Step 4: Run focused and full tests**

```bash
npm test -- src/test/fixtures.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit fixtures**

```bash
git add examples/localelens-web/src/test/fixtures.ts examples/localelens-web/src/test/fixtures.test.ts
git commit -m "test: add redacted regional evidence fixtures"
```

### Task 4: Create the minimal valid application shell

**Files:**
- Create: `examples/localelens-web/app/layout.tsx`
- Create: `examples/localelens-web/app/page.tsx`
- Create: `examples/localelens-web/app/globals.css`
- Create: `examples/localelens-web/app/page.test.tsx`

**Interfaces:**
- Consumes: Next App Router.
- Produces: a buildable page explicitly stating that the visual experience starts in Phase 1.

- [ ] **Step 1: Write the failing page test**

```tsx
render(<Page />)
expect(screen.getByRole("heading", { name: "LocaleLens" })).toBeVisible()
expect(screen.getByText("Foundation ready. Visual experience begins in Phase 1.")).toBeVisible()
expect(screen.queryByRole("button", { name: /compare/i })).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npm test -- app/page.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the minimal shell**

Create semantic `html`, `body`, `main`, one `h1`, and the exact Phase 0 copy. Import Tailwind through `@import "tailwindcss";`. Do not add product layout, controls, sample comparison, icons, animation, or visual flourishes.

- [ ] **Step 4: Run all local gates**

```bash
npm test
npm run typecheck
npm run build
```

Expected: PASS with no warning introduced by project code.

- [ ] **Step 5: Commit the buildable shell**

```bash
git add examples/localelens-web/app/layout.tsx examples/localelens-web/app/page.tsx examples/localelens-web/app/globals.css examples/localelens-web/app/page.test.tsx
git commit -m "feat: add buildable LocaleLens foundation"
```

### Task 5: Document and freeze the Phase 0 gate

**Files:**
- Create: `examples/localelens-web/README.md`
- Modify: repository-root `README.md`
- Create: `docs/evidence/localelens-phase-0.md`

**Interfaces:**
- Consumes: completed Phase 0 commands and exact repository SHA.
- Produces: a discoverable cookbook example and a qualified Phase 1 handoff.

- [ ] **Step 1: Write the example README**

Include the problem, Phase 0 status, exact setup commands, dependency boundary, environment-variable names, `0 live calls`, and links to the product spec and execution index. State that the application is not yet a usable submission.

- [ ] **Step 2: Add one root cookbook row**

Add LocaleLens under a composed/web-app examples section without reformatting unrelated rows.

- [ ] **Step 3: Run the terminal verification**

```bash
cd examples/localelens-web
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: all commands pass. Only explicit Phase 0 documentation paths remain unstaged before the final commit.

- [ ] **Step 4: Record evidence honestly**

`docs/evidence/localelens-phase-0.md` must contain:

- predecessor SHA and working branch;
- commands and exit status;
- `live_solari_calls: 0`;
- `visual_design: NOT_STARTED`;
- `browser_evidence: NOT_PROVEN`;
- `hosted_evidence: NOT_PROVEN`;
- `phase_1_authorized: false`.

- [ ] **Step 5: Commit the Phase 0 gate**

```bash
git add README.md examples/localelens-web/README.md docs/evidence/localelens-phase-0.md
git commit -m "docs: record LocaleLens Phase 0 foundation"
```

- [ ] **Step 6: Stop**

Report the branch, predecessor SHA, terminal SHA, checks, untracked files, and the exact statement: `Phase 0 complete; Phase 1 not started.` Do not push unless the owner separately authorizes it.
