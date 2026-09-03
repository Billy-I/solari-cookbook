# LocaleLens User-Owned Solari Keys — Live Only Design

**Status:** Approved for implementation planning

**Date:** 2026-09-03

**Base:** `origin/codex/localelens-live-product-readiness` at `bfe73564786ba7d1a65f43d595e83d7a26530ebf`

**Branch:** `codex/localelens-byok-live-only`

**Audience:** Product owner, implementation agents, security reviewers, and evidence reviewers

**Authorization boundary:** This phase authorizes the design, RED-first implementation, local verification, owner-controlled visible-UI live acceptance, small commits, and a final push of this branch after every required gate passes. It does not authorize a pull request, merge, deployment, release, or hosted-CI inspection.

## 1. Product decision

LocaleLens is a live-only regional comparison application. Every comparison shown to a real user must result from a real Solari capture that the user explicitly starts through the visible interface and that uses that user's own temporary Solari API key.

The shipped application has no sample mode, demo mode, mock comparison, fixture-backed result, featured sample, sample/live switch, or owner-managed credential fallback. Normal `npm run dev` and every production build run the same live-only product.

Automated tests may use synthetic data and SDK doubles only inside test files or the test runner. Test data is never imported by production modules, copied into the public application assets, presented as provider evidence, or described as a real Solari result.

Truthful historical sample evidence from completed phases remains in historical evidence and phase documents. Current product documentation states that sample mode is historical and no longer part of the application.

### Success criteria

A user can:

1. Understand that captures use their own Solari account and may consume their credits.
2. Follow an official link to obtain a Solari API key and understand that a new key is shown once.
3. Enter a key in a masked field, explicitly submit it, and receive an honest connection state.
4. Know that the key is temporary and not saved to persistent storage.
5. Add, use, and remove the key without the application displaying any key substring.
6. Start a comparison only after the credential session is ready.
7. Receive only real provider results or an honest, redacted failure.
8. Cancel work, retry one failed country explicitly, and retain safe partial results without automatic provider retries.

## 2. Current-state findings

The accepted base currently:

- imports `src/test/fixtures` from the production page and comparison hook;
- renders featured fixture results before a run;
- selects sample or live behavior through `NEXT_PUBLIC_APP_MODE`;
- requires an owner-provided `process.env.SOLARI_API_KEY` in capture and replay routes;
- requires `LIVE_CAPTURE_ENABLED=true` for live calls;
- stores provider-session correlations in a process-global registry without a user credential-session owner;
- runs Playwright against sample mode and asserts zero provider routes;
- documents owner-controlled Keychain/environment startup.

Those behaviors conflict with the live-only, user-owned credential decision and must be removed or migrated without weakening the existing capture safety boundaries.

The installed `@solarisdk/browser` version accepts an API key explicitly and exposes an authenticated `GET /profiles` request. Creating a client does not authenticate, so field presence or client construction cannot produce a ready state. The design uses an explicit, read-only provider request to authenticate without creating a browser session.

## 3. Architectures considered

### Selected: server-memory credential session with an opaque HttpOnly cookie

The browser sends the key once after the user presses **Use my Solari key**. The server validates it and stores it only in process memory. A random opaque token in an HttpOnly session cookie references the entry. Capture and replay routes resolve the current user's key through that token.

Advantages:

- the key leaves browser memory after the connection request;
- subsequent capture and replay requests do not retransmit it in JavaScript-visible payloads;
- an HttpOnly cookie prevents application JavaScript from reading the session token;
- server-side ownership can bind credential, capture, and replay state to one user;
- no account system, database, vault, or dependency is required.

Constraint: the supported runtime is one long-lived Node process. A serverless or horizontally scaled deployment without sticky routing or shared state is unsupported and must not be claimed safe.

### Rejected: browser-memory credential sent with explicit capture requests

Keeping the key in React memory would support stateless server instances, but every capture, retry, and replay request would expose the credential again to browser JavaScript and request construction. It would also make refresh recovery impossible and increase the chance of accidental serialization, logging, or developer-tool exposure. This is a larger credential surface than the selected approach.

### Rejected: encrypted persistent vault

