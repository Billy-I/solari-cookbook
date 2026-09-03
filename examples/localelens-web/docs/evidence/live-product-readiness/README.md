# LocaleLens Live Product Readiness evidence

## Decision

- Local implementation and non-live readiness gate: **PASS**.
- Live UI-only Solari proof: **RUN; TERMINAL PARTIAL / NOT PASSED**. The one
  authorized four-market UI run settled with a Solari authentication failure
  for every market and created no dashboard Browser session.
- Solari capture calls used by this phase: **4 initial attempts** (one each for
  DE, FR, GB, and US); no retry was made.
- Solari replay calls used by this phase: **0**.
- Dashboard count check: **OBSERVED, 9 before and 9 after**. Per-country
  dashboard correlation, hosted deployment, submission, and release remain
  **NOT PROVEN / NOT AUTHORIZED**.

This phase resolves the misleading demo behavior and implements the local
product-readiness requirements. It does not claim live-provider or release
readiness because the required four-market UI proof ended at provider
authentication and produced no correlatable Solari session.

## Exact lineage

| Item | Exact value |
| --- | --- |
| Branch | `codex/localelens-live-product-readiness` |
| Required published predecessor | `origin/codex/localelens-phase-5-submission` |
| Exact predecessor SHA | `00828fa6509a051a92aca521f5b201946c1172db` |
| Design checkpoint | `12727af4e5781d7b6fed5f56b920051896d2a3ef` |
| Plan checkpoint | `515f2a05037faaeee8e3e85fd24c20caedd4941b` |
| Exact pre-live evidence HEAD | `e7ae8e7356cd9edb99cca87b8bb0ccae0306b856` |
| Terminal evidence commit | Resolved by Git after commit and reported externally; a commit cannot embed its own SHA. |

The branch was created from the exact required predecessor. No push, pull
request, deployment, publication, submission, or release was performed.

## Product changes proved locally

| Requirement | Implemented behavior | Local proof |
| --- | --- | --- |
| Runtime truth | Demo mode is a fixed US/GB/DE featured target and states `Demo data — this URL will not be visited.` Live mode states `Live through Solari.` | Component tests and sample E2E |
| More than three markets | Up to 15 verified catalogue entries may be selected; captures run in deterministic batches with at most three active transports | Limits and orchestration tests |
| Authoritative catalogue | The explicit catalogue is limited to SDK-proved residential proxy codes: AU, BR, CA, DE, ES, FR, GB, IN, IT, JP, KR, MX, NL, SG, and US | Contract/catalogue tests |
| Progress and cancellation | The UI reports selected, queued, running, completed, failed, batch, and total-batch state; cancellation prevents later batches and stale completions | Reducer, hook, orchestration, and E2E tests |
| Decision-first results | Availability, routing, localization, and consent signals precede expandable screenshots and normalized fields | Comparison/component/E2E tests and Browser evidence |
| Partial success | Comparisons among two successful markets remain available when a sibling fails | `compare-evidence` and result-component tests |
| Failure and retry | Validation, target, Solari auth/capacity/launch, proxy mismatch, navigation, timeout, extraction, and fallback failures are safe and user-readable; retry is explicit and country-scoped | Safe-error, route, orchestration, and component tests |
| Safe attribution | Every UI run gets an `llr_` run ID. Raw provider session IDs remain in a bounded one-hour server registry; the UI receives only a non-reversible `sol_` reference | Contract, registry, route, replay, and export tests |
| Safe export | JSON schema v2 includes safe run/country/attempt correlation and omits raw session IDs, replay URLs, screenshots, query strings, fragments, and secrets | Export tests and E2E download/print checks |

The installed SDK exposed no proved safe metadata/profile field for attaching
the application run ID to a provider session. The implementation therefore
uses app-owned correlation and server-side mapping rather than inventing an
SDK capability. The owner-created Keychain item used for the live attempt has service
`com.localelens.solari` and account `LocaleLens Production`. A
Security.framework wrapper retrieved its non-empty value and injected it only
into the Node v22.22.2 server process. This phase did not create, reveal,
print, rotate, rename, or replace the credential.

## Non-live verification

All commands ran from `examples/localelens-web/` with the required Node
v22.22.2 runtime, `SOLARI_API_KEY` unset, `NEXT_PUBLIC_APP_MODE=sample`, and
`LIVE_CAPTURE_ENABLED=false`.

