# LocaleLens user-owned Solari keys — live-only evidence

Date: 2026-09-03

Branch: `codex/localelens-byok-live-only`

Required start: `ee04744bd44d56e15fce70a7992f15d35b78b275`

Required ancestor: `bfe73564786ba7d1a65f43d595e83d7a26530ebf`

This report keeps synthetic, Browser, provider, dashboard, hosted, and direct
assistive-technology evidence separate. A pass in one row does not close a
different row.

## Implemented checkpoint lineage

| Commit | Checkpoint |
| --- | --- |
| `ca99dce` | Ephemeral in-memory credential sessions |
| `66747aa` | Solari connection route lifecycle |
| `71ddee3` | Owner-isolated run-session references |
| `d4f76cc` | User-credential capture and replay authorization |
| `38853e0` | Live-only runtime, presentation, and schema-v3 export |
| `f9131c9` | Session-only visible Solari connection UI |
| `d083e1e` | Live-only Playwright double and production boundaries |
| `e67b636` | Next production Host/origin validation for local and HTTPS requests |

The current observed implementation range before this documentation checkpoint
is `ee04744bd44d56e15fce70a7992f15d35b78b275..e67b636`.

## Evidence verdicts

| Evidence class | Verdict | Observed result and boundary |
| --- | --- | --- |
| Unit and component | PASS | Baseline: 28 files / 278 tests. Task 4 focused gate: 8 files / 177 tests. Task 5 retained gate: 9 files / 86 tests. Task 6 gate: 6 files / 55 tests. Complete Task 8 gate: 33 files / 346 tests. |
| Route and credential security | PASS | Focused route/store/capture/replay tests passed; bounded strict bodies, custom-header/same-origin checks, cookie lifecycle, owner isolation, invalidation, and no server key fallback are exercised. This is local test evidence. |
| Playwright test double | PASS | 7/7 Chromium journeys passed. The desktop journey recorded one synthetic authentication action, zero captures before compare, exactly three initial captures, zero automatic retries, and one explicit retry. Routes were intercepted only under `e2e/`; no provider SDK call occurred. |
| Production build and bundle | PASS | Node 22 synthetic-canary build passed. Main-route client JavaScript was 153,573 gzip bytes under the 184,320-byte ceiling. Production-boundary scan passed across 115 files; the synthetic canary and credential-bearing server module markers were absent from client output. |
| In-app Browser desktop/mobile | PASS | Credential-free inspection at 1440×900, 640×720, and 360×800 showed the masked field, safe link, blocked comparison, zero sample/evidence surfaces, no horizontal overflow, 3px keyboard focus, 44px mobile journey targets, and zero console errors. No key was entered and no capture started. |
| Live Solari provider | NOT RUN | No real key was entered, no live authentication was attempted, and no billable capture was started during Tasks 1–8. |
| Solari dashboard | NOT RUN | No live provider session exists to correlate. |
| Hosted deployment | NOT RUN | No deployment, release, PR, merge, or hosted-CI inspection is authorized or performed. |
| Assistive technology | NOT PROVEN | Axe, keyboard focus, reduced-motion, and target-size browser tests passed; direct VoiceOver or other assistive-technology output was not run. |

## Credential-free commands observed before the complete gate

```text
PATH=...node/v22.22.2... npm test -- [Task 4 focused files]
PASS — 8 files, 177 tests

PATH=...node/v22.22.2... npm test -- [Task 5 retained files]
PASS — 9 files, 86 tests

PATH=...node/v22.22.2... npm test -- [Task 6 focused files]
PASS — 6 files, 55 tests

PATH=...node/v22.22.2... npm run typecheck
PASS

PATH=...node/v22.22.2... npm run lint
PASS

PATH=...node/v22.22.2... SOLARI_API_KEY=synthetic-secret-build-canary npm run build
PASS — routes /, /api/captures, /api/replays/[id], /api/solari-session built

PATH=...node/v22.22.2... npm run check:budget
PASS — 153,573 B gzip total; 184,320 B ceiling

PATH=...node/v22.22.2... npm run check:production-boundaries
PASS — 115 files scanned

PATH=...node/v22.22.2... npm run test:e2e
PASS — 7 tests
```

## Complete Task 8 credential-free gate

```text
node --version
PASS — v22.22.2

npm test
PASS — 33 files, 346 tests

npm run typecheck
PASS

npm run lint
PASS

SOLARI_API_KEY=synthetic-secret-build-canary npm run build
PASS — production build; no provider call

npm run check:budget
PASS — 153,573 B gzip total; 184,320 B ceiling

npm run check:api-methods
PASS — allowed/guarded capture, replay, and credential-session methods;
TRACE NOT_PROVEN because Node rejected it before the application Proxy

npm run check:production-boundaries
PASS — 115 files scanned

npm run test:e2e
PASS — 7/7 Chromium tests

runtime sample/fallback source scan
PASS — no matches

synthetic canary server/static scan
PASS — no matches

client credential-module marker scan
PASS — no matches

git diff --check bfe73564786ba7d1a65f43d595e83d7a26530ebf..HEAD
PASS — no output
```

The first complete-gate attempt stopped at the method checker because Next's
production server canonicalized `request.url` to `localhost` while preserving
the incoming `Host`. RED tests were added, origin reconstruction was corrected
without relaxing host equality, and the entire gate above was then re-run from
the beginning. The focused regression gate passed 4 files / 91 tests.

## Credential-free in-app Browser inspection

- Server URL: `http://127.0.0.1:34125/`
- Listener PID: `53448`; parent Next PID: `53447`
- Working directory:
  `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens/examples/localelens-web`
- Command: normal `next dev --hostname 127.0.0.1 --port 34125`, with key,
  mode, and capture-disable variables absent
- 1440×900: no overflow, no sample/demo text, zero evidence sections,
  password input, safe console link, and disabled comparison
- 640×720: same assertions passed with single-column reflow
- 360×800: same assertions passed; key, connect, country-option, and compare
  journey targets measured at a minimum of 44 CSS pixels
- Keyboard: focused password input showed a solid 3px signal-color outline
- Console: zero errors
- Authentication requests: `0`; billable captures: `0`; retries: `0`
- Shutdown: the Browser tab was closed, viewport override reset, the exact
  terminal server was stopped, port 34125 had no listener, and both recorded
  PIDs had exited

## Call counts before live acceptance

- Real authentication requests: `0`
- Billable Solari captures: `0`
- Billable capture retries: `0`
- Synthetic Playwright desktop journey: `1` authentication action, `3`
  initial captures, `0` automatic retries, `1` explicit retry

## Protected and external boundaries

Pre-task protected hashes:

```text
next-env.d.ts  6feb180faa5acaf19451d0f2662b77ff272d3199fac6bec8dff30152e883762b
AGENTS.md      63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb
CLAUDE.md      336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49
.last-run.json 91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903
```

After Browser inspection, all four hashes match these exact pre-task values.
The paths remain unstaged. No real API key has been requested, displayed, printed, logged,
stored in a file, or committed. No PR, merge, deployment, release,
repository-settings change, or hosted-CI inspection occurred.

## Remaining live-only risks

- Live provider, dashboard correlation, and disconnect cascade against a real
  session remain `NOT RUN` until explicit owner participation. Credential-free
  exact-process shutdown passed.
- Production HTTPS behavior is locally designed and built but not hosted or
  deployed.
- The credential store is intentionally process-local and single-instance.
- Browser restore after process restart may preserve an opaque cookie that the
  new process correctly treats as missing.
- Direct assistive-technology behavior remains `NOT PROVEN` despite automated
  Axe and keyboard evidence.
