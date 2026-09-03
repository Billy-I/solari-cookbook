# LocaleLens

LocaleLens compares one public HTTPS page across selected markets using live,
reviewable Solari browser evidence. Every user supplies their own Solari API key
through the visible masked connection form. LocaleLens has no shipped sample
mode and no server-owned credential fallback.

## Run locally

Use Node `v22.22.2` from this directory:

```sh
cd examples/localelens-web
nvm use 22.22.2
npm install
npm run dev
```

Open the local URL printed by Next.js. Obtain a key from
<https://console.getsolari.com/>. Solari displays a newly created key once, so
copy it when it is created and keep it private. Enter it only in LocaleLens's
visible password field, then press **Use my Solari key**. Never put a key in
chat, source, a file, a URL, a screenshot, an environment variable, or browser
developer tools.

## Connection lifecycle

The connect action makes one non-capture authentication request to Solari. On
success, LocaleLens clears the field and shows **Ready for this session**. The
raw key exists only in server-process memory behind a random HttpOnly,
SameSite=Strict session cookie; the cookie contains an opaque token, not the
key. The key is not written to local storage, session storage, IndexedDB, the
Cache API, analytics, telemetry, logs, exports, or committed evidence.

Credential sessions expire after 30 minutes without use or eight hours
absolutely. A server restart forgets every session. Browser restore may retain
an opaque session cookie while the restarted server has no matching key; the
next status check then returns to the disconnected state. **Disconnect**
deletes the credential session and every replay/capture reference owned by it,
then clears the cookie. Closing the exact server process also destroys all
in-memory keys.

This implementation supports one application process. Multi-instance hosting
would require a separately designed shared secret store and is not claimed.
Production use requires HTTPS so the session cookie can be Secure. Localhost is
the supported development exception.

## Capture and credit boundary

Enter one public HTTPS target and select two to five markets. Pressing
**Compare live through Solari** creates exactly one initial Solari browser
capture per selected country and may consume one unit of the user's Solari
credits per country. Authentication does not authorize a capture. LocaleLens
batches at most three captures concurrently and never retries automatically.
Each visible **Retry** action creates one additional capture and therefore
requires a separate spend decision.

`SOLARI_CAPTURE_DISABLED=true` is a server-side emergency disable-only switch.
It cannot enable capture, provide a key, or select a mode. Normal operation does
not require credential or mode environment variables.

## Recognize real results

A run begins only after the visible compare action and receives an `llr_`
application run ID. Successful country cards say **Live evidence** and show the
requested/final URL, capture time, bounded screenshot, normalized evidence,
proxy-country receipt, and an app-owned `sol_` correlation reference when one
is available. Reports use schema version 3 and
`"provenance": "live_solari"`. There is no fixture fallback.

Failures remain failures. Safe UI categories include invalid authentication,
temporary authentication or provider unavailability, capacity, timeout,
proxy-country mismatch, invalid target/response, and generic capture failure.
Provider bodies, raw provider session IDs, credentials, cookies, and request
headers are not shown. Partial evidence remains reviewable when at least two
countries succeed.

## Safe stopping

Before a live run, record the exact public URL, selected country names/codes,
and initial capture count. Press compare once only after approving that count.
Do not press retry without approving the additional call. When finished, press
**Disconnect**, stop the exact terminal-owned server process, and verify its
literal port has no listener before starting another server. Do not use broad
process termination commands.

## Architecture and boundaries

```mermaid
flowchart LR
    U[User] -->|masked key form| A[Session route]
    A -->|one authentication request| S[Solari]
    A -->|opaque HttpOnly cookie| B[Browser]
    B -->|one POST per selected country| C[Capture route]
    C -->|in-memory user credential| S
    S --> P[Public HTTPS target]
    P --> E[Bounded evidence extractor]
    E --> B
    C -->|owned safe reference| R[Replay route]
```

Targets reject credentials, fragments, non-default ports, local/private hosts,
and unsafe DNS results. Capture and replay requests require the opaque local
session, custom request header, same-origin checks, bounded bodies, and strict
response contracts. Session ownership prevents one connected browser from
reading another browser's run references.

Historical sample artifacts remain only in archived documentation and governed
evidence. Current unit tests use test-only factories, and Playwright installs a
browser-route double exclusively under `e2e/`; neither is imported by production
source or emitted into the production bundle.

## Verification

Run the credential-free gate from this directory:

```sh
node --version
npm test
npm run typecheck
npm run lint
SOLARI_API_KEY=synthetic-secret-build-canary npm run build
npm run check:budget
npm run check:api-methods
npm run check:production-boundaries
npm run test:e2e
```

The synthetic build canary is deliberately not a usable key. The build and
boundary checks prove that even this sentinel cannot become a runtime fallback
or leak into client/static or rendered server output. Playwright evidence uses
only synthetic `.test` responses and does not prove the live Solari provider,
dashboard, hosted deployment, or direct assistive-technology behavior.

See [manual acceptance](docs/evidence/live-product-readiness/manual-acceptance.md)
and the [BYOK live-only evidence report](docs/evidence/byok-live-only.md).