| Command | Result |
| --- | --- |
| `node --version` | PASS: `v22.22.2` |
| `npm test` | PASS: 28 files, 278 tests |
| `npm test -- --maxWorkers=1` | PASS: 28 files, 278 tests in the final deterministic rerun |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run check:api-methods` | PASS for app-reachable cases; `TRACE` remains `NOT_PROVEN` on both API routes because Next rejects it before Proxy |
| `npm run build` | PASS: static `/`; dynamic capture/replay routes; Proxy included |
| `npm run check:budget` | PASS: 153,738 B / 184,320 B main-route gzip |
| `npm run test:e2e:sample` | PASS: 7/7 Chromium tests |
| `git diff --check` | PASS |
| Impeccable v4.1.3 detector, exactly once on the final UI files | PASS: `[]` (no findings) |

The sample E2E suite records requests before navigation and asserts zero
requests to `/api/captures` and `/api/replays` in its desktop, accessibility,
and 360 CSS-pixel paths. It also proves the fixed demo target, decision-first
DOM order, completed receipt and run ID, JSON/print actions, zero horizontal
overflow, no captured console errors, automated axe checks, keyboard order,
visible focus, 44 by 44 CSS-pixel coarse-pointer targets, reduced motion, and
640/360 reflow.

The production client budget initially failed at 239,381 B because the run-ID
generator imported Zod into the client. The final implementation keeps schema
validation in the server contract and uses a dependency-free, fail-closed
client generator. The rebuilt bundle is 153,738 B; the budget was not raised.

The API-method check initially exposed stale fixture expectations after the
request and failure contracts gained run correlation. The checker now sends a
valid correlated request and expects the safe `correlation: null` failure
shape. The final check passes.

The final verification rerun repeated all tabled checks under Node v22.22.2.
Its first sample-E2E start attempt failed before any test could load the app
because the live server still owned Next's `.next-e2e` development lock; all
seven tests received connection refused from the unstarted sample server. The
exact port-4323 LocaleLens listener and its confirmed parent chain were stopped,
then the unchanged sample suite passed 7/7. This was an environment collision,
not a passing test run or a product failure, and the failed attempt is retained
here rather than hidden.

Two later standard parallel `npm test` verification attempts each recorded a
single 5-second timeout in the deterministic extraction-budget test (277/278
passed). Between them, the exact test passed alone in 399 ms and the unchanged
standard full 28-file suite passed 278/278. A final full single-worker run also
passed 278/278. No product or test code was changed in response: the evidence
identifies a parallel-load timing flake on this host and uses the complete
single-worker run as the deterministic final gate without erasing either failed
attempt.

## Browser evidence

Fresh in-app Browser checks used the local sample server only. No Computer Use
evidence was needed because native interaction would not add proof beyond the
Browser and E2E checks.

| Evidence | Result |
| --- | --- |
| 1440 by 900 completed comparison | PASS: complete 3/3 receipt, visible `llr_` run ID, decision summary before disclosures, exports enabled, 0 px document overflow |
| 360 by 800 completed comparison | PASS: 0 px document overflow and compact decision content visible |
| Keyboard focus | PASS: 3 px solid visible focus outline captured on the `How it works` summary |
| Browser console | No error was observed during the recorded paths; E2E separately asserts zero captured console errors |

| Screenshot | SHA-256 |
| --- | --- |
| `sample-desktop-1440.jpg` | `44aa9bb3a7520498ea02698973834dd9a43ba08462a040a9cb44284861c47609` |
| `sample-mobile-360.jpg` | `8e18f311907b6b925e5ab2a95f62cd35db6a89d497fde31938d32c52520c4ce7` |
| `sample-keyboard-focus-1440.jpg` | `e4a5dd6dcbad4e47b99df4ab018fdb77cd909b7bf57733eed7a904fac14ec737` |

Screenshots are visual evidence of those exact local states. The sample images
do not prove a Solari call, other browsers, assistive technology, hosting, or
a release. The live image below proves only the rendered terminal app state;
dashboard evidence is recorded separately.

| Live screenshot | SHA-256 |
| --- | --- |
| `live-partial-auth-failure.png` | `7172a5031e53a0ddd4ce9ca54a35eebb25f4d78db3d3fd57dc0ca98b48d8e241` |

## Security and public-bundle inspection

- The focused source scan found only server-side `sessionId` handling,
  synthetic test fixtures, unit-test key assignments, restoration of prior
  environment state, and a historical documentation reference.
- It found no `NEXT_PUBLIC_*SOLARI` assignment and no realistic `sk-` value.
- The fresh `.next/static` public-bundle scan found zero occurrences of
  `SOLARI_API_KEY`, `raw-provider-session-id`, or `sessionId`.
- The live screenshot's string scan found zero credential, raw-session, or
  realistic key patterns, and visual inspection showed only the safe `llr_`
  application run ID.
- Raw provider IDs remain server-only; public response and export tests assert
  that the synthetic raw ID is absent.
- Existing HTTPS, SSRF, DNS, redirect, final-URL, response-size,
  screenshot-size, timeout, and export bounds remain covered by the full test
  suite.

## Live UI-only proof

Status: **RUN; TERMINAL PARTIAL / NOT PASSED**.

The in-app Browser performed exactly one visible comparison action against
`https://example.com/`. Immediately before that click, the form showed
`Live through Solari.`, the pending export helper said
`Run a live comparison to create an exportable receipt.`, and exactly DE, FR,
GB, and US were selected.

