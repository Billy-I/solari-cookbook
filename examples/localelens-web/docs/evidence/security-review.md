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

The review found one confirmed defect: Next.js generated unsupported-method
responses outside the application route helpers, so those `405` responses did
not carry `Cache-Control: no-store`. A local production probe reproduced the
defect across the capture and replay endpoints. Focused regressions failed
before the change (`11` failures, `30` passes), then passed after explicit
unsupported-method and `OPTIONS` handlers were added (`41` passes). The
handlers return empty `405` bodies with an exact `Allow` header, or an empty
`204` for `OPTIONS`, and every response is `no-store`.

No other source change was justified by the observed evidence.

## Threat matrix

| Boundary | Evidence | Result |
| --- | --- | --- |
| Invalid HTTP methods | Production HTTP probes plus route regressions cover capture `GET`, `HEAD`, `PUT`, `PATCH`, and `DELETE`; replay `POST`, `PUT`, `PATCH`, and `DELETE`; and both `OPTIONS` handlers. | PASS after the RED-confirmed fix: unsupported methods return empty `405` responses, `OPTIONS` returns `204`, exact `Allow` headers are present, and all responses are `no-store`. |
| Malformed JSON | Capture route test and production HTTP probe. | PASS: `400` / `INVALID_INPUT`, stable allowlisted message, `no-store`, no internal path or stack detail. |
| Oversized request | Exact 2 KiB boundary, one-byte-over, streamed-body, misleading-length, and declared-length tests plus production HTTP probe. | PASS: one byte over returns `413` / `INVALID_INPUT` before capture; streamed bodies remain bounded. |
| Unsafe initial URL | URL-policy tests cover scheme, credentials, fragments, non-default ports, local names, private/reserved IPv4 and IPv6 literals, mixed public/private DNS answers, and unusable DNS answers. Capture lifecycle tests prove validation occurs before client construction. | PASS in unit/route evidence. No live adversarial DNS exercise was run. |
| Redirect revalidation | Capture lifecycle test invokes the top-level navigation guard with a private redirect target. | PASS: the navigation is aborted as `PRIVATE_TARGET_BLOCKED`, then browser and client cleanup run. This is injected unit evidence, not a live redirect probe. |
| Unsupported country | Route test and production HTTP probe. | PASS: `400` / `UNSUPPORTED_COUNTRY` before capture. |
| Live-disabled default | Source inspection, `.env.example`, route tests, and a production server started with live capture disabled and no credential. | PASS: capture and replay return `403`, remain `no-store`, and do not construct a provider client. |
| Replay ID | Route tests cover length, separators, encoded slash, query, and whitespace; production HTTP probe covers an invalid encoded identifier. | PASS: stable `400` / `unavailable`, `no-store`, before client construction. |
| Replay URL | Server route logic rejects non-string, overlong, non-HTTPS, credential-bearing, fragmented, and non-default-port URLs; route tests exercise the first three classes, while component tests exercise credentials, fragments, and ports before rendering a link. | PASS in route/component evidence. Provider replay readiness and a real replay URL were not exercised. |
| Response caching | Capture and replay route suites assert `Cache-Control: no-store` across normal failure/result branches; production probes cover failure branches, unsupported methods, and `OPTIONS`. | PASS after the invalid-method fix. |
| Provider error disclosure | Safe-error tests cover allowlisted internal codes, provider `401`, `403`, `429`, and `503`, timeout conversion, prototype-property rejection, and unknown exceptions. Replay tests cover provider failure. | PASS: client bodies contain only stable public categories/messages and omit upstream bodies. |
| Screenshot cap | Capture lifecycle test accepts exactly `1,500,000` binary bytes and rejects `1,500,001` before base64 encoding. | PASS. |
| Capture response cap | Client transport test rejects a streamed response at `3,000,001` bytes before the client timeout; response contracts bound every accepted field. | PASS. |
| Export privacy and cap | Export tests require two successes, retain only allowlisted evidence, remove URL credentials/query/fragment, omit screenshots/session IDs/replay URLs, accept exactly `262,144` UTF-8 bytes, and reject `262,145`. | PASS. |
| Cleanup and abort | Capture lifecycle tests cover launch/navigation/extraction/screenshot failures, browser-cleanup failure, bounded cleanup, late browser allocation, and safe late-cleanup logging. Replay tests close the client and fail closed on cleanup failure. Run-hook tests cover abort, replacement, unmount, stale callbacks, and retained transport ownership. | PASS in deterministic tests. Provider-console resource state is NOT PROVEN. |
| Credential logging | The client-construction test proves no console call while passing the server-only key directly to the one-attempt SDK constructor. Cleanup tests record only category and random request ID. Source inspection found no logging of key, session ID, replay URL, screenshot, page text, or provider body. | PASS in code/test evidence. Runtime provider logs were not inspected because no provider call occurred. |

## Local production route probes

The fresh production build was started twice on loopback: once with live mode
disabled and no credential, and once with live mode enabled using a non-secret
synthetic placeholder. The enabled-mode probes used only branches proven to
reject before provider client construction. No valid capture or replay request
was sent, so the probe spent zero Solari calls.

| Probe | Observed result |
| --- | --- |
| capture invalid method | `405`, empty body, exact `Allow`, `no-store` |
| capture `OPTIONS` | `204`, empty body, exact `Allow`, `no-store` |
| malformed capture JSON | `400` / `INVALID_INPUT`, `no-store` |
| 2,049-byte capture body | `413` / `INVALID_INPUT`, `no-store` |
| private capture URL | `400` / `PRIVATE_TARGET_BLOCKED`, `no-store` |
| unsupported capture country | `400` / `UNSUPPORTED_COUNTRY`, `no-store` |
| replay invalid method | `405`, empty body, exact `Allow`, `no-store` |
| replay `OPTIONS` | `204`, empty body, exact `Allow`, `no-store` |
| invalid replay ID | `400` / `unavailable`, `no-store` |
| capture and replay with live mode disabled | `403`, stable safe bodies, `no-store` |

Every probe asserted that the response contained no repository path, dependency
path, stack-frame shape, key-shaped value, or synthetic placeholder value.

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
| `npm run build` | PASS: static `/`; dynamic capture and replay routes |
| `npm run check:budget` | PASS: `151,540 B / 184,320 B` main-route gzip |

## Qualifications

- This review proves local source, deterministic tests, fresh built output, and
  loopback production-route behavior only.
- It does not prove live target behavior, provider infrastructure, replay
  readiness, provider-console cleanup, hosted/deployed headers, a Browser
  journey, E2E behavior, or assistive-technology behavior.
- No real credential was retrieved or used, and no Solari call occurred.
- Browser/E2E/live/provider work remains outside Task 5. Phase 5 was not
  started.
