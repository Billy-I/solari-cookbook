# LocaleLens Phase 2 Evidence

## Scope and lineage

- Status: Phase 2 complete; Phase 3 not started.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`
- Branch: `codex/localelens-phase-2-secure-capture`
- Exact predecessor: `5691271ce2027ff8e1a61b04a3991ab7e72e088a`
- Phase 1 evidence ancestor: `6ae07c11d58f2fce27e3cdca84b75578968a04cc`
- Pre-live implementation SHA: `878636764f30f94def97e3519e9d2d1a4f695a60`
- Runtime: Node.js `v22.22.2`
- SDK: exact `@solarisdk/browser@0.1.2`
- Local live-mode route attempts: `2` (`1` blocked before client construction)
- Live Solari browser sessions established: `1`
- Live replay lookups used: `1`
- Phase 3 started: `false`

## Provider contract recheck

The official quickstart, sessions, proxies, recording, TypeScript Browser SDK,
and Browser API references were rechecked before installation. Registry
`latest` remained `0.1.2`. Two security-relevant live-contract details were
added to the Phase 2 plan before implementation:

1. The SDK HTTP client defaults to two attempts, so the factory now sets
   `maxAttempts: 1`; `launch()` also receives `retries: 0`.
2. Signed Solari session IDs contain `:`, `.`, `_`, and `-`, and replay `404`
   is intentionally ambiguous. The replay route accepts only that bounded
   character set and reports `404` as pending/unavailable without claiming a
   definitive missing state.

The written plan allowed a second GB capture after the US proof. The owner's
later instruction narrowed the live action to one additional `example.com`
call, so no GB capture or locale-comparison claim was attempted. That work
remains Phase 3.

## RED-first implementation evidence

| Slice | RED observation | Verified GREEN observation |
| --- | --- | --- |
| Solari factory | Factory module absent | 4 focused tests; missing/blank key rejected and `maxAttempts: 1` passed |
| Public URL policy | Validator module absent | 44-case IPv4/IPv6, DNS, protocol, and normalization matrix passed |
| Page extraction | Extractor module absent | Bounded visible-text, ordering, deduplication, hidden-content, and traversal-budget tests passed |
| Capture lifecycle | Lifecycle and safe-error modules absent | Exact launch options, redirect guard, proxy receipt, shared hard deadline, JPEG cap, safe errors, and bounded nested-finally cleanup paths passed |
| API routes | Capture and replay route modules absent | Live/key/incremental-body/ID guards, no-store responses, bounded replay URL states, and replay cleanup passed |

## Non-live gate

All commands ran from `examples/localelens-web/` under Node `v22.22.2` unless
otherwise noted.

| Command | Result |
| --- | --- |
| `npm test` | PASS: 15 files, 147 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS: static `/`; dynamic `/api/captures` and `/api/replays/[id]` |
| `git diff --check` | PASS |
| ignored local `.env*` inspection | PASS: local variants ignored; only `.env.example` tracked |
| tracked `NEXT_PUBLIC_SOLARI` inspection | PASS: absent |
| tracked key-shaped value inspection | PASS: absent |
| production-build key/public-alias inspection | PASS: absent |
| production runtime with `LIVE_CAPTURE_ENABLED=false` and no key | PASS: capture and replay returned `403`, `Cache-Control: no-store`, and stable safe bodies before client construction |
| production runtime with `LIVE_CAPTURE_ENABLED=true` and no key | PASS: capture and replay returned `503`, `Cache-Control: no-store`, and stable safe bodies without contacting Solari |

The two existing npm extraneous wasm helper folders remain local Phase 1
artifacts. They are not direct dependencies, lockfile entries, Git content, or
product bundle inputs.

An independent code review found no Critical issues and identified bounded
request ingestion, bounded traversal work, a whole-capture deadline, safe
cleanup observability, replay URL sizing, and late-launch browser/client
cleanup as required fixes. Those fixes were implemented RED-first and passed
the full non-live gate at the pre-live SHA above. Follow-up review is recorded
separately from provider evidence.

## Real-provider evidence

| Field | Result |
| --- | --- |
| Target hostname | `example.com` |
| UTC window | `2026-09-01T19:17:13.614Z` to `2026-09-01T19:17:21.390Z` |
| Requested country and proxy mode | PASS: `us`; the official SDK documents a string country proxy request as residential by default |
| Reported proxy country | PASS: direct provider receipt matched `us`; timezone receipt present |
| Proxy tier qualification | The API response exposed the normalized `residential` receipt, but the optional raw provider tier field was not separately retained; this is not claimed as independent tier-field evidence |
| Recorded session receipt | PASS: bounded session receipt present; recording requested; the provider console later showed the completed session as having a recording |
| Navigation and extraction | PASS: final hostname `example.com`, HTTP `200`, title and primary heading present, language `en`, 1 CTA, 0 currency tokens |
| JPEG screenshot byte bound | PASS: `image/jpeg`, `17,767` bytes, below `1,500,000` bytes |
| Browser cleanup | PASS: successful response followed the awaited browser close path with no cleanup failure |
| Solari client cleanup | PASS: successful response followed the awaited client close path with no cleanup failure |
| Replay lookup | QUALIFIED PASS: one lookup returned HTTP `202` / `pending`; no bearer URL was returned, recorded, or polled |
| Live provider calls | `1` recorded browser-session launch and `1` replay lookup; no capture retry |

The live success response is fail-closed on cleanup: an otherwise successful
capture becomes `CAPTURE_FAILED` if browser or client cleanup cannot be
confirmed. The target was only `https://example.com/`; this proves the bounded
provider path and does not prove locale-specific content variation.

At `2026-09-01T18:50:46Z`, the first bounded live request returned the stable
`SOLARI_AUTH` error before client construction because the initial Keychain
item contained an empty value. Read-only console evidence confirmed that no
provider key was used; no session or replay lookup ran and no automatic retry
followed. The empty local item was removed. This is retained as one local route
attempt but is not counted as a live Solari call or promoted to provider proof.

The corrected key was stored through macOS Security.framework via process
stdin, then read through the same framework. A redacted check proved it was
non-empty and matched the expected key format. The full key value, session ID,
replay URL, screenshot bytes, provider payload, and page text were never
printed, logged, screenshotted, or committed.

## Current worktree boundary

The generated files `examples/localelens-web/AGENTS.md` and
`examples/localelens-web/CLAUDE.md` remain untracked and unstaged. No Phase 3
source, deployment, pull request, release, or upstream push exists.