| Item | Observed evidence |
| --- | --- |
| Fresh dashboard baseline | 9 Browser sessions at `2026-09-03T11:45:08.522Z` |
| Application run ID | `llr_eed03547-504d-438e-a37d-994f543ea30c` |
| Initial batching | Batch 1 of 2 launched DE, FR, and GB while US remained queued |
| Terminal progress | 4 of 4 settled; Batch 2 of 2; status `partial` |
| DE | Failed — `Solari authentication is unavailable.` |
| FR | Failed — `Solari authentication is unavailable.` |
| GB | Failed — `Solari authentication is unavailable.` |
| US | Failed — `Solari authentication is unavailable.` |
| Post-run dashboard | 9 Browser sessions at `2026-09-03T11:46:08.802Z`; delta 0 |
| Safe `sol_` references | None; no new dashboard session existed to hash or correlate |
| Retry / replay | 0 retries; 0 replay calls |

The UI produced four terminal country outcomes from the four initial capture
attempts. No automatic retry was observed, and the live action was not clicked
again. Because provider authentication failed before any new dashboard Browser
session appeared, no country-to-session mapping or replay readiness can be
claimed. The specific reason the provider rejected the injected credential is
not proven by this run; the UI's safe authentication category is the available
evidence. A retry or fifth call requires separate owner authorization.

## Evidence boundaries and remaining risk

| Evidence class | Status | Boundary |
| --- | --- | --- |
| Unit/component/route | PASS / PARALLEL TIMING FLAKE | All 278 pass in the full single-worker gate; two default-parallel attempts timed out in the same budget test |
| Sample E2E | PASS | Fixture-backed UI; zero provider calls |
| In-app Browser | PASS / PARTIAL | Sample states passed; the live run reached a truthful terminal partial state |
| Computer Use | NOT USED | No additional native proof needed |
| Live Solari | FAILED AT AUTHENTICATION | Four initial attempts; zero retry; no session created |
| Solari dashboard | OBSERVED / CORRELATION NOT PROVEN | Browser sessions stayed 9 to 9; no new raw ID or safe reference existed |
| Replay | PENDING / NOT PROVEN | No live session tested |
| Deployment | NOT TESTED | No deploy authorized |
| Release/submission | NOT AUTHORIZED | No push, PR, publish, submit, or release |

Public HTTPS support remains target-dependent. Authentication, CAPTCHA,
automation blocking, and provider availability can still cause honest live
failures. The product does not promise compatibility with every website.

## Local commits

1. `12727af4e5781d7b6fed5f56b920051896d2a3ef` — design the successor phase.
2. `515f2a05037faaeee8e3e85fd24c20caedd4941b` — record the RED-first plan.
3. `3cddbfaea65eb420cc73237f6d78b5767b555246` — establish contracts and catalogue.
4. `b4ffb0a0c1efd5334ba5a9267bf1754df2e74b7a` — implement deterministic batching.
5. `a11860811c7d993276aaf94d377504441110261b` — add safe session correlation.
6. `686d052a30c79b35174e37032ce3484332455b80` — report lifecycle failures.
7. `0b17429a29af7da9f2a77f47ce9f11f7d63ffb33` — clarify demo and live modes.
8. `1b6c24ccbc6d017608c15f6a4d33577f2d2ed644` — prioritize resilient decisions.
9. `8c5c64e449c10bc6f60e533b78b0c05c8f16c3fd` — export safe run provenance.
10. `d5e53ed90d0caff1c4d1fa69e9e4ede495822438` — prove the final local gates.
11. `4c4c5a5040cf5aec36af606ee8699d912b4c4a13` — record the non-live readiness evidence.
12. `1c4bdad983e6c0f99f426899b731b3975418271c` — qualify the then-absent runtime credential.
13. `6d3f1dcca41ab9a28b807ebc8c7efa82ecba6539` — describe pending live exports honestly.
14. `e7ae8e7356cd9edb99cca87b8bb0ccae0306b856` — keep pending live export guidance truthful.

## Worktree boundary

The protected untracked `AGENTS.md` and `CLAUDE.md` were preserved with
SHA-256 values `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb`
and `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49`.
Generated `next-env.d.ts` and `test-results/` remain unstaged. They are not part
of the candidate. No unrelated local file was staged or deleted.

See [`manual-acceptance.md`](manual-acceptance.md) for the owner-run workflow.
