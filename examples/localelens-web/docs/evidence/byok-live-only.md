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
| `c5bbf45` | Live-only documentation and credential-free evidence |

The observed pre-live implementation and documentation range is
`ee04744bd44d56e15fce70a7992f15d35b78b275..c5bbf45`.

## Evidence verdicts

| Evidence class | Verdict | Observed result and boundary |
| --- | --- | --- |
| Unit and component | PASS | Baseline: 28 files / 278 tests. Task 4 focused gate: 8 files / 177 tests. Task 5 retained gate: 9 files / 86 tests. Task 6 gate: 6 files / 55 tests. Complete Task 8 gate: 33 files / 346 tests. |
| Route and credential security | PASS | Focused route/store/capture/replay tests passed; bounded strict bodies, custom-header/same-origin checks, cookie lifecycle, owner isolation, invalidation, and no server key fallback are exercised. This is local test evidence. |
| Playwright test double | PASS | 7/7 Chromium journeys passed. The desktop journey recorded one synthetic authentication action, zero captures before compare, exactly three initial captures, zero automatic retries, and one explicit retry. Routes were intercepted only under `e2e/`; no provider SDK call occurred. |
| Production build and bundle | PASS | Node 22 synthetic-canary build passed. Main-route client JavaScript was 153,573 gzip bytes under the 184,320-byte ceiling. Production-boundary scan passed across 115 files; the synthetic canary and credential-bearing server module markers were absent from client output. |
| In-app Browser desktop/mobile | PASS | Credential-free inspection at 1440×900, 640×720, and 360×800 showed the masked field, safe link, blocked comparison, zero sample/evidence surfaces, no horizontal overflow, 3px keyboard focus, 44px mobile journey targets, and zero console errors. No key was entered and no capture started. |
| Live Solari provider | PASS | The owner entered a real key only through the visible masked UI. One authentication request succeeded. One approved comparison of `https://example.com/` created exactly two initial captures: GB and US both completed, with zero failures, zero retries, and no fixture fallback. |
| Solari dashboard | PASS | The visible Sessions table increased from 9 historical rows before capture to 11 after capture, an exact delta of 2. Safe UI evidence correlated GB at 2026-09-03 14:30:08 UTC and US at 2026-09-03 14:30:06 UTC. Active browser sessions returned to 0 after settlement. No provider IDs, profile data, cookie data, headers, or key material are recorded here. |
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

## Owner-authorized live acceptance

- Server URL: `http://127.0.0.1:34126/`
- Listener PID: `54968`; parent Next PID: `54967`
- Working directory:
  `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens/examples/localelens-web`
- Command: normal `next dev --hostname 127.0.0.1 --port 34126`, using Node
  `v22.22.2`, with key, mode, and capture-disable variables absent
- Connection: the owner entered the key only into the visible password field;
  the UI reached **Ready for this session** after exactly `1` authentication
  request
- Approved target: `https://example.com/`
- Approved markets: `GB` — United Kingdom; `US` — United States
- Billable initial captures: exactly `2`; billable retries: `0`
- UI outcome: `2 of 2 settled · Batch 1 of 1`; both countries reached
  **Complete**; the report stated `2 successful · 0 failed`
- Batching: one deterministic two-country batch, below the maximum-three
  concurrency boundary
- Evidence: both countries resolved to `https://example.com/`, language `en`,
  heading `Example Domain`, and primary action `Learn more`; currency and
  consent were honestly unavailable
- Dashboard: Sessions rows changed from `9` to `11`, exactly matching the two
  approved captures; active browser sessions were `0` after settlement
- Replay: the initial bounded availability checks returned pending; no capture
  retry and no extra billable call was made
- Disconnect: visible **Disconnect** returned the password form, removed the
  ready state, and disabled **Compare live through Solari**; a full page reload
  remained disconnected and removed the prior run evidence
- Shutdown: the listener was verified as PID `54968` in the exact working
  directory above, the owning terminal received one interrupt, port `34126`
  had no listener afterward, and PIDs `54967` and `54968` had exited

## Final post-live gate

```text
node --version
PASS — v22.22.2

npm test
PASS — 33 files, 346 tests

npm run typecheck
PASS

npm run lint
PASS

npm run build
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

git diff --check
PASS — no output
```

## Protected and external boundaries

Pre-task protected hashes:

```text
next-env.d.ts  6feb180faa5acaf19451d0f2662b77ff272d3199fac6bec8dff30152e883762b
AGENTS.md      63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb
CLAUDE.md      336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49
.last-run.json 91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903
```

After the final gate, all four hashes matched these exact pre-task values and
the paths remained unstaged. The owner supplied the real key only through the
visible masked UI; it was not requested in chat, displayed, printed, logged,
stored in a file, or committed. No PR, merge, deployment, release,
repository-settings change, or hosted-CI inspection occurred.

## Remaining live-only risks

- The live acceptance covers one public target, two markets, and one
  single-instance development-server lifecycle; broader provider reliability is
  not proven.
- Replay availability remained pending during the bounded initial checks; no
  further polling or capture retry was required for the successful report.
- Production HTTPS behavior is locally designed and built but not hosted or
  deployed.
- The credential store is intentionally process-local and single-instance.
- Browser restore after process restart may preserve an opaque cookie that the
  new process correctly treats as missing.
- Direct assistive-technology behavior remains `NOT PROVEN` despite automated
  Axe and keyboard evidence.

---

## 2026-09-04 replay viewer and comparison-UI follow-up

This addendum records a separate UI and replay-acceptance pass. It does not
replace or revise the 2026-09-03 evidence above.

