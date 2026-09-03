# LocaleLens Live Product Readiness Design

**Status:** Approved for local implementation

**Date:** 2026-09-03

**Base:** `origin/codex/localelens-phase-5-submission` at `00828fa6509a051a92aca521f5b201946c1172db`

**Branch:** `codex/localelens-live-product-readiness`

**Audience:** Product reviewers, implementation agents, and evidence reviewers

**Implementation boundary:** Local implementation, verification, evidence, and local commits are authorized. Push, pull request, deployment, publication, submission, and release are not authorized.

## 1. Product decision

LocaleLens will become an unambiguous, decision-first regional comparison tool while preserving its evidence-first security and cost controls. Demo evidence and live Solari evidence must be visually and behaviorally distinct. A user may compare every country supported by Solari residential proxies, but LocaleLens launches at most three provider sessions concurrently and never retries a provider call without an explicit country-scoped user action.

### Product promise

> See what changed across markets, inspect the proof, and know exactly which evidence is live.

### Success criteria

A first-time user can:

1. Distinguish fixed demo evidence from a live Solari run before taking an action.
2. Select between two and fifteen supported countries for a live run.
3. See deterministic batches of at most three concurrent captures, including queued, running, complete, and failed states.
4. Cancel the active run without allowing late responses to overwrite newer state.
5. Read a concise, deterministic “What changed” summary before opening detailed screenshots and field comparisons.
6. Retain useful comparisons between successful countries when another country fails.
7. Retry one failed country explicitly without rerunning successful countries.
8. Correlate UI evidence to Solari safely using a run ID and non-reversible session reference, without exposing a raw provider session ID.
9. Export redacted JSON and HTML reports that preserve provenance and omit secrets and raw provider session IDs.

The implementation is complete only when all non-live gates pass. A live proof may then use the UI only, with exactly four selected markets and at most four initial provider captures total. It performs no retry unless the owner gives separate approval after reviewing the initial outcome.

## 2. Approaches considered

### Selected: client-orchestrated deterministic batches

The existing comparison hook remains the run orchestrator. It splits the ordered country selection into batches of three, runs countries within one batch concurrently, and starts the next batch only after the current batch settles. This reuses the existing cancellation, stale-response, and per-country result boundaries while making progress and spend understandable.

### Rejected: persistent server-side job queue

A job queue would support background work and reconnection, but LocaleLens has no account, database, or background-job requirement. Adding persistence, polling, ownership, and cleanup would expand the product and trust surface without improving the requested local flow.

### Rejected: unstructured semaphore fan-out

A semaphore could cap concurrency at three, but it would not give users stable batch boundaries or a deterministic “batch X of Y” explanation. Ordered batches are simpler to test, explain, cancel, and audit.

## 3. Provenance modes

### Fixed demo mode

- The interface says exactly: **“Demo data — this URL will not be visited.”**
- The demo target is fixed to `regional.example.test`.
- Demo countries are fixed to United States, United Kingdom, and Germany because those are the committed fixtures.
- The live URL field and market selector are not presented as editable inputs for a demo run.
- Demo runs make zero calls to the capture route and zero calls to Solari.
- Every receipt, result, replay state, and export identifies the evidence as sample evidence.

### Live mode

- The interface says exactly: **“Live through Solari.”**
- The user enters one public HTTPS URL and selects two to fifteen supported countries.
- The action is labelled as the next live run before provider work begins.
- Every live receipt, result, and export identifies the evidence as live Solari evidence.
- Existing URL validation, SSRF controls, proxy receipt requirements, recording controls, and cleanup guarantees remain mandatory.

Sample evidence may remain visible as a clearly labelled preview before the first live run. It must not appear to be the result of the live form.

## 4. Authoritative market catalogue

