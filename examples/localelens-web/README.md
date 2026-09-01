# LocaleLens

LocaleLens is a planned regional web-experience comparison tool for product
designers, growth teams, localization leads, and QA engineers. It addresses a
simple launch problem: the same public page can redirect, price, translate,
gate, or request consent differently depending on the visitor's market, while
manual VPN checks are slow and difficult to review.

## Why Solari

Later phases will use Solari cloud browsers to open one public HTTPS page from
two or three selected countries, capture rendered evidence and screenshots, and
provide temporary recording-backed replay receipts. That makes the regional
claim reviewable instead of relying on an assumed proxy location.

Phase 0 installs no Solari SDK, uses no API key, and makes **0 live Solari
calls**.

## Planned architecture

The planned flow is deliberately small:

1. A Next.js client will send one independent request per selected country.
2. A server-only route will validate the public HTTPS target before launching a
   recorded regional Solari browser.
3. Pure Zod contracts will bound and validate the returned page evidence.
4. The client will compare successful results deterministically and keep
   partial failures visible.

There is no database, account system, queue, background worker, analytics
pipeline, or model provider.

## Phase 0 status

The repository currently contains:

- an exact Node and npm package foundation;
- strict TypeScript, Next.js, Tailwind CSS, ESLint, and Vitest configuration;
- Zod request, evidence, capture-response, and redacted report contracts;
- deterministic synthetic US, UK, and Germany fixtures;
- RED-first contract, fixture, and foundation-page tests; and
- a minimal status page stating that visual work begins in Phase 1.

This is a buildable foundation, not yet a usable challenge submission.

## Local setup

From the cookbook repository root:

```bash
cd examples/localelens-web
nvm install
nvm use
node --version
npm install
```

The expected Node version is exactly `v22.20.0`. Phase 0 evidence was generated
with npm `11.19.0`; the application and dependency versions are pinned exactly
in `package.json` and `package-lock.json`.

## Verification

Run from `examples/localelens-web/`:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm ls --depth=0
```

Run repository checks from the cookbook root:

```bash
git diff --check
git status --short --branch
```

## Deliberately not implemented

Phase 0 does not include the final interface, visual design, capture or replay
API routes, the Solari SDK, live browser orchestration, comparison UI, exports,
authentication, persistence, analytics, deployment, or publication. Those
items require their named later phase and separate authorization.

## Security and privacy

- Live credentials will remain in a server-only `SOLARI_API_KEY`; they must
  never use a `NEXT_PUBLIC_` name or enter source, logs, reports, screenshots,
  or build output.
- Live capture will remain disabled by default behind
  `LIVE_CAPTURE_ENABLED=false`.
- Only public HTTPS targets are in scope; private-network and redirect
  validation is planned before any provider call.
- Captured page content will be treated as untrusted text, never rendered as
  HTML.
- Committed fixtures are synthetic and deterministic. The redacted sample
  report contains no API key, session ID, replay URL, IP address, person, or
  account.
- There is no server persistence in the planned MVP.

See the [execution index](../../docs/EXECUTION_INDEX.md), [approved product and
system design](../../docs/superpowers/specs/2026-09-01-localelens-design.md),
and [Phase 0 implementation
plan](../../docs/superpowers/plans/2026-09-01-localelens-phase-0-foundation.md).
