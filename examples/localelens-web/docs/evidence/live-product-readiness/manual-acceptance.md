# LocaleLens Live Product Readiness manual acceptance

Run these steps from `examples/localelens-web/` with Node v22.22.2. Never paste
a provider key into chat, source, a committed file, a URL, a screenshot, or a
`NEXT_PUBLIC_*` variable.

The recorded live attempt on 2026-09-03 used DE, FR, GB, and US against
`https://example.com/`. Run `llr_eed03547-504d-438e-a37d-994f543ea30c`
settled in batches of three then one, but every market reported Solari
authentication unavailable. The dashboard stayed at 9 Browser sessions, so
that attempt proves the UI failure path and batching, not provider-session
correlation or replay readiness. Do not retry it without a new four-call
authorization.

## 1. Start sample mode safely

```sh
env -u SOLARI_API_KEY \
  NEXT_PUBLIC_APP_MODE=sample \
  LIVE_CAPTURE_ENABLED=false \
  npm run dev -- --hostname 127.0.0.1 --port 4322
```

Open the printed local URL. Sample mode cannot call the live route because the
server gate is false and no key is present.

## 2. Recognize demo truth

Confirm the form says `Demo data — this URL will not be visited.` It must show
the fixed target `regional.example.test`, the fixed US/GB/DE markets, and a
`Run featured demo` button. There must be no editable URL or market checkbox.

## 3. Start authorized live mode without displaying the key

Stop the sample server first. The owner-managed credential is stored as the
macOS generic-password item with service `com.localelens.solari` and account
`LocaleLens Production`. Retrieve it only through Security.framework and pass
it directly to the child process environment. The live evidence run used this
shape; it exits closed if the item is absent or empty and never prints the
value:

```sh
/usr/bin/swift -e '
import Foundation
import Security
let query: [CFString: Any] = [
  kSecClass: kSecClassGenericPassword,
  kSecAttrService: "com.localelens.solari",
  kSecAttrAccount: "LocaleLens Production",
  kSecReturnData: true,
  kSecMatchLimit: kSecMatchLimitOne
]
var item: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &item)
guard status == errSecSuccess,
      let data = item as? Data,
      let key = String(data: data, encoding: .utf8),
      !key.isEmpty else {
  FileHandle.standardError.write(Data("Credential unavailable in Keychain.\n".utf8))
  exit(2)
}
let task = Process()
task.executableURL = URL(fileURLWithPath: "/Users/billytompazis/.nvm/versions/node/v22.22.2/bin/npm")
task.arguments = ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "4323"]
task.currentDirectoryURL = URL(fileURLWithPath: "/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens/examples/localelens-web")
var environment = ProcessInfo.processInfo.environment
environment["PATH"] = "/Users/billytompazis/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin"
environment["NEXT_DIST_DIR"] = ".next-e2e"
environment["NEXT_PUBLIC_APP_MODE"] = "live"
environment["LIVE_CAPTURE_ENABLED"] = "true"
environment["SOLARI_API_KEY"] = key
task.environment = environment
try task.run()
task.waitUntilExit()
exit(task.terminationStatus)
'
```

The page must say `Live through Solari.` The key must never appear in the UI or
browser bundle. The wrapper keeps the key inside its process environment; it
does not export it into the invoking shell. Do not create, reveal, rotate,
rename, or replace the Keychain item as part of this checklist.

## 4. Select four or more markets and understand batching

Enter one public HTTPS URL. Select four markets. The product supports only the
15 listed, SDK-proved residential proxy codes. Three is the maximum concurrent
transport count, not the total selection limit. Four markets should display two
batches: three captures, then one. Do not interpret a listed market as a
guarantee that every target will render there.

## 5. Follow run states

Press `Compare live through Solari` once. Observe selected, queued, running,
completed, failed, current-batch, and total-batch values. Country rows advance
through launch, navigation, extraction, closing, and a terminal state. `Cancel
comparison` must stop later work and ignore stale completions.

## 6. Verify Solari provenance

Confirm the live label, record the displayed `llr_` application run ID, and
record each safe `sol_` country correlation shown for a success or correlated
failure. These are app-owned references; they are not raw provider session IDs.
Do not count sample results as provider evidence.

## 7. Retry one failed market

Use only that country row's explicit retry action. A retry preserves successful
siblings and makes one additional provider call. The four-call readiness proof
does not authorize that fifth call: obtain separate owner authorization first.
There is no automatic provider retry.

## 8. Read decisions before raw evidence

Read `What changed` first: evidence availability, routing, localization, and
consent. Then open `Screenshots and regional evidence` and `Detailed field
comparison` to inspect the underlying evidence. The summary is directional,
not a compliance verdict.

## 9. Check partial success

When at least two countries succeed and another fails, confirm the two
successful countries still have meaningful comparisons. The failed country is
reported separately. If fewer than two succeed, comparison rows must remain
honestly unavailable.

## 10. Cross-check the Solari dashboard

Record the Browser-session count immediately before and after the one UI run.
For the planned four-country run, it must increase by exactly four before that
count is treated as evidence. Match country, creation time, and duration. To
match a dashboard raw session ID to an app `sol_` reference without printing
the raw value, enter it hidden in a private terminal and hash it:

```sh
read -s "RAW_SESSION_ID?Dashboard session ID: "
printf '\n'
printf %s "$RAW_SESSION_ID" | shasum -a 256
unset RAW_SESSION_ID
```

The `sol_` value is the first 20 hexadecimal digest characters with the prefix.
Also cross-check the server's safe `session_registered` event for the recorded
`llr_` run ID and country. If the dashboard count does not increase, record the
actual delta and leave correlation unproved, as in the 9-to-9 authentication
failure above. Do not attribute Sandbox/VM activity to LocaleLens, and do not
claim correlation from timestamps alone.

## 11. Test mobile, reflow, and keyboard behavior

At 360 and 640 CSS pixels, confirm there is no page-level horizontal overflow,
the compact comparison is readable, and decision and export content is not
lost. With a keyboard, Tab through `How it works`, the primary action,
disclosures, table scroll region, download, and print. Each focused control
must have a visible outline. With a coarse pointer, interactive targets should
be at least 44 by 44 CSS pixels.

## 12. Stop safely

Press Control-C in the terminal that owns the wrapper. The Swift wrapper can
leave its npm child running, so verify the exact listener afterward:

```sh
lsof -nP -iTCP:4323 -sTCP:LISTEN
```

If a listener remains, inspect that literal PID and its parent chain with
`ps -p <PID> -o pid=,ppid=,command=`. Terminate only the exact LocaleLens
listener process after confirming its working directory is
`examples/localelens-web`; never use a wildcard, broad process-group kill, or
kill every Node process. Verify port 4323 has no listener before starting
another mode. Do not push, deploy, publish, submit, or release from this
checklist.
