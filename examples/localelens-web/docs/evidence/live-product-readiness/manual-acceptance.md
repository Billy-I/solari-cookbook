# LocaleLens user-owned Solari key manual acceptance

This procedure is for one owner-authorized local live acceptance. It does not
authorize deployment, release, a pull request, or any capture beyond the exact
count approved at action time. Use Node `v22.22.2` and never expose a real key
in chat, a terminal, an environment variable, a file, a URL, a screenshot,
logs, request inspection, browser storage inspection, or committed evidence.

## 1. Pass the complete credential-free gate

From `examples/localelens-web/`, run:

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

Require Node `v22.22.2` and a pass from every command. The value used for the
build is a non-secret sentinel that verifies there is no environment fallback.
If any command fails, stop. Live acceptance is `NOT RUN`.

## 2. Start one exact server

Choose one localhost port only after confirming it has no listener:

```sh
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
npm run dev -- --hostname 127.0.0.1 --port <PORT>
```

Use the normal command with no key, mode, or enable flag. Record the literal
port, server PID, parent PID, command, and working directory. Do not reuse an
unverified listener or start a second server.

## 3. Inspect the disconnected UI in the in-app Browser

Open the exact local URL in the named in-app Browser. Before entering a key,
verify at 1440×900, 640×720, and 360×800:

- **Solari connection** guidance and the external key link are visible.
- **Solari API key** is a password field.
- URL and market inputs are usable, but **Compare live through Solari** is
  disabled.
- There are no sample/demo results, fixture hosts, receipts, regional results,
  or export actions.
- Keyboard focus is visible, layout reflows without horizontal overflow, and
  the browser console has no errors.

Do not enter any key and do not start a capture during this inspection.

## 4. Hand off visible key entry to the owner

The owner takes control of the visible Browser, enters their own key into the
masked field, and presses **Use my Solari key**. The operator must not type,
paste, read, copy, inspect, or automate the key. Do not inspect cookies, local
storage, password managers, headers, payloads, or developer tools after
handback.

Record the single connection action separately from capture calls. Confirm only
that the UI says **Ready for this session**, the password field no longer
echoes anything, and comparison is enabled. Authentication does not authorize
a capture.

## 5. State and approve the exact spend proposal

Before pressing compare, state all of the following in one approval request:

- the exact public HTTPS target URL;
- every selected country code and country name;
- the exact number of initial captures, equal to the selected-country count;
- that each country starts one Solari browser capture and may consume the
  owner's Solari credits;
- that no retry is included.

Wait for explicit action-time approval of that exact target, selection, and
count. A prior plan approval, successful authentication, or general permission
to test is not capture approval.

## 6. Run only through the visible UI

After approval, press **Compare live through Solari** exactly once in the
in-app Browser. Do not call capture or replay routes with curl, scripts, tests,
developer tools, or direct HTTP clients. Observe batches of no more than three,
the cancel action while work is pending, and one terminal success or honest
failure per selected country. There must be no fixture fallback.

Record the exact initial capture count. If a retryable failure appears, report
the failed country and current count, then request separate approval for one
additional capture. Press that country's **Retry** button only after approval.
Never retry automatically or silently.

## 7. Verify result and dashboard truth

Successful cards must say **Live evidence** and show real capture timestamps,
final URLs, screenshots, and safe app-owned correlation references. Failed
cards must remain failures. A partial result is valid only when successful
siblings remain reviewable; it is not a complete-provider claim.

In the Solari console, compare the owner-visible Browser session count before
and after the approved action. The expected delta is the exact initial capture
count plus separately approved retries. Correlate only safe country and time
facts. Do not record or expose raw provider session IDs, profile data, key
material, cookies, request headers, or payloads. If the delta or safe facts do
not agree, record the actual observation and mark dashboard correlation
`NOT PROVEN`.

## 8. Disconnect and stop the exact process

Press **Disconnect** in LocaleLens. Confirm the password form returns and the
compare action is blocked. A status refresh must report the local credential
session as missing, and prior replay/capture references must no longer be
available to that browser session.

Stop the exact terminal-owned server process, then verify:

```sh
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
```

If a listener remains, inspect only that literal PID and parent chain with
`ps -p <PID> -o pid=,ppid=,command=` and confirm its working directory before
terminating it. Do not use wildcards, process-name killing, broad process-group
termination, or commands that affect unrelated Node processes. Record the
empty listener check as server-shutdown proof.

## 9. Record evidence and stop

Record authentication-request count, initial capture count, separately
approved retry count, each country outcome, dashboard delta/result, UI
disconnect proof, exact-process shutdown proof, protected-path status, and any
remaining risk. Do not include secrets or raw provider identifiers.

Commit final evidence and push the approved branch once only after all required
checks and live acceptance are complete. Do not open a PR, merge, deploy,
release, inspect hosted CI, or modify repository settings.
