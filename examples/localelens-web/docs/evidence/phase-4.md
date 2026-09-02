# LocaleLens Phase 4 Evidence

## Scope and lineage

- Status: **PHASE 4 LOCALLY COMPLETE — EVIDENCE FROZEN; OWNER ACCEPTANCE PENDING**.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`.
- Branch: `codex/localelens-phase-4-hardening`.
- Exact Phase 4 predecessor: `06bfba6efd2c9ef4ef98cc0eb9266afd377082fa`.
- Phase 4 implementation head: `818f32463b66faba049a57fa34e2e8b5d1219c3e`.
- Exact evidence-commit SHA: resolved and reported by Git after this document is committed; it is not embedded self-referentially here.
- Runtime: Node.js `v22.22.2` from the explicitly pinned Node 22 install.
- SDK: exact `@solarisdk/browser@0.1.2`.
- Live target: `https://www.spotify.com/premium/`.
- Phase 4 live capture calls: exactly `4` (`3` initial independent calls and
  `1` explicit failed-country retry).
- Phase 4 live replay lookups: exactly `6` (`3` initial pending lookups and
  `3` one-per-country manual re-checks that became ready).
- Phase 5 started: `false`.

No automatic retry occurred. The four-call capture maximum was reached, and
no further capture or replay call is authorized or required by this evidence.

## Final local non-live gate

All application commands ran from `examples/localelens-web/` with explicit
Node `v22.22.2`. The final build explicitly used sample mode. Git checks used
the bundled fallback Git binary.

| Command or inspection | Result |
| --- | --- |
| `npm test` | PASS: 23 files, 234 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `NEXT_PUBLIC_APP_MODE=sample npm run build` | PASS: static `/`; dynamic capture and replay routes; Proxy included |
| `npm run check:budget` | PASS: 151,504 B / 184,320 B main-route gzip |
| `npm run test:e2e` | PASS: 11/11 local Chromium sample tests; zero capture/replay API requests observed |
| `npm run check:api-methods` | PASS for all app-reachable cases and matcher-preservation checks; `TRACE` remains NOT PROVEN on both API routes because Next rejects it before Proxy |
| realistic tracked key-shaped value inspection | PASS: 0 matching files |
| non-placeholder tracked dotenv key assignment inspection | PASS: 0 matching files |
| populated tracked public key/secret/token assignment inspection | PASS: 0 matching files |
| realistic fresh-build key-shaped value inspection | PASS: 0 matching files |
| fresh built safe server-variable-name inspection | 14 files; expected server/runtime references only |
| fresh `.next/static` safe server-variable-name inspection | PASS: 0 matching files |
| fresh `.next/static` public key/secret/token variable-name inspection | PASS: 0 matching files |
| `git diff --check` | PASS |

Secret inspections reported counts only and did not print matching content.
The production build was fresh and explicitly sample-mode before built-output
inspection.

## Client budget

The main route resolved to `/page` through the fresh production manifests.
Unique main-route JavaScript chunks were measured once each after gzip.

| Gzip bytes | Client chunk |
| ---: | --- |
| 7,346 | `static/chunks/12aruqaur5huj.js` |
| 71,576 | `static/chunks/1j_9b-l0n6u-t.js` |
| 3,661 | `static/chunks/3fntmmi971322.js` |
| 47,060 | `static/chunks/3q5hirtwweuqh.js` |
| 17,573 | `static/chunks/3z71y8wlnjthf.js` |
| 4,288 | `static/chunks/turbopack-0e110lbnczxam.js` |
| **151,504** | **Total** |

The measured total is 32,816 B below the 184,320 B (180 KiB) ceiling.

## Zero-credit sample E2E proof

`npm run test:e2e` resolves to the sample-only Playwright entry point. Its
configuration starts a dedicated non-reused local server with
`NEXT_PUBLIC_APP_MODE=sample`. The comparison and responsive journeys observe
requests and assert that neither `/api/captures` nor `/api/replays` is called;
the accessibility suite applies the same assertion after every test. The final
run passed all 11 tests, so this automated gate spent zero Solari calls and
required no credential.

## In-app Browser evidence

Sample idle/featured-success, invalid-input, and running states passed direct
inspection at `360x800`, `768x1024`, and `1440x900`, with no document-level
horizontal overflow. Invalid submission focused the error summary. The
`360x800` surface used the compact definition-list comparison; `768x1024`
used a bounded internal horizontal table presentation; `1440x900` used the
full table and regional cards. Images used cover cropping and stayed within
their cards. The URL input showed a visible 3px signal focus ring with a 2px
offset.

At `1440x900`, the live partial failure, explicit GB retrying, replay pending,
final complete, and replay-ready states were directly observed. Browser
console warning/error entries were `0`. The stale blocked Browser error tab
prevented re-sizing those transient live-only states; their `360x800` and
`768x1024` variants remain `NOT PROVEN`.