A vault could support distributed deployments and durable sessions, but it requires user identity, encryption-key custody, storage access control, rotation, deletion, recovery, and breach handling. The repository has no account or persistence architecture. Adding those systems would exceed this phase and the smallest secure solution.

## 4. Supported deployment contract

This phase supports:

- local development through the normal Next.js command; and
- a hosted application running exactly one long-lived Node instance behind HTTPS.

This phase does not support:

- serverless functions whose instances do not share process memory;
- multiple application replicas without guaranteed sticky routing;
- process restarts that preserve credential sessions; or
- a CDN or proxy that serves credential endpoints over plain HTTP.

Production credential and capture endpoints fail closed unless the request is HTTPS directly or through a trusted forwarded-protocol header. Documentation must state that deploying more than one instance requires a separately designed shared credential service or encrypted vault. No runtime flag may silently pretend that process-local storage is distributed.

The selected approach intentionally treats a server restart as a global credential disconnect. Users reconnect with their own keys afterward.

## 5. Credential-session architecture

### Server store

A server-only credential-session module owns a process-local `Map`. It is reachable only from Node route modules and server-side capture helpers.

Each entry contains:

- the complete API key;
- creation time;
- last-use time; and
- absolute expiry time.

The raw cookie token is not stored. On connection, the server generates at least 256 bits of cryptographically secure randomness, returns the base64url token only in the Set-Cookie header, and indexes the map by a SHA-256 digest of the token. Token comparison and lookup never use user-controlled prefixes.

Entries expire after:

- 30 minutes without an authorized status, capture, or replay request; or
- eight hours after creation, regardless of activity.

Expired entries are deleted on every store operation. The store also has a conservative maximum-entry bound and evicts expired entries before refusing additional sessions. It must not evict an active user's credential merely to admit another user; saturation fails closed with a safe temporary-unavailable response.

### Cookie

The credential-session cookie:

- contains only the opaque random token;
- is `HttpOnly`;
- is `SameSite=Strict`;
- is scoped to `Path=/`;
- has no `Domain` attribute;
- has no persistent `Expires` or `Max-Age`, so it is a browser-session cookie;
- is `Secure` in hosted production; and
- uses a neutral name that does not include a credential value or provider identifier.

Local HTTP development may omit `Secure`; production may not. Cookie contents are never copied into application logs, responses, exports, UI text, analytics, or telemetry.

### Credential lifecycle endpoints

`POST /api/solari-session` connects a key:

1. Validate same-origin request metadata, JSON content type, and bounded body size.
2. Parse one bounded `apiKey` string without normalizing, trimming into a second long-lived copy, or logging it.
3. Create a Solari client with the submitted key and `maxAttempts: 1`.
4. Perform one authenticated `GET /profiles` request only after the button action.
5. Inspect only the HTTP status needed to classify the result, cancel or discard the response body, and close the client.
6. On success, create the process-memory entry and set a newly rotated opaque cookie.
7. On failure, store nothing, clear any prior credential session, and return only a safe category.

The authentication probe does not create a browser session and therefore is not a capture. It must not enumerate, render, log, or return profile data. There is no automatic retry.

`GET /api/solari-session` restores connection state after a page refresh. It returns only `{ status: "ready" }` or `{ status: "missing" }`. It never returns timestamps, token data, key metadata, account details, profile details, or a key fingerprint. An expired lookup deletes the entry and clears the cookie.

`DELETE /api/solari-session` disconnects. It deletes the current entry, invalidates every provider-session correlation owned by it, clears the cookie, and returns an empty success response. Repeating disconnect is safe and idempotent.

Every credential-session response uses `Cache-Control: private, no-store` and equivalent anti-caching headers where useful.

### Browser and server limitations

Before submission, the key necessarily exists in the password input and React/browser memory. Browser extensions, compromised same-origin scripts, developer tools, or an already-compromised device may observe it. The application clears the controlled input immediately after constructing the explicit connection request and never restores it after failure.

Browser-session termination normally removes a session cookie, but browsers may restore sessions after a crash or through session-restore features. The server cannot reliably receive a disconnect event when a tab or browser closes. Abandoned server entries therefore remain until the 30-minute idle or eight-hour absolute expiry. Documentation states these limitations plainly.

