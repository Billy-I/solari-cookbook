# LocaleLens

LocaleLens is a regional web-experience comparison tool for product designers,
growth teams, localization leads, and QA engineers. It captures bounded,
reviewable evidence from one public HTTPS page through Solari regional browser
sessions instead of treating an assumed proxy location as proof.

## Phase 2 status

Phase 2 implements the secure single-region capture and replay core:

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
- guarded, non-cacheable capture and replay routes.

The implementation and all non-live gates pass at pre-live SHA
`878636764f30f94def97e3519e9d2d1a4f695a60`. A bounded live proof against
`example.com` passed with one recorded US session using Solari's documented
residential default, a matching provider-country receipt, bounded extraction
and JPEG output, confirmed cleanup, and one honest pending replay lookup. No
Phase 3 multi-country orchestration has started.

## Architecture

One `POST /api/captures` request validates one URL and one supported country,
creates one Solari client and one browser, captures the bounded result, and
closes both resources. `GET /api/replays/:id` performs one lookup for the
bounded temporary replay URL and closes its client in `finally`.

The Solari SDK is externalized from Next.js server bundling because its
Node-specific browser transport must load natively. Both API routes use the
Node runtime and `Cache-Control: no-store`.

There is no database, account system, queue, background worker, automatic
retry, analytics pipeline, or model provider. The browser UI remains the
deterministic Phase 1 sample journey; Phase 3 owns live multi-country client
orchestration, comparison, retry controls, and export.

## Local setup

From the cookbook repository root:

```bash
cd examples/localelens-web
nvm use
node --version
npm install
```

The repository's `.nvmrc` expects Node `v22.20.0`. Phase 2 verification uses
the installed compatible Node `v22.22.2`. Application and dependency versions
are pinned exactly in `package.json` and `package-lock.json`.

Live mode requires a Solari key obtained from
[`console.getsolari.com`](https://console.getsolari.com) and loaded through a
local secret path. The qualified Phase 2 proof stored its key in the macOS
Keychain service `LocaleLens Solari API Key` through Security.framework and
injected it only into the server process:

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
npm ls --depth=0
```

Run repository checks from the cookbook root:

```bash
git diff --check
git status --short --branch
```

The live smoke proof is separate from normal verification so tests and builds
cannot spend provider credit. Phase 2 uses only `https://example.com/`. It can
prove session launch, requested and reported proxy country, navigation,
extraction, screenshot bounds, cleanup, recording receipt, and replay state.
It cannot independently prove the raw optional provider tier field or
locale-specific content variation.

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

Phase 2 does not implement live two/three-country orchestration, deterministic
live comparison, explicit country retry UI, exports, release hardening,
deployment, pull requests, or publication. Those remain later-phase work and
are not authorized here.

See the [execution index](../../docs/EXECUTION_INDEX.md), [approved product and
system design](../../docs/superpowers/specs/2026-09-01-localelens-design.md),
[Phase 2 implementation
plan](../../docs/superpowers/plans/2026-09-01-localelens-phase-2-secure-capture.md),
[selected visual direction](../../docs/design/localelens-visual-direction.md),
[Phase 1 evidence](../../docs/evidence/localelens-phase-1.md), and [Phase 2
evidence](docs/evidence/phase-2.md).
