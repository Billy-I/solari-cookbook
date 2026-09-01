# LocaleLens Phase 3 Evidence

## Scope and lineage

- Status: Phase 3 complete; Phase 4 not started.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`
- Branch: `codex/localelens-phase-3-live-comparison`
- Exact Phase 3 predecessor: `026b6ffe4d3faca5e8c02c29885846675e699cfd`
- Pre-evidence implementation SHA: `dfe02a8abb563e71bcd34bf7b626232694f31c34`
- Runtime: Node.js `v22.22.2`
- SDK: exact `@solarisdk/browser@0.1.2`
- Live target: `https://www.spotify.com/premium/`
- Live capture calls: exactly `4` (`3` initial independent calls and `1` explicit country retry)
- Live replay lookups: exactly `3` (`1` per successful capture)
- Phase 4 started: `false`

Phase 3 adds bounded two/three-country live orchestration, deterministic
comparison, country-scoped retry, replay-state presentation, privacy-bounded
JSON export, and semantic printing. It does not broaden the Phase 2
server-only credential or single-capture security boundary.

## Non-live gate

All application commands ran from `examples/localelens-web/` under explicit
Node `v22.22.2` before any Phase 3 provider call.

| Command or inspection | Result |
| --- | --- |
| `npm test` | PASS: 22 files, 205 tests; pre-existing dependency `ExperimentalWarning` noise remained |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS: static `/`; dynamic capture and replay routes; same warning noise |
| `git diff --check` | PASS |
| tracked LocaleLens app secret-shaped inspection | PASS: no secret-shaped values and no non-placeholder `SOLARI_API_KEY` assignment |
| `.next/static` secret/public-key inspection | PASS: no `SOLARI_API_KEY`, `NEXT_PUBLIC_*(KEY|SECRET|TOKEN)`, or secret-shaped value |

The full test gate covers default-off live guards, the server-only key
boundary, a maximum three-country fan-out, absence of automatic retry,
cleanup, export exclusions, and the UTF-8 256 KiB export cap.

## Browser mock evidence

This evidence used only a local mock and spent no provider calls.

| Surface or flow | Observation |
| --- | --- |
| `360x800` | No horizontal control clipping; visible buttons were at least 44 px high; the wide table was hidden; the compact `dl` had eight direct `dt` and eight direct `dd` field pairs |
| `768x1024` | No horizontal control clipping; all three result cards and the semantic comparison table were visible |
| `1440x900` | Three equal regional columns and the semantic comparison table were inspected |
| Partial completion | US and GB successes remained visible while DE failed retryably; a DE-only retry preserved both successes and completed |
| Focus and replay states | Compare retained focus while busy; ready, pending, and unavailable replay states were checked, including the ready link's safe target and `rel`; one pending state was re-checked manually |

## Bounded real-provider comparison

The live target hostname was `www.spotify.com`. The Solari key was retrieved
only by a Swift Security.framework process and injected only into the server
process. The `security` command-line tool was not used, and the value was not
printed, logged, committed, screenshotted, or exposed to browser code.

The initial fan-out spent exactly three independent capture calls for `us`,
`gb`, and `de`. GB completed first with HTTP `502` / `CAPTURE_FAILED` and was
marked retryable. DE and then US succeeded, and the UI honestly
reported a partial `2 of 3` state while retaining those results. One explicit
visible **Retry United Kingdom** action spent the fourth and final capture
call. There was no automatic retry. The retry succeeded and the final UI
reported all three countries complete.

### Successful country receipts

| Requested | Direct provider-country receipt | Documented/normalized proxy mode | Timezone receipt | Final URL | HTTP | Language | Currency | Representative heading | Captured at | Screenshot upper-byte estimate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `us` | `proxyCountry=us` | `residential` | `America/New_York` | `https://www.spotify.com/us/premium/` | `200` | `en-US` | `$` | `Always flexible, cancel anytime.` | `2026-09-01T21:19:03.091Z` | `474,906` |
| `de` | `proxyCountry=de` | `residential` | `Europe/Berlin` | `https://www.spotify.com/de/premium/` | `200` | `de-DE` | `€` | `3 Monate Premium Individual für 0 €` | `2026-09-01T21:19:01.352Z` | `388,212` |
| `gb` retry | `proxyCountry=gb` | `residential` | `Europe/London` | `https://www.spotify.com/uk/premium/` | `200` | `en-GB` | `£` | `One of the world’s most widely supported music platforms, compatible with over 2,000 devices.` | `2026-09-01T21:19:43.174Z` | `434,856` |