## 6. Request security and CSRF controls

Credential-changing and credential-using endpoints accept only requests from the application origin.

Shared request guards enforce:

- exact `Origin` equality with the normalized application request origin for credential POST/DELETE and capture POST;
- an expected custom request header on credential status, connect, disconnect, capture, and replay fetches;
- `Sec-Fetch-Site` of `same-origin` when the browser provides it;
- bounded bodies and strict schemas;
- no wildcard CORS or reflected arbitrary origins;
- method allowlists with safe 405 responses; and
- `private, no-store` responses.

The cookie's `SameSite=Strict` attribute is defense in depth, not the only CSRF control. A request rejected by the origin guard does not read, create, rotate, touch, or delete a credential entry.

For hosted production, forwarded host and protocol values are trusted only under the documented single-instance reverse-proxy deployment. Ambiguous or conflicting origin/protocol headers fail closed.

## 7. Solari client and provider-error boundary

`createSolariClient` changes from reading `process.env.SOLARI_API_KEY` to requiring an explicit non-empty API-key argument. No overload, optional parameter, test fallback, environment fallback, Keychain path, or global mutable credential is retained.

Only server-side credential authentication, capture, and replay code may pass a key to the Solari constructor. Tests inject SDK doubles directly at existing dependency boundaries; production code never imports a test double.

Every client uses `maxAttempts: 1`. Capture launch keeps `retries: 0`. A provider failure therefore causes no automatic authentication, capture, replay, or transport retry.

Provider errors are reduced to existing or new allowlisted public categories. The browser never receives provider response bodies, stack traces, request headers, URLs containing credentials, raw session identifiers, account information, or any key substring. Server logs receive only allowlisted lifecycle categories and application-owned identifiers.

A provider 401/403 that means the key no longer authorizes the operation invalidates the credential session and returns an authentication failure. Provider availability, capacity, timeout, target, proxy, navigation, and extraction failures remain distinct where the current safe boundary can prove the category.

## 8. Per-user capture and replay ownership

Capture and replay routes resolve the current credential session before provider work. Missing, expired, malformed, or unknown tokens fail closed without calling Solari.

The process-local run-session registry extends each record with an internal credential-session owner identifier derived from the current opaque-session digest. Registration binds:

```text
credential owner + run ID + country + attempt
    -> raw provider session ID + safe session reference + timestamps
```

Lookup requires the same credential owner plus the existing run ID, country, attempt, and safe session reference. A different user receives an unavailable response and causes zero provider calls. Disconnect removes that owner's registry entries. Credential expiry makes them unreachable even if their normal one-hour registry TTL has not elapsed.

Raw provider session IDs remain server-only. Safe `sol_` references and app-owned `llr_` run IDs may appear in live receipts, but neither authorizes access without the correct credential-session cookie.

## 9. Live-only client experience

### Connection section

The page adds a clearly labelled **Solari connection** section before the comparison form. It includes:

- a password input with an accessible visible label and browser-autocomplete behavior chosen to avoid unintended password-manager persistence where enforceable;
- a primary **Use my Solari key** button;
- a **Remove key** or **Disconnect** action when connected;
- a link labelled **Get a Solari API key** to `https://console.getsolari.com/`;
- an optional **Solari quickstart** link to `https://docs.getsolari.com/quickstart`;
- safe new-tab attributes (`target="_blank"` and `rel="noopener noreferrer"`);
- text stating that captures use the user's Solari account and may consume their credits;
- text stating that the key is temporary and not saved; and
- text warning that Solari shows a newly created key once, so the user should copy it at creation and keep it private.

### States

The connection state machine is:

- **No key:** no usable credential session; comparison controls are disabled.
- **Key entered:** input is non-empty, but no authentication claim is made and no request has occurred.
- **Authenticating:** begins only after the user presses the connection button; the button and input cannot submit twice.
- **Authentication failed:** safe, redacted guidance; no key is retained and no results are created.
- **Ready for this session:** server authentication succeeded and the opaque session is active.