Actual browser-chrome 200% zoom remains `NOT PROVEN` because Computer Use could
not control the Codex app for safety. In-app Browser reduced motion also
remains `NOT PROVEN` because media emulation was not used there. Automated
Playwright separately passed reduced-motion behavior and a `640x720`
CSS-pixel reflow proxy; neither result is promoted into the missing Browser
observation. Screen reader and VoiceOver output remain `NOT PROVEN`.

## Bounded live-provider comparison

The Solari key was retrieved by a Swift Security.framework process from
exactly one matching Keychain item, validated in-process, and injected only
into the local server process. It was never printed, persisted, committed, or
exposed to Browser code. The temporary helper was deleted, the live server was
stopped, and the pre-commit listener check found no Node/Next listener or
matching LocaleLens server process.

The initial fan-out used three independent capture calls for `us`, `gb`, and
`de`. GB failed safely with `CAPTURE_FAILED`, an allowlisted message, and
`retryable: true`; no provider detail was exposed. US and DE remained visible
in the partial state. One explicit GB retry used the fourth and final capture
call and succeeded. Final status was complete with 3 of 3 countries succeeded.

### Successful country evidence

| Requested | Final URL | Language | Currency | Representative heading | Primary action | Consent text | Captured | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `us` | `https://www.spotify.com/us/premium/` | `en-US` | `$` | `Always flexible, cancel anytime.` | `Estados Unidos (Español)` | `Safety & Privacy Center` | `2026-09-02T10:12:47Z` | natural `1273x12705`; rendered `382x268` cover |
| `de` | `https://www.spotify.com/de/premium/` | `de-DE` | `€` | `3 Monate Premium Individual für 0 €` | `Germany (English)` | `Cookie-Einstellungen` | `2026-09-02T10:12:46Z` | natural `1265x4543`; rendered `381x268` cover |
| `gb` explicit retry | `https://www.spotify.com/uk/premium/` | `en-GB` | `£` | `Always flexible, cancel anytime.` | `Skip to content` | `Safety and Privacy Centre` | `2026-09-02T10:13:49Z` | natural `1265x11989`; rendered `381x268` cover |

An accepted success can only reach the client after the enforced matching
proxy-country receipt guard passes. The matching country receipts are
therefore qualified application-contract inference, not independent raw
provider payload or console evidence; receipt/session identifiers are not
recorded here.

## Replay evidence

Each successful capture received one initial replay lookup, and all three were
pending. Exactly one manual re-check per final successful country added three
replay GETs and yielded ready for US, GB, and DE. The ready actions were HTTPS,
had no URL credentials or fragment, used only the default/443 port, and
rendered with `target="_blank"` plus `rel="noopener noreferrer"`.

No replay URL or session ID is recorded. The six replay GETs are lookup calls,
not capture calls, and do not alter the exact four-call capture ledger.

## Protected worktree state

The protected instruction files remained untracked, unstaged, and
byte-identical:

| File | SHA-256 |
| --- | --- |
| `examples/localelens-web/AGENTS.md` | `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb` |
| `examples/localelens-web/CLAUDE.md` | `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49` |

Only the four authorized evidence/index paths are committed. Ignored Browser
screenshots and the local Task 6 report remain outside Git.

## Evidence taxonomy

| Evidence type | Result | Qualification |
| --- | --- | --- |
| Vitest unit/component/route in Node/jsdom | PASS: 23 files, 234 tests | Deterministic local evidence only. |
| Sample Playwright in local Chromium | PASS: 11/11 | Dedicated sample mode; zero provider API requests. |
| In-app Browser manual inspection | QUALIFIED PASS | Stable shell/success/invalid/running at all required viewports; live-only partial/retry/replay mobile and tablet variants, actual 200% zoom, and Browser reduced motion remain NOT PROVEN. |
| Live Solari provider | QUALIFIED PASS | Exactly four capture calls and six replay lookups against the named target; matching receipt evidence is application-contract inference. |
| Hosted/deployed runtime | NOT PROVEN | No deployment or hosted check ran. |
| Assistive technology | NOT PROVEN | Automated axe and keyboard checks do not prove direct screen-reader behavior. |

## Known limitations and stop condition

- The exact application method contract for `TRACE` is `NOT PROVEN` because
  the framework rejects it before the application Proxy.
- Live-only partial/retry/replay states at `360x800` and `768x1024`, actual
  browser-chrome 200% zoom, Browser reduced motion, and direct screen-reader or
  VoiceOver behavior are `NOT PROVEN`.
- Raw optional provider tier, raw provider receipts, provider-console cleanup,
  and hosted/deployed behavior are `NOT PROVEN`.
- The exact evidence-commit SHA is resolved and reported by Git after commit;
  this document deliberately does not fabricate a self-referential SHA.

Phase 4 is locally complete and its evidence is frozen with the qualifications
above. Owner acceptance remains pending. Phase 5 was not started. No push,
deployment, release, publication, or other external action was performed.