LocaleLens will centralize country code, name, and display data in `countries.ts`. The catalogue matches the fifteen countries documented for Solari residential proxies at [Solari proxy documentation](https://docs.getsolari.com/proxies):

| Code | Country | Code | Country | Code | Country |
| --- | --- | --- | --- | --- | --- |
| `au` | Australia | `br` | Brazil | `ca` | Canada |
| `de` | Germany | `es` | Spain | `fr` | France |
| `gb` | United Kingdom | `in` | India | `it` | Italy |
| `jp` | Japan | `kr` | South Korea | `mx` | Mexico |
| `nl` | Netherlands | `sg` | Singapore | `us` | United States |

This static catalogue is authoritative for the release. LocaleLens will not spend a provider request to populate a selector. The existing six-country subset and duplicated country-name maps will be replaced by the centralized catalogue.

## 5. Run orchestration and state

### Run identity

Every comparison receives one app-owned run ID before any capture begins. The run ID uses a strict, bounded format and contains no user input or provider data. All initial country captures and explicit retries for that comparison retain the same run ID.

The UI sends `runId` with each live capture request. The server validates it before provider work. Sample runs receive the same app-level identity for consistent receipts and exports but never enter the provider registry.

### Bounded batching

- Minimum selected countries: 2.
- Maximum selected countries: 15.
- Maximum concurrent live captures: 3.
- Selection order determines batch order.
- All countries begin as queued.
- One batch of up to three countries becomes running at a time.
- A later batch starts only after every country in the current batch completes or fails.
- Settled results are emitted immediately so useful evidence appears before the entire run finishes.

Progress exposes selected, queued, running, complete, and failed counts plus `batch X of Y`. The interface provides a visible Cancel action while work is active.

### Cancellation and stale responses

Cancellation aborts active requests, prevents later batches from starting, and marks unfinished work as cancelled without discarding already settled results. A replacement run invalidates the previous operation generation. Late responses from a cancelled or replaced operation cannot mutate current state.

## 6. Safe Solari attribution

The installed `@solarisdk/browser` API does not provide a supported metadata or run-label field. LocaleLens must not overload profile or proxy options to simulate one.

Instead, the capture boundary reports the raw provider session ID to a server-only registration callback immediately after launch. A bounded in-memory registry stores:

```text
runId + country + attempt -> raw Solari session ID + safe session reference + timestamps
```

The registry is process-local, has a one-hour time-to-live, and retains at most 100 recent runs. Old entries are removed on read and write. It is evidence-assistance state, not a durable source of truth.

The safe session reference is derived by SHA-256 hashing the raw provider session ID and exposing only a short prefixed digest. It is non-secret and useful for manual dashboard correlation. The replay route accepts app-owned correlation fields and resolves the raw provider session ID through the server registry. The raw session ID:

- remains server-side, including during replay lookup;
- is never logged;
- is never rendered as text;
- is never included in JSON or HTML export;
- is never included in an error message or screenshot filename.

Structured server logs may include only the app run ID, country, attempt, safe session reference, request ID, and non-sensitive lifecycle category. Receipts and exports may include the app run ID and safe session reference.

## 7. Failure, retry, and lifecycle truth

User-facing failures remain country-scoped and map to the boundary that failed:

- input or unsupported-market validation;
- private or blocked target validation;
- provider authentication;
- provider capacity;
- provider proxy mismatch;
- browser launch;
- navigation timeout or navigation failure;
- extraction failure;
- capture failure;
- cancellation.

Messages explain the next safe action without exposing provider internals, URLs containing sensitive query material, stack traces, or session-control data.

There is no automatic provider retry. A failed country exposes one explicit Retry action. Retrying it preserves successful countries, uses the same run ID, increments the country attempt, and consumes one provider call. If a retry is in progress, it is cancellable and still obeys the three-session concurrency ceiling.

## 8. Decision-first results

The result hierarchy is:

1. provenance and run status;
2. **What changed** summary;
3. country success and failure overview;
4. screenshots and normalized evidence;
5. detailed field table, receipts, replay actions, and exports.

The summary is deterministic and derived only from captured fields. It may report:

- availability: successes, failures, and unavailable evidence;
- routing: differences in final URL;
- localization: differences in document language, heading, primary action, currency tokens, or price text;
- consent: differences in detected consent text.

It does not use an LLM, infer causality, assign a quality score, or claim that absent extracted text proves that a feature is absent.

Detailed comparison rows use successful regions to determine `match` or `different`. A failed country contributes an unavailable cell but does not force the entire row to unavailable. A row is globally unavailable only when fewer than two successful regional values can be compared. Screenshots, the detailed table, and receipts become secondary expandable sections without hiding the evidence or accessibility relationships.

## 9. Security, privacy, and cost invariants

The readiness work must preserve:

- server-only `SOLARI_API_KEY` handling;
- public HTTPS-only target validation and DNS rebinding checks;
- private-network and unsafe redirect rejection;
- verified residential proxy country receipts;
- `finally` cleanup for every launched browser and client;
- escaped, self-contained HTML export;
- raw-session omission from exported reports and visible text;
- no analytics, accounts, database, queue, scheduler, background job, or additional dependency;
- no automatic live request from page load, sample mode, test fixtures, or retry logic;
- no more than three simultaneous provider sessions;
- exactly four selected markets and no more than four initial captures in the optional final live proof;
- no live-proof retry or fifth provider call without separate owner approval.

## 10. Verification and evidence gates

Implementation follows RED-first development. Each behavior change begins with a focused failing test, then the smallest passing implementation. Test coverage must include:

- the exact fifteen-country catalogue and centralized labels;
- two-to-fifteen selection validation;
- ordered batching for more than three countries and a hard concurrency ceiling of three;
- cancellation before a later batch starts and stale-response suppression;
- fixed demo controls and zero capture-route calls;
- accurate sample/live labels in UI and exports;
- successful-country comparisons surviving a failed country;
- deterministic summary categories;
- lifecycle-specific safe errors and explicit country retry;
- run ID validation and preservation across retry;
- bounded registry expiry and eviction;
- safe session-reference consistency and raw-session omission from logs, UI, and exports;
- responsive and keyboard-operable progress, cancel, retry, summary, and expandable detail surfaces.

Before any live proof, all unit, component, route, focused end-to-end, type, lint, build, accessibility, sample-mode network, export-redaction, and scoped secret checks must pass under Node 22.22.2. Browser evidence must cover the relevant desktop and mobile viewports. The Impeccable detector is run once against the final changed UI targets, and its material findings are resolved or recorded.

If any non-live gate fails, the live proof is `NOT RUN`. If a live call is unavailable, exhausted, or ambiguous, the corresponding claim is `NOT PROVEN`; fixture or browser evidence must not be relabelled as provider evidence.

## 11. Documentation and stop condition

The final local checkpoint contains:

- implementation and focused tests in small verified commits;
- an evidence report separating unit, component, browser, sample, live-provider, and manual evidence;
- a manual checklist for Solari dashboard correlation using run ID, country, timestamp, and safe session reference;
- locally saved screenshots referenced by the evidence report;
- an explicit record of provider-call count and live-proof outcome;
- unchanged protected/generated workspace files unless a later implementation step legitimately requires a scoped tracked edit.

The work stops after local verification and local commits. It does not push, open a pull request, deploy, publish, submit, merge, or release.