The UI never says **verified** merely because text exists. It never displays key length, prefix, suffix, fingerprint, masked characters derived from the submitted value, or any other echo. The password field may show browser-native masking while the user types, then becomes empty immediately after submission begins.

### Comparison behavior

The URL and market controls remain visible but the comparison action is disabled until the connection state is ready. Attempting submission through keyboard or programmatic form behavior while disconnected causes zero capture requests and moves focus to useful connection guidance.

Every comparison remains an explicit button action. Connection, paste, page load, refresh, market selection, and URL edits never start a capture. The comparison confirmation text states that the selected number of markets creates that many initial Solari captures and may consume credits.

If the credential expires or becomes invalid, the current operation fails honestly, the connection state returns to missing or failed, and the UI shows no fixture fallback. Already completed real results may remain visibly labelled as results from the prior live run, but no synthetic result may fill a missing country.

## 10. Removal of shipped sample behavior

Production changes remove:

- `NEXT_PUBLIC_APP_MODE` from application code, build commands, Playwright server configuration, and current documentation;
- all sample/live conditional rendering and mode-specific component props;
- fixture imports from `app/`, production `src/components/`, and production `src/features/`;
- the sample execution branch from `useComparisonRun`;
- the standalone sample-run hook and its production path;
- featured sample results and the fixed demo action;
- runtime/public fixture images that exist only to serve sample results; and
- current README instructions that describe sample mode as shipped behavior.

Test fixtures remain under test-only paths when they support unit or component tests. Test files may import them. Production modules may not.

Live report/export contracts use a literal live provenance value rather than a sample/live branch. Exports contain captured evidence only and keep the existing exclusions for credentials, response headers, raw provider session IDs, replay URLs, query strings, fragments, screenshot payloads, and unsafe page text.

Historical phase evidence, accepted screenshots, and archived descriptions are retained. They are not linked or described as the current product journey except where documentation explains the historical transition.

## 11. Operator kill switch

The owner credential gate is removed. A narrow emergency switch may remain only to disable capture globally.

Normal `npm run dev` and a normal production build do not require a mode variable and expose the live-only UI. If an emergency-disable variable is used, its disabled value makes capture and replay fail closed with honest guidance. It never enables sample data, selects a different UI, injects credentials, or changes test doubles.

The implementation plan must choose one clearly named disable-only variable and remove the previous `LIVE_CAPTURE_ENABLED=true` startup requirement so the normal command is usable with a user-supplied key.

## 12. Tests and evidence strategy

Implementation is RED-first. Each behavior change begins with a focused failing test that demonstrates the old unsafe or sample-backed behavior, followed by the smallest production change that passes it.

### Credential store and routes

Tests prove:

- connect authenticates only after explicit POST;
- constructor-only or non-empty input never produces ready;
- valid authentication stores the key only in the isolated server store;
- failed authentication stores nothing and clears any previous session;
- responses, errors, and intercepted logs contain neither the key nor any substring chosen as a canary;
- status returns only ready or missing;
- disconnect and both expiry limits invalidate the credential;
- two users receive distinct tokens and cannot resolve each other's keys;
- store saturation fails closed;
- cross-origin, malformed, oversized, wrong-content-type, and unsupported-method requests make zero provider calls;
- credential responses are no-store and cookies have the required attributes; and
- production HTTPS enforcement fails closed while local development remains usable.

### Capture and replay

Tests prove:

- capture without a credential makes zero provider calls;
- the resolved key reaches only the authorized server-side Solari client constructor;
- `process.env.SOLARI_API_KEY` is ignored even when populated with a canary;
- one user's credential cannot authorize another user's run or replay;
- authentication failure invalidates the credential and returns no result;
- existing concurrency, deterministic batching, cancellation, stale-response, SSRF/DNS/redirect/final-URL, bounded evidence, cleanup, and explicit retry tests remain green;
- no provider operation automatically retries; and
- replay lookup preserves owner binding and raw-session secrecy.

### UI and production boundary

Tests prove:

