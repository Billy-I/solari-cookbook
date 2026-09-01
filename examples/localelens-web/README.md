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

Phase 1 installs no Solari SDK, uses no API key, and makes **0 live Solari
calls**. Its working journey is deterministic sample mode only.

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

## Phase 1 status

The repository currently contains:

- the owner-selected Direction A visual system;
- an accessible HTTPS and two-to-three-market run form;
- deterministic staged sample progress, partial failure, and per-market retry;
- coherent synthetic US, UK, and Germany screenshots;
- regional evidence and a semantic difference table;
- visibly disabled Phase 3 export controls; and
- RED-first component, reducer, contract, and fixture coverage.

This is the smallest usable sample-mode visual shell. It proves the local
journey and presentation, not Solari integration or hosted behavior.

## Local setup

From the cookbook repository root:

```bash
cd examples/localelens-web
nvm install
nvm use
node --version
npm install
```

The repository's `.nvmrc` expects `v22.20.0`. Phase 1 verification used the
available compatible Node `v22.22.2`, which also satisfies the pinned jsdom
engine requirement. Application and dependency versions remain pinned exactly
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

Phase 1 does not include capture or replay API routes, the Solari SDK, live
browser orchestration, real replay, exports, authentication, persistence,
analytics, deployment, or publication. Those items require their named later
phase and separate authorization.

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
[Phase 1 implementation
plan](../../docs/superpowers/plans/2026-09-01-localelens-phase-1-visual-shell.md),
[selected visual direction](../../docs/design/localelens-visual-direction.md),
and [Phase 1 evidence](../../docs/evidence/localelens-phase-1.md).