The screenshot values are conservative estimates derived from base64 lengths,
not exact decoded byte counts. Each is below 1.5 MB; code and tests enforce the
exact 1.5 MB binary limit before encoding.

The response reports the normalized residential receipt only after rejecting
any non-residential raw tier. The optional raw SDK proxy-tier value was not
independently retained, so the table is not independent raw-tier proof. All
successful receipts recorded `recordingRequested=true`.

The initial failure and all successes returned through the awaited `finally`
cleanup path, and no `browser_cleanup_failed` event was observed. This is
code-path plus negative-log evidence, not provider-console cleanup proof.

## Replay evidence

Exactly three replay lookups ran, one after each successful capture. All three
returned HTTP `202` / `pending`. No replay URL was returned, recorded, exported,
or polled automatically. Replay readiness therefore remains unproved.

## Export evidence

The Browser downloaded
`localelens-www-spotify-com-2026-09-01T21-20-05-163Z.json`, exactly `8,819`
bytes.

| Field | Result |
| --- | --- |
| Schema and generation | schema `1`; generated `2026-09-01T21:20:05.163Z` |
| Run state | mode `live`; status `complete`; failures empty |
| Target | hostname only: `www.spotify.com` |
| Deterministic countries/results | `de`, `gb`, `us` |
| Deterministic comparison rows | `final_url`, `title`, `language`, `currency`, `price`, `heading`, `primary_action`, `consent` |
| Forbidden content inspection | screenshots/base64, session IDs, replay URLs, keys/environment values, and secret-shaped values absent |
| URL privacy inspection | query strings and fragments absent from exported final URLs and comparison URL values |
| Limitations | included in the report |

## Print, viewport, and keyboard evidence

Live checks at 360 and 768 px repeated the no-clipping and compact/semantic
surface observations above. The final live 1440 px layout was also inspected
visually.

Browser-controller keyboard calls moved focus to the replay re-check control
but did not generate another lookup. They do not prove synthetic Enter/Space
activation. Separately, native macOS Computer Use moved focus with Shift-Tab
from Print to Download JSON, and Return opened the Save dialog. The dialog was
cancelled, providing native keyboard-activation evidence for the export
control.

Native Brave print preview opened the existing semantic report and rendered
three pages containing report content and limitations, without screenshots or
interactive export controls. It was cancelled without saving. Because client
state is intentionally memory-only per browser, this native print visual proof
used the deterministic sample surface. Live `window.print()` invocation was
exercised separately in the in-app Browser, whose host print dialog was not
accessible.

## Security and privacy boundary

- The credential remained server-only and live mode remained explicitly
  guarded.
- The client orchestrator scheduled at most three selected countries and did
  not add automatic retries.
- Country retry was explicit and replaced only the failed country's state.
- Export required at least two successful receipts and omitted high-risk or
  unnecessary capture artifacts.
- No provider response body, session ID, replay URL, screenshot payload, or
  secret was added to committed evidence.

## Qualifications and stop condition

- The optional raw provider proxy-tier field is **NOT independently proven**.
- Provider replay readiness is pending only; no ready provider replay URL was
  proved.
- Screenshot sizes are conservative base64-derived upper estimates; exact
  binary-cap enforcement is code/test evidence.
- Native print visual evidence is sample-state evidence; the live print check
  proves only the invocation path.
- The first GB attempt failed generically and only the explicit fourth call
  recovered it.
- No assistive-technology audit, Phase 4 hardening, push, pull request,
  deployment, or release was performed.

Phase 3 complete; Phase 4 not started.