### Follow-up checkpoint lineage

| Commit | Checkpoint |
| --- | --- |
| `62bd34b0cb7f55f584d17ac17a324bbfefccb202` | Clarify comparison progress, status, and evidence presentation |
| `f8b058921620dd98bbc15a0eade04ade529b44cb` | Add the bounded, owner-isolated in-app replay viewer |
| `7c2bf4c941135f0271dc7aedbbef06bbaa963478` | Cover the visual replay journey and responsive layout |
| `1156175c62fd2c22a772e0f09ec06ef160d43c9d` | Verify truthful in-app replay-data export |

### Follow-up live observation

- Runtime: one normal long-lived Node `v22.22.2` development instance at
  `http://127.0.0.1:34126/`; no owner key was provided through an environment
  variable, file, terminal command, log, screenshot, or chat.
- Authentication: the owner entered the key only through the visible masked
  UI. One owner connection action was observed and the UI reached **Ready for
  this session**. Network-level authentication-request instrumentation was not
  added for this manual pass, so the count is qualified as UI-observed.
- Proposed and approved spend: `https://example.com/`, `GB` — United Kingdom
  and `US` — United States, for exactly `2` initial captures and no retry.
- Actual visible run: the comparison was started once with eight markets still
  selected: `BR`, `ES`, `FR`, `GB`, `IT`, `JP`, `KR`, and `US`. This consumed
  exactly `8` initial billable captures, not the approved two. All eight
  completed in three deterministic batches of at most three. No capture failed,
  no automatic or explicit capture retry occurred, and no second comparison was
  run. The count mismatch is retained as a procedural deviation; it is not
  rewritten as exact-count approval.
- Post-run disposition: after the eight-capture count and deviation were
  disclosed, the owner explicitly accepted this eight-market run as the final
  follow-up evidence and authorized publication. That later acceptance does not
  retroactively replace the original two-capture action-time approval.
- UI outcome: **Comparison complete**, `8 of 8 captures finished`, `8`
  successful and `0` failed. Evidence availability and routing were consistent;
  localization and consent were marked **Needs attention**. Every result was
  live provider evidence for `https://example.com/`; no fixture or sample
  fallback appeared.
- Replay: Brazil reached **Replay ready**. Pressing **Watch replay** once opened
  a large in-app rrweb player with a visible recorded page, timeline, play,
  speed, skip-inactive, fullscreen, close, and developer-data controls. Closing
  the player returned to the expanded results. The other seven replay states
  were pending at the last observation; none was rechecked, no provider retry
  was attempted, and pending replay did not block the completed comparison.
- Developer data: the UI exports the already-loaded replay events as a named
  `.ndjson` file rather than presenting the provider's `.ndjson.gz` transport
  artifact as an end-user archive. The synthetic browser journey verifies that
  this export makes no additional replay-provider request.
- Solari dashboard delta: `NOT PROVEN`. No immediate before-run baseline was
  recorded for this separate follow-up, so the visible eight-result UI is not
  used to infer a dashboard-row delta.
- Disconnect: visible **Disconnect** returned the masked API-key form and
  disabled **Compare live through Solari**.
- Shutdown: the verified process chain was npm PID `53263`, Next CLI PID
  `53274`, and listener PID `53276`, rooted in
  `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens/examples/localelens-web`.
  Only the exact Next CLI PID received `SIGTERM`; all three PIDs exited and
  `127.0.0.1:34126` had no listener afterward.

### Follow-up final credential-free gate

Every qualifying command below used the required Node `v22.22.2` PATH and ran
after the live session was disconnected and its exact server was stopped.

```text
node --version
PASS — v22.22.2

npm test
PASS — 35 files, 356 tests

npm run typecheck
PASS

npm run lint
PASS

npm run build
PASS — production build; no provider call

npm run check:budget
PASS — 155,717 B gzip total; 184,320 B ceiling

npm run check:api-methods
PASS — allowed and guarded capture, replay, and credential-session methods;
TRACE NOT_PROVEN because Node rejected it before the application Proxy

npm run check:production-boundaries
PASS — 121 files scanned

npm run test:e2e
PASS — 7/7 Chromium tests

git diff --check
PASS — no output
```

The four protected-path hashes exactly matched the pre-task hashes recorded in
the historical evidence above. `next-env.d.ts`, `AGENTS.md`, `CLAUDE.md`, and
`test-results/` remained unstaged and were not deleted or overwritten.

### Follow-up boundary verdicts

- Authentication requests: `1` UI-observed owner connection action.
- Billable initial captures: `8`.
- Billable capture retries: `0`.
- Additional comparison runs: `0`.
- Additional replay availability checks after the one successful Brazil viewer
  load: `0`.
- Pull request, merge, deployment, release, repository-settings change, and
  hosted-CI inspection: none.
- Supported credential topology remains one long-lived Node instance. Serverless
  and multi-instance operation remain unsupported and unclaimed.

### Follow-up remaining risks

- The actual eight-market run exceeded the separately stated and approved
  two-capture proposal. The successful provider result is real, but the
  exact-count acceptance condition is procedurally deviated and must not be
  reported as an exact match.
- The dashboard delta for this follow-up is `NOT PROVEN` because there was no
  immediate pre-run baseline.
- Seven replay artifacts remained pending at the last observation. Only the
  Brazil in-app replay path received live visual acceptance.
- Live evidence covers one public target and a single-instance development
  server; hosted HTTPS, serverless, horizontal scaling, and broader provider
  reliability remain unproven.