- the default page is live-only;
- no sample/demo/mode-switch control or featured fixture result is visible;
- comparison is blocked before readiness;
- pasting or typing a key creates no capture and no authentication request;
- the connection button creates one authentication request and no capture request;
- invalid authentication displays safe guidance and no results;
- links are keyboard accessible and use safe new-tab attributes;
- disconnect restores the blocked state;
- production modules do not import test fixtures or sample hooks;
- the browser bundle contains no credential canary, environment fallback, credential-store code, or server-only Solari client implementation;
- JSON/HTML/print output contains no key or key-derived substring; and
- desktop, mobile/reflow, keyboard, focus, coarse-pointer, reduced-motion, and automated accessibility behavior remain correct.

Playwright may intercept the application's endpoints or use runner-owned synthetic doubles. Such responses use unmistakably synthetic `.test` values, remain inside test code, are never committed as provider evidence, and are not used during live acceptance.

## 13. Required verification

Run from `examples/localelens-web/` with Node v22.22.2 explicitly pinned:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run check:budget
npm run check:api-methods
npm run test:e2e
```

Also run:

- `git diff --check`;
- a production-import scan for fixtures, sample hooks, mode variables, and environment-key fallbacks;
- scoped secret scans using synthetic canaries rather than real keys;
- generated public-bundle scans for canaries and credential-bearing server code;
- a changed-file and staged-file audit proving protected/generated paths were not staged; and
- Browser-based desktop and mobile inspection before live acceptance.

Any failed credential-free gate blocks live acceptance. Missing evidence is `NOT PROVEN`; it is not replaced with fixture, component, or browser evidence.

## 14. Live acceptance boundary

After every credential-free check passes:

1. Start the app through its normal live-only command on one exact local port.
2. Open it in the visible browser UI.
3. Hand control to the owner to enter their own key into the masked field. The key is never requested or entered through chat, terminal, environment variables, source, files, logs, screenshots, or automation.
4. Confirm ready state without exposing the key.
5. State the exact public target and selected markets, translate that selection into an exact initial capture count, and obtain owner approval immediately before spending credits.
6. Start the comparison only through the visible UI. Do not call capture routes through scripts, curl, tests, or developer tools.
7. Record only actual provider results or honest failures and the exact provider-call count.
8. Inspect the Solari dashboard for the expected user-owned session count and safe country/time correlation without exposing credentials or raw session IDs.
9. Disconnect through the UI and confirm the application returns to the blocked state.
10. Stop only the exact local server process after verifying its PID, command, working directory, and listener port.

Authentication through `GET /profiles` is a provider request but not a browser capture. Evidence reports count it separately from billable capture calls.

## 15. Documentation changes

Update the current README and manual acceptance instructions with:

- the normal live-only startup command;
- the single-instance and HTTPS deployment constraint;
- how to obtain a key from the Solari console;
- how to add and remove it safely;
- the one-time key-display warning;
- what exists transiently in browser and server memory;
- what is never stored;
- idle, absolute, restart, disconnect, and browser-close behavior;
- how capture count and Solari billing relate;
- how to recognize live results;
- authentication, target, proxy, timeout, navigation, extraction, capacity, and emergency-disable failures;
- safe server shutdown; and
- the distinction between test-only doubles, historical sample evidence, browser evidence, and live provider evidence.

Do not rewrite completed historical evidence to imply that past sample or failed-auth runs were live successes.

## 16. Git checkpoints and stop conditions

Implementation uses small verified commits. Before every commit:

- inspect the diff;
- run the narrow relevant tests;
- stage only explicit task paths;
- confirm that `examples/localelens-web/next-env.d.ts`, `examples/localelens-web/test-results/`, `examples/localelens-web/AGENTS.md`, and `examples/localelens-web/CLAUDE.md` remain unstaged and are not deleted; and
- run `git diff --cached --check`.

Do not push intermediate checkpoints unless separately requested. After all non-live gates and the separately authorized live acceptance pass, push only `codex/localelens-byok-live-only`, then verify local HEAD, upstream tracking SHA, and `git ls-remote` SHA parity.

Do not open a pull request, merge, deploy, release, inspect hosted CI, rotate credentials, create API keys, or alter remote/repository settings.

If live acceptance cannot run or does not pass, report the exact state and keep the provider claim `NOT PROVEN`; do not manufacture a passing result or push a branch that the phase requires to include authorized live acceptance.
