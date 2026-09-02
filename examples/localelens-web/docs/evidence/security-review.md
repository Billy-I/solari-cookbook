# LocaleLens Phase 4 Security and Privacy Review

## Scope and provenance

- Task: Phase 4 Task 5 only.
- Review base: `758d5a5b594ba8111e9525fdf928738a3ea474fc`.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`.
- Branch: `codex/localelens-phase-4-hardening`.
- Runtime: Node.js `v22.22.2` from the explicitly pinned Node 22 install.
- Evidence types used: tracked-source inspection, fresh production-build
  inspection, Vitest unit/component/route tests, and local production HTTP
  probes.
- Excluded: Browser inspection, Playwright/E2E, live Solari calls, credential
  retrieval, provider-console evidence, deployment, publication, and Phase 5.

The review confirmed two layers of one unsupported-method defect. First,
Next.js generated recognized-method `405` responses outside the application
route helpers, so those responses did not carry `Cache-Control: no-store`.
Focused regressions failed before explicit method handlers were added (`11`
failures, `30` passes), then passed (`41` passes).

A follow-up production review then showed those route exports did not cover
methods outside Next's supported route-handler set. `PROPFIND` and `MKCOL`
returned `400` without `Allow`, `Cache-Control`, or a safe structured body on
both API routes. The RED production check recorded all four failures. A narrow
Next.js `proxy.ts` matcher now returns a structured `405` with the exact route
`Allow` value and `Cache-Control: private, no-store` before route dispatch.
The same production check is GREEN for every recognized unsupported method and
both WebDAV methods while proving allowed capture/replay requests and `/`
remain unchanged.

`TRACE` is rejected by Next before Proxy can produce the application response.
Both routes return framework `500` responses without `Allow` or the structured
method body. The observed framework response has a broader private/no-cache/
no-store header, but the application method contract is **NOT PROVEN** for
`TRACE` and is not reported as PASS.

No other source change was justified by the observed evidence.

## Threat matrix

| Boundary | Evidence | Result |
| --- | --- | --- |
| Invalid HTTP methods | Production HTTP regression covers capture `GET`, `HEAD`, `PUT`, `PATCH`, `DELETE`, `PROPFIND`, `MKCOL`, and `TRACE`; replay `POST`, `PUT`, `PATCH`, `DELETE`, `PROPFIND`, `MKCOL`, and `TRACE`. Route tests separately cover explicit `OPTIONS`. | PASS for every app-reachable method: structured `405` except the bodyless `HEAD`, exact `Allow`, and `private, no-store`; `OPTIONS` is an empty `204` with `no-store`. `TRACE` is NOT PROVEN because Next rejects it before Proxy. |
| Malformed JSON | Capture route test and production HTTP probe. | PASS: `400` / `INVALID_INPUT`, stable allowlisted message, `no-store`, no internal path or stack detail. |
| Oversized request | Exact 2 KiB boundary, one-byte-over, streamed-body, misleading-length, and declared-length tests plus production HTTP probe. | PASS: one byte over returns `413` / `INVALID_INPUT` before capture; streamed bodies remain bounded. |
| Unsafe initial URL | URL-policy tests cover scheme, credentials, fragments, non-default ports, local names, private/reserved IPv4 and IPv6 literals, mixed public/private DNS answers, and unusable DNS answers. Capture lifecycle tests prove validation occurs before client construction. | PASS in unit/route evidence. No live adversarial DNS exercise was run. |
| Redirect revalidation | Capture lifecycle test invokes the top-level navigation guard with a private redirect target. | PASS: the navigation is aborted as `PRIVATE_TARGET_BLOCKED`, then browser and client cleanup run. This is injected unit evidence, not a live redirect probe. |
| Unsupported country | Route test and production HTTP probe. | PASS: `400` / `UNSUPPORTED_COUNTRY` before capture. |
| Live-disabled default | Source inspection, `.env.example`, route tests, and a production server started with live capture disabled and no credential. | PASS: capture and replay return `403`, remain `no-store`, and do not construct a provider client. |
| Replay ID | Route tests cover length, separators, encoded slash, query, and whitespace; production HTTP probe covers an invalid encoded identifier. | PASS: stable `400` / `unavailable`, `no-store`, before client construction. |
| Replay URL | Server route logic rejects non-string, overlong, non-HTTPS, credential-bearing, fragmented, and non-default-port URLs; route tests exercise the first three classes, while component tests exercise credentials, fragments, and ports before rendering a link. | PASS in route/component evidence. Provider replay readiness and a real replay URL were not exercised. |
| Response caching | Capture and replay route suites assert `no-store` across normal branches. Production probes cover normal live-disabled requests, explicit `OPTIONS`, recognized unsupported methods, and WebDAV methods. | PASS for normal and app-reachable method responses. The `TRACE` framework error has a private/no-cache/no-store policy, but lacks the exact application header and remains NOT PROVEN. |
| Provider error disclosure | Safe-error tests cover allowlisted internal codes, provider `401`, `403`, `429`, and `503`, timeout conversion, prototype-property rejection, and unknown exceptions. Replay tests cover provider failure. | PASS: client bodies contain only stable public categories/messages and omit upstream bodies. |
| Screenshot cap | Capture lifecycle test accepts exactly `1,500,000` binary bytes and rejects `1,500,001` before base64 encoding. | PASS. |
| Capture response cap | Client transport test rejects a streamed response at `3,000,001` bytes before the client timeout; response contracts bound every accepted field. | PASS. |
| Export privacy and cap | Export tests require two successes, retain only allowlisted evidence, remove URL credentials/query/fragment, omit screenshots/session IDs/replay URLs, accept exactly `262,144` UTF-8 bytes, and reject `262,145`. | PASS. |
| Cleanup and abort | Capture lifecycle tests cover launch/navigation/extraction/screenshot failures, browser-cleanup failure, bounded cleanup, late browser allocation, and safe late-cleanup logging. Replay tests close the client and fail closed on cleanup failure. Run-hook tests cover abort, replacement, unmount, stale callbacks, and retained transport ownership. | PASS in deterministic tests. Provider-console resource state is NOT PROVEN. |
| Credential logging | The client-construction test proves no console call while passing the server-only key directly to the one-attempt SDK constructor. Cleanup tests record only category and random request ID. Source inspection found no logging of key, session ID, replay URL, screenshot, page text, or provider body. | PASS in code/test evidence. Runtime provider logs were not inspected because no provider call occurred. |

## Local production route probes

The original failure probes started the fresh production build twice on
loopback: once with live mode disabled and no credential, and once with live
mode enabled using a non-secret synthetic placeholder. The enabled-mode probes
used only branches proven to reject before provider client construction.

The final committed `npm run check:api-methods` regression starts its own
production server with live mode disabled and no credential. It exercises raw
methods through Node HTTP, asserts the exact status/body/`Allow`/cache contract,
asserts no CORS header is introduced, proves allowed routes retain their
default-off behavior, and proves `/` is outside the narrow Proxy matcher. These
probes spent zero Solari calls.

| Probe | Observed result |
| --- | --- |
| capture recognized invalid methods | `405`, structured safe body except bodyless `HEAD`, exact `Allow`, `private, no-store` |
| capture `PROPFIND` and `MKCOL` | `405`, structured safe body, exact `Allow`, `private, no-store` |
| capture `TRACE` | `500`; no `Allow` or structured method body; rejected before Proxy; NOT PROVEN |
| capture `OPTIONS` | `204`, empty body, exact `Allow`, `no-store` |
| malformed capture JSON | `400` / `INVALID_INPUT`, `no-store` |
| 2,049-byte capture body | `413` / `INVALID_INPUT`, `no-store` |
| private capture URL | `400` / `PRIVATE_TARGET_BLOCKED`, `no-store` |
| unsupported capture country | `400` / `UNSUPPORTED_COUNTRY`, `no-store` |
| replay recognized invalid methods | `405`, structured safe body, exact `Allow`, `private, no-store` |
| replay `PROPFIND` and `MKCOL` | `405`, structured safe body, exact `Allow`, `private, no-store` |
| replay `TRACE` | `500`; no `Allow` or structured method body; rejected before Proxy; NOT PROVEN |
| replay `OPTIONS` | `204`, empty body, exact `Allow`, `no-store` |
| invalid replay ID | `400` / `unavailable`, `no-store` |
| capture and replay with live mode disabled | `403`, stable safe bodies, `no-store` |
| `/` outside the Proxy matcher | `200`; application page unchanged |

The original failure probes asserted that responses contained no repository
path, dependency path, stack-frame shape, key-shaped value, or synthetic
placeholder value. The final app-reachable method probes require the exact safe
body. The `TRACE` response body is neither admitted nor printed and remains
NOT PROVEN.

## Secret inspection

Scans were filename/count-only for value-bearing patterns so a hypothetical
credential would not be printed. The tracked scan used the fallback Git binary
and realistic key-shaped and non-placeholder environment-assignment patterns.
The built scan ran only after a fresh successful production build and excluded
the build cache.

| Inspection | Count | Interpretation |
| --- | ---: | --- |
| tracked files containing a realistic Solari key-shaped value | `0` | PASS |
| tracked files containing a non-placeholder dotenv key assignment | `0` | PASS |
| tracked files containing a populated public key/secret/token assignment | `0` | PASS |
| fresh built files containing a realistic Solari key-shaped value | `0` | PASS |
| fresh built files containing the safe server variable names | `12` | Expected server/runtime references only |
| fresh `.next/static` files containing either server variable name | `0` | PASS: absent from emitted client assets |
| fresh `.next/static` files containing a public key/secret/token variable name | `0` | PASS |

Ignored-status inspection reported only the protected untracked instruction
files plus `.superpowers/`, `.next/`, `node_modules/`, and
`tsconfig.tsbuildinfo`. Generated output and dependencies were not staged.

## Verification

All commands below used explicit Node `v22.22.2`:

| Command | Result |
| --- | --- |
| focused security/privacy suite | PASS: `13` files, `197` tests |
| `npm test` | PASS: `23` files, `234` tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS: static `/`; dynamic capture and replay routes; Proxy included |
| `npm run check:api-methods` | PASS for all app-reachable methods and matcher-preservation checks; `TRACE` explicitly NOT PROVEN on both routes |
| `npm run check:budget` | PASS: `151,540 B / 184,320 B` main-route gzip |

## Qualifications

- This review proves local source, deterministic tests, fresh built output, and
  loopback production-route behavior only.
- It does not prove live target behavior, provider infrastructure, replay
  readiness, provider-console cleanup, hosted/deployed headers, a Browser
  journey, E2E behavior, or assistive-technology behavior.
- No real credential was retrieved or used, and no Solari call occurred.
- `TRACE` is rejected before the application Proxy can return the exact method
  response. Its framework `500` outcome is retained as NOT PROVEN, not promoted
  from the broader framework cache header.
- Browser/E2E/live/provider work remains outside Task 5. Phase 5 was not
  started.
