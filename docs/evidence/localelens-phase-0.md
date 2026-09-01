# LocaleLens Phase 0 Evidence

## Scope and lineage

- Status: Phase 0 repository foundation complete; Phase 1 not started.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`
- Branch: `codex/localelens-phase-0-foundation`
- Predecessor (`upstream/main` at branch creation):
  `d304843f5ea0edb5c27829bb2ca30868645bef7a`
- Runtime: Node.js `v22.20.0`; npm `11.19.0`
- `live_solari_calls: 0`
- `visual_design: NOT_STARTED`
- `browser_evidence: NOT_PROVEN`
- `hosted_evidence: NOT_PROVEN`
- `phase_1_authorized: false`

The active checkout is a local clone with only the official cookbook configured
as `upstream`. No push, pull request, deployment, publication, or repository
administration occurred. A real GitHub fork remains required before
publication.

## RED-first evidence

Each behavior slice began with its focused failing test:

| Slice | RED observation | GREEN observation |
| --- | --- | --- |
| Capture contracts | `contracts.ts` could not be resolved | Contract suite passed with bounded strict Zod schemas |
| Redacted report | The initial capture-bearing report shape rejected the redacted result shape | Report schema accepted results without receipts, session IDs, or replay URLs |
| Regional fixtures | `fixtures.ts` could not be resolved | US, UK, and Germany fixtures validated deterministically |
| Foundation page | `app/page.tsx` could not be resolved | Heading and exact Phase 0 status copy passed; no compare button existed |

The final Vitest run passed 3 files and 19 tests.

## Terminal verification

All commands ran locally on 2026-09-01. The application commands ran from
`examples/localelens-web/`; Git commands ran from the repository root.

| Command | Result |
| --- | --- |
| `npm test` | PASS (3 files, 19 tests) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS (static `/` and `/_not-found`) |
| `npm ls --depth=0` | PASS; only the 18 exact direct dependencies were listed |
| `git diff --check` | PASS |
| `git status --short --branch` | PASS; only the three explicit Phase 0 documentation paths remained before the evidence commit |

The exact pins expose two upstream compatibility caveats. `jsdom@30.0.1`
declares Node `^22.22.2 || ^24.15.0 || >=26`, above the plan's exact Node
`22.20.0`, and the pinned jsdom/Next dependency chains emit Node experimental
CommonJS-to-ESM loading warnings during test/build. Also,
`eslint-config-next@16.3.4` bundles React lint plugins that still use the ESLint
9 rule API while the plan pins ESLint `10.9.1`; the flat config therefore loads
the compatible Next core-web-vitals and TypeScript rules directly. All required
commands still exited successfully. No package version was substituted and no
unplanned package was added.

## Security and evidence boundaries

- No Solari SDK is installed, no API key was requested or used, and no capture
  or replay API route exists.
- `.env.example` contains names only. No credential value is committed.
- Fixtures are synthetic and deterministic. The sample report contains no
  session ID, replay URL, IP address, person, or account.
- No final interface, visual direction, live regional capture, Browser or
  Computer Use validation, hosted runtime, export flow, analytics,
  authentication, database, or deployment is claimed.
- Browser, provider, hosted, and production behavior remain `NOT PROVEN` until
  their separately authorized phases.
