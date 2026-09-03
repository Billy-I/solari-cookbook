# LocaleLens Live Product Readiness evidence

## Decision

- Local implementation and non-live readiness gate: **PASS**.
- Live UI-only Solari proof: **NOT RUN**. No runtime key was present in the
  shell or a local environment file, so no provider call was attempted.
- Solari capture calls used by this phase: **0**.
- Solari replay calls used by this phase: **0**.
- Dashboard correlation, hosted deployment, submission, and release:
  **NOT PROVEN / NOT AUTHORIZED**.

This phase resolves the misleading demo behavior and implements the local
product-readiness requirements. It does not claim live-provider or release
readiness while the required four-market UI proof is absent.

## Exact lineage

| Item | Exact value |
| --- | --- |
| Branch | `codex/localelens-live-product-readiness` |
| Required published predecessor | `origin/codex/localelens-phase-5-submission` |
| Exact predecessor SHA | `00828fa6509a051a92aca521f5b201946c1172db` |
| Design checkpoint | `12727af4e5781d7b6fed5f56b920051896d2a3ef` |
| Plan checkpoint | `515f2a05037faaeee8e3e85fd24c20caedd4941b` |
| Final implementation and verification checkpoint before this report | `d5e53ed90d0caff1c4d1fa69e9e4ede495822438` |
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
SDK capability. A dedicated dashboard credential label such as
`LocaleLens Production` is recommended for later owner-managed setup; this
phase did not create, reveal, rotate, or rename a credential.

## Non-live verification

All commands ran from `examples/localelens-web/` with the required Node
v22.22.2 runtime, `SOLARI_API_KEY` unset, `NEXT_PUBLIC_APP_MODE=sample`, and
`LIVE_CAPTURE_ENABLED=false`.

| Command | Result |
| --- | --- |
| `node --version` | PASS: `v22.22.2` |
| `npm test` | PASS: 28 files, 277 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run check:api-methods` | PASS for app-reachable cases; `TRACE` remains `NOT_PROVEN` on both API routes because Next rejects it before Proxy |
| `npm run build` | PASS: static `/`; dynamic capture/replay routes; Proxy included |
| `npm run check:budget` | PASS: 153,719 B / 184,320 B main-route gzip |
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
client generator. The rebuilt bundle is 153,719 B; the budget was not raised.

The API-method check initially exposed stale fixture expectations after the
request and failure contracts gained run correlation. The checker now sends a
valid correlated request and expects the safe `correlation: null` failure
shape. The final check passes.

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

Screenshots are visual evidence of those exact local sample states. They do
not prove a Solari call, other browsers, assistive technology, hosting, or a
release.

## Security and public-bundle inspection

- The focused source scan found only server-side `sessionId` handling,
  synthetic test fixtures, unit-test key assignments, restoration of prior
  environment state, and a historical documentation reference.
- It found no `NEXT_PUBLIC_*SOLARI` assignment and no realistic `sk-` value.
- The fresh `.next/static` public-bundle scan found zero occurrences of
  `SOLARI_API_KEY`, `raw-provider-session-id`, or `sessionId`.
- Raw provider IDs remain server-only; public response and export tests assert
  that the synthetic raw ID is absent.
- Existing HTTPS, SSRF, DNS, redirect, final-URL, response-size,
  screenshot-size, timeout, and export bounds remain covered by the full test
  suite.

## Live UI-only proof

Status: **NOT RUN**.

The shell had no non-empty runtime key, the only local environment file was
the placeholder `.env.example`, and a redacted macOS Security.framework query
found zero generic-password items whose value matched the known Solari key
prefixes. No credential value or Keychain metadata was printed. The provider
gate therefore stopped closed.
Exact live usage in this phase is zero capture calls and zero replay calls.
There is no new app run ID, provider session set, dashboard count change, or
dashboard correlation to report.

If a later owner-authorized run supplies a runtime-only credential, the exact
planned budget is one visible UI comparison of `https://example.com/` in US,
GB, DE, and FR: four initial capture calls total, deterministic batches of
three then one, and zero retries. A blocked or failed target must stop the run;
a retry or fifth call requires separate authorization. Dashboard Browser count
and one-to-one session correlation must be observed before either can be
reported as proved. Replay readiness remains pending until actually tested.

## Evidence boundaries and remaining risk

| Evidence class | Status | Boundary |
| --- | --- | --- |
| Unit/component/route | PASS | Deterministic local behavior only |
| Sample E2E | PASS | Fixture-backed UI; zero provider calls |
| In-app Browser | PASS | Inspected local sample states only |
| Computer Use | NOT USED | No additional native proof needed |
| Live Solari | NOT RUN | Runtime key absent; zero calls |
| Solari dashboard | NOT VISIBLE / NOT PROVEN | No live run to correlate |
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

## Worktree boundary

The protected untracked `AGENTS.md` and `CLAUDE.md` were preserved with
SHA-256 values `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb`
and `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49`.
Generated `next-env.d.ts` and `test-results/` remain unstaged. They are not part
of the candidate. No unrelated local file was staged or deleted.

See [`manual-acceptance.md`](manual-acceptance.md) for the owner-run workflow.
