# LocaleLens

LocaleLens is a regional web-experience comparison tool for product designers,
growth teams, localization leads, and QA engineers. It captures bounded,
reviewable evidence from one public HTTPS page through Solari regional browser
sessions instead of treating an assumed proxy location as proof.

## Phase 4 local status

Phase 4 is locally complete with frozen evidence on exact predecessor
`06bfba6efd2c9ef4ef98cc0eb9266afd377082fa` and implementation head
`818f32463b66faba049a57fa34e2e8b5d1219c3e`. The exact evidence-commit SHA is
resolved and reported by Git after commit instead of being embedded
self-referentially in the evidence. Owner acceptance remains pending.

The final local gate passes 23 Vitest files / 234 tests, typecheck, lint, a
sample-mode production build, the 151,504 B / 184,320 B main-route gzip budget,
11/11 sample-only Playwright tests, the app-reachable API-method gate,
realistic tracked/fresh-build secret scans, and the Git whitespace check. The
sample runner observed zero capture/replay API requests and spent zero Solari
credits.

In-app Browser evidence covers the stable shell, featured success, invalid
input, and running states at `360x800`, `768x1024`, and `1440x900`, plus the
live partial/retry/replay/final states at `1440x900`. The bounded live run used
exactly four Spotify Premium capture calls: three initial US/GB/DE calls and
one explicit GB retry, with no automatic retry. Three initial replay lookups
were pending; one manual re-check per country made all three ready. Replay URLs
and session IDs are not recorded.

Actual browser-chrome 200% zoom, Browser reduced motion, direct screen-reader
or VoiceOver output, live-only state variants at the two smaller viewports,
raw optional provider tier/receipt payloads, provider-console cleanup, and
hosted/deployed behavior remain `NOT PROVEN`.

## Phase 3 foundation

Phase 3 retains the secure single-region capture and replay core from Phase 2
and adds the bounded comparison journey:

- the exact official `@solarisdk/browser@0.1.2` package;
- request-time, server-only `SOLARI_API_KEY` access;
- `LIVE_CAPTURE_ENABLED=false` by default;
- strict public HTTPS and DNS-address validation before launch, on top-level
  navigation, and after navigation;
- rejection of credentials, fragments, non-default ports, local hostnames,
  and private, reserved, metadata, documentation, benchmark, multicast, and
  broadcast IP ranges;
- one recorded stealth residential-proxy session per capture request;
- required matching proxy-country receipt;
- incrementally bounded request ingestion, deterministic rendered-text
  traversal budgets, a 45-second capture deadline, and a full-page JPEG capped
  at 1.5 MB;
- stable allowlisted client errors with no upstream body or credential data;
- browser and Solari client cleanup in nested `finally` paths, with bounded
  cleanup waits and redacted category/request-ID observability; and
- guarded, non-cacheable capture and replay routes;
- independent live capture for exactly two or three supported countries, with
  at most three in flight;
- honest partial results and one-country explicit retry without automatic
  retry;
- deterministic comparison rows with a valid compact mobile equivalent;
- safe ready, pending, and unavailable replay presentation; and
- hostname-only, privacy-bounded JSON export plus semantic print output.

The Phase 3 implementation and all non-live gates passed at pre-evidence SHA
`dfe02a8abb563e71bcd34bf7b626232694f31c34`. A bounded live comparison of
Spotify Premium spent exactly three initial calls for US, GB, and DE plus one
explicit GB retry after a retryable failure. US and DE remained visible in an
honest partial state; the GB retry completed the comparison. Direct provider
country receipts matched all three requests. All three replay lookups remained
pending, so no ready provider replay URL is claimed.

## Architecture

One `POST /api/captures` request still validates one URL and one supported
country, creates one Solari client and one browser, captures the bounded
result, and closes both resources. The client orchestrator independently
schedules exactly two or three selected countries and merges completion in a
stable country order. `GET /api/replays/:id` performs one explicit lookup for
the bounded temporary replay URL and closes its client in `finally`.

The Solari SDK is externalized from Next.js server bundling because its
Node-specific browser transport must load natively. Both API routes use the
Node runtime and `Cache-Control: no-store`.

There is no database, account system, queue, background worker, automatic
retry, analytics pipeline, or model provider. Sample mode remains deterministic
and isolated from live mode. Live state is intentionally in browser memory;
country retry, replay re-check, JSON download, and print are explicit user
actions.

## Local setup

From the cookbook repository root:

```bash
cd examples/localelens-web
nvm use
node --version
npm install
```

The repository's `.nvmrc` expects Node `v22.20.0`. Phase 3 verification uses
the installed compatible Node `v22.22.2`. Application and dependency versions
are pinned exactly in `package.json` and `package-lock.json`.

Live mode requires a Solari key obtained from
[`console.getsolari.com`](https://console.getsolari.com) and loaded through a
local secret path. The qualified Phase 2 and Phase 3 proofs stored the key in
the macOS Keychain service `LocaleLens Solari API Key` through
Security.framework and injected it only into the server process:

```text
SOLARI_API_KEY=<local secret only>
LIVE_CAPTURE_ENABLED=true
```

Never place the key in source, chat, shell output, screenshots, evidence, or a
`NEXT_PUBLIC_` variable. Keep `LIVE_CAPTURE_ENABLED=false` for normal local and
public operation. A capture request never retries automatically.

## Verification

Run non-live checks from `examples/localelens-web/`:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run check:budget
npm run test:e2e
npm run check:api-methods
npm ls --depth=0
```

Run repository checks from the cookbook root:

```bash
git diff --check
git status --short --branch
```

The live proof is separate from normal verification so tests and builds cannot
spend provider credit. Phase 3 used only
`https://www.spotify.com/premium/`, with an exact four-call capture budget:
three initial independent country calls and one explicit GB retry. The
evidence records matching requested/direct provider-country receipts,
locale-specific results, bounded screenshots, cleanup-path observations, the
final comparison, and three pending replay lookups. It does not independently
prove the raw optional provider tier field or a ready replay URL.

## Security and privacy

- Only server routes import the Solari client factory; the key is read from
  `process.env.SOLARI_API_KEY` at request time.
- SDK HTTP requests use `maxAttempts: 1`, and `launch()` uses `retries: 0`.
- Target page text is untrusted data and never consumed by a model or rendered
  as HTML.
- Screenshots, session IDs, replay URLs, raw page text, provider response
  bodies, and environment values are excluded from logs and committed
  evidence.
- Replay `404` is reported as pending/unavailable because Solari intentionally
  does not distinguish finalization delay from an absent or unowned replay.
- No request or response is persisted server-side.

## Phase boundary

Phase 3 is complete. Phase 4 is locally complete with qualified evidence
frozen; owner acceptance is still pending. Phase 5, push, pull request,
deployment, release, and publication have not started and are not authorized
here.

See the [execution index](../../docs/EXECUTION_INDEX.md), [approved product and
system design](../../docs/superpowers/specs/2026-09-01-localelens-design.md),
[Phase 2 implementation
plan](../../docs/superpowers/plans/2026-09-01-localelens-phase-2-secure-capture.md),
[selected visual direction](../../docs/design/localelens-visual-direction.md),
[Phase 1 evidence](../../docs/evidence/localelens-phase-1.md), [Phase 2
evidence](docs/evidence/phase-2.md), and [Phase 3
evidence](docs/evidence/phase-3.md), [Phase 4
evidence](docs/evidence/phase-4.md), and [Phase 4 visual
review](docs/evidence/visual-review.md).
