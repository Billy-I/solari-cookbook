# LocaleLens release checklist

## Decision

- Local release-candidate freeze: **DONE WITH CONCERNS**.
- Deterministic sample-mode technical gate: **PASS with the evidence boundaries below**.
- Public push, deployment, submission, and posting: **BLOCKED / NOT AUTHORIZED**.
- Task 4 started: **false**.

This file freezes the locally verified candidate. It does not grant release
authority. Public action remains blocked by pending owner approvals, the two
unresolved draft URL fields, absent hosted/deployed evidence, and the tracked
local-path privacy finding recorded below.

## Exact lineage and scope

| Item | Exact value |
| --- | --- |
| Branch | `codex/localelens-phase-5-submission` |
| Exact upstream cookbook base and merge base | `d304843f5ea0edb5c27829bb2ca30868645bef7a` |
| Accepted Phase 4 predecessor | `ec05f42bfadce32a406ffd1e883c03582aacfb90` |
| Phase 5 Task 1 commit | `acaf4949d3e97a2661856676a3e3130e1df6087b` |
| Phase 5 Task 1 correction | `e4502bf1522a6aec6855c1c8a3965d64a8f477b7` |
| Phase 5 Task 2 commit | `bd07cdb66f6f2f4540cd03fd76aca55432e85666` |
| Pre-checklist release-candidate content SHA | `bd07cdb66f6f2f4540cd03fd76aca55432e85666` |
| Checklist-commit SHA | Resolved by Git after commit and reported externally; a commit cannot embed its own SHA. |

The exact base-to-candidate range contains 57 commits. The full range
`d304843f5ea0edb5c27829bb2ca30868645bef7a..bd07cdb66f6f2f4540cd03fd76aca55432e85666`
was inspected commit-by-commit and as one complete public diff. It contains 114
paths: root `README.md`, `design-qa.md`, 27 paths under `docs/`, and 85 paths
under `examples/localelens-web/`; no path falls outside those scopes. The diff
has 22,663 additions, no deletions, and 16 binary assets. Its complete binary
diff stream was 7,896,927 bytes / 128,784 lines with SHA-256
`f50f163369216aafb8e54b193334a1cf81f5d9fd23307fac82a87f23e256e387`.
`git diff --check` passed for both the committed range and the current
worktree.

## Runtime and command gate

All Node commands used the owner-required explicit Node binary (`node
v22.22.2`, `npm 10.9.7`) and ran with `SOLARI_API_KEY` unset plus
`NEXT_PUBLIC_APP_MODE=sample` and `LIVE_CAPTURE_ENABLED=false` explicit. Git
checks used the owner-required explicit fallback binary (`git version 2.53.0`).

| Fresh command from `examples/localelens-web/` | Result |
| --- | --- |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm test` | PASS: 23 files, 234 tests |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run typecheck` | PASS |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run lint` | PASS |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run build` | PASS: optimized production build; static `/`, dynamic capture/replay routes, Proxy included |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run check:budget` | PASS: 151,504 B / 184,320 B main-route gzip |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run check:api-methods` | PASS for app-reachable cases; `TRACE` remains NOT PROVEN on both API routes because Next rejects it before Proxy |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm run test:e2e` | PASS: 11/11 local Chromium sample tests |
| `env -u SOLARI_API_KEY NEXT_PUBLIC_APP_MODE=sample LIVE_CAPTURE_ENABLED=false npm ls --depth=0` | Exit 0; two extraneous local dependency artifacts reported: `@emnapi/runtime` and `@img/sharp-wasm32`; this is not promoted into a clean-install claim |

The sample Playwright comparison explicitly passed its no-provider-request
assertion. The fresh in-app Browser server log contained only `GET / 200`, with
no capture or replay request. Therefore this Task 3 gate spent zero Solari
capture/replay calls and used no credential. After verification, listener and
process checks found zero Node/Next/Playwright listeners and zero matching
LocaleLens server processes.

## Browser and media evidence

Fresh in-app Browser evidence at the pre-checklist candidate used a local
sample/live-disabled server. At a 1440x900 viewport, the document client and
scroll widths were both 1425 px, so there was no document-level horizontal
overflow. Selecting Germany alongside the default US/GB markets completed the
three-country sample journey and displayed `Sample evidence`, a complete 3/3
receipt, three regional screenshots, the semantic differences table, and
enabled JSON/print actions. Browser console warning/error entries were zero.

Browser JSON download is **NOT PROVEN** because the integration's download
hook timed out after the click. Browser print invocation was not attempted and
is **NOT PROVEN**. The passing Playwright export and print assertions remain a
separate automated evidence class and are not promoted into Browser evidence.

`public/social-card.png` is the byte-reproducible deterministic resize/padding
composition from `docs/design/evidence/phase-1-shell-1440x900.jpg`. A fresh
recomposition was byte-identical. The committed file is an exactly 1200x630,
8-bit RGB PNG with SHA-256
`6127ef483e4f0702f45a06dcd1906aa221bae9072d360911a83ffa43ade762d0`.
Distinct actual-size inspections remain recorded separately:

- In-app Browser: natural, rendered, body, and viewport dimensions were all
  1200x630; the full name and three regional columns were visible without
  clipping.
- macOS Preview with Actual Size active: the name, headline, sample receipt,
  and US/GB/DE columns were readable and safely framed.

The card also retains the source capture's Next development badge and browser
scrollbar. Those development-chrome elements must be removed and the card
regenerated before any separately authorized publication; this task does not
alter the PNG.

## Privacy and content inspection

Value-bearing scans reported counts and affected relative filenames only; no
matched value was printed. Safe source/schema variable names were not treated
as populated credentials.

### Tracked tree, history, and full public diff

- Pre-checklist candidate inventory: 152 tracked files inspected (136 text, 16 binary),
  6,477,383 bytes.
- Terminal inventory after the checklist commit: 153 tracked files. Fix round
  1 changes this checklist in place and adds no tracked path.
- Every one of the 57 branch commit patches was inspected (134,866 lines,
  8,150,859 bytes), as was the complete combined public diff.
- Realistic `slr_(live|test)_...` values: **0** in the tracked tree, candidate
  public paths, every commit patch, complete public diff, and 16 binary assets.
- Non-placeholder/credential-bearing line-start `SOLARI_API_KEY` assignments:
  **0**. Twelve line-start assignments in the complete repository were
  inspected: upstream `.env.example` placeholders plus one lower-case,
  hyphenated, non-provider-token design-spec example. None matches the
  realistic Solari value grammar.
- Populated `NEXT_PUBLIC_*KEY|SECRET|TOKEN` assignments: **0** in tracked tree,
  candidate paths, history, diff, assets, and fresh output.
- Browser storage references: **0** in LocaleLens candidate paths and branch
  history. References in two inherited upstream browser-profile files are
  unrelated existing cookbook material, not LocaleLens behavior.
- Draft `TODO`/`FIXME`/`TBD` markers: **0** in LocaleLens candidate paths and
  history.
- Raw-provider-payload term matches: **0** in candidate paths.
- Candidate literal session-value assignments: 13, confined to five named
  route/component/capture/compare/contract test files. Literal replay URLs: 13,
  confined to three named route/component/export test files. These are test
  fixtures; production exports and committed evidence omit session IDs and
  replay URLs.
- Candidate email-like literals: 5 across root `README.md` and three test
  files; only three occur in the added public diff and all three are test
  fixtures. No email-like literal occurs in submission/public assets.

#### Blocking tracked/history local-path finding

The terminal current tree retains a privacy limitation: 10 absolute local
provenance lines occur across eight documentation files. Seven volume-root
references occur once each in:

- `docs/PHASE_2_START_PROMPT.md`
- `docs/evidence/localelens-phase-0.md`
- `docs/evidence/localelens-phase-1.md`
- `examples/localelens-web/docs/evidence/phase-2.md`
- `examples/localelens-web/docs/evidence/phase-3.md`
- `examples/localelens-web/docs/evidence/phase-4.md`
- `examples/localelens-web/docs/evidence/security-review.md`

Three user-home references occur in `docs/START_PROMPT.md`. These strings are
non-secret development provenance, not credentials, but they disclose local
path context in the current public tree and immutable history. Earlier
checklist commits `61143f8dfc6998af57e59b65f49e64f7cd2b2295` and
`e1adce46b8ee61e12668ecc4841856ac65c50dc7` also added absolute local
runtime/Git path literals to immutable branch history. Any separately
authorized public-history remediation must include those commits as well as
the eight current-tree documents; this task does not rewrite history. Owner
review or separately authorized remediation is required before treating the
candidate as privacy-clean. The zero generic `TODO`/`FIXME`/`TBD` result above
does not neutralize this distinct finding.

### Assets, ignored artifacts, and fresh build

- All 16 tracked binary screenshots/assets were scanned for realistic provider
  values, server/public secret names, local paths, replay URLs, bearer-like
  values, and email-like literals: **0** findings.
- The seven pre-checklist submission/public assets (three submission documents
  and four public images) had **0** findings across the scanned categories.
  The release checklist is an eighth terminal artifact and intentionally names
  secret-variable and local-path categories. Across all eight terminal
  submission/public artifacts there are **0** realistic credential values and
  **0** populated public-secret assignments; category-name mentions are not
  claimed as zero.
- Fresh production output excluding caches and old dev output had **0**
  realistic provider values, **0** populated/public secret names, **0** replay
  URLs, and **0** bearer-like values. Expected server-only variable names occur
  only in server chunks. `.next/static` contained **0** server-variable names,
  **0** public-secret names, **0** local paths, and **0** realistic provider
  values.
- Fresh production metadata contains eight volume-root absolute local-path
  strings only in `.next/required-server-files.js` and `.json`; these are
  ignored local build metadata, not client assets or tracked public material.
- An older ignored `.next/dev` cache contains two realistic-pattern strings.
  They are absent from fresh production output and `.next/static`; because the
  cache is ignored and not staged, it is a local-artifact finding, not public
  candidate content. It must never be published as an artifact.
- Ignored local material includes `.superpowers/`, `.next/`, `node_modules/`,
  and `tsconfig.tsbuildinfo`. The ignored SDD evidence contains expected local
  paths and server-variable names; dependencies and build output remain
  outside Git.
- Playwright generated an untracked `test-results/.last-run.json` during this
  verification run. Its one 45-byte file had no scanned sensitive pattern. Fix
  round 1 deleted that explicitly named file and removed the now-empty literal
  directory; neither was staged or committed.

### Links, claims, and approvals

Across 25 changed Markdown files, 37 Markdown links were checked: 28 local
targets and 9 external URLs. Missing local targets: **0**. Malformed URLs:
**0**. Unresolved anchors: **0**.

The two intentionally unresolved draft fields each occur exactly once in
`docs/submission/social-post.md`:

- `[REPOSITORY_URL — pending owner-approved public push]`
- `[DEMO_URL — pending owner-approved deployment]`

They are pending approvals, not broken published links. The submission copy
was reviewed against the accepted evidence; no hosted/deployed, provider,
assistive-technology, or owner-approval claim was promoted beyond its evidence
class.

## Worktree and protected files

The protected untracked `AGENTS.md` and `CLAUDE.md` were not edited or staged.
`next-env.d.ts` was clean at Task 3 preflight, then Next development output
changed its generated type imports during verification. Fix round 1 restored
it exactly to the committed blob; it was not staged. Terminal hashes are:

| Relative file | SHA-256 |
| --- | --- |
| `examples/localelens-web/AGENTS.md` | `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb` |
| `examples/localelens-web/CLAUDE.md` | `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49` |
| `examples/localelens-web/next-env.d.ts` restored working copy | `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b` |

The committed candidate blob for `next-env.d.ts` has the same SHA-256. The
verification-generated working-copy difference is absent at terminal status.

## Evidence boundaries and known limitations

- The exact application `TRACE` method contract remains **NOT PROVEN**.
- Smaller-viewport live partial/retry/replay transient states remain **NOT
  PROVEN**.
- Actual browser-chrome 200% zoom remains **NOT PROVEN**; the Playwright reflow
  proxy is separate evidence.
- In-app Browser reduced motion remains **NOT PROVEN**; Playwright emulation is
  separate evidence.
- Screen reader and VoiceOver behavior remain **NOT PROVEN**.
- Raw provider tier, raw provider receipts, and provider-console cleanup remain
  **NOT PROVEN**.
- Browser-channel JSON download and print invocation remain **NOT PROVEN**;
  Playwright evidence is separate.
- Hosted, deployed, cross-browser, production, public-repository, submission,
  and posted behavior remain **NOT PROVEN**.
- No new live-provider evidence was collected in Task 3. Prior Phase 4 live
  evidence remains qualified historical evidence only.

## Owner authorization

| External action | Status |
| --- | --- |
| Public push | **PENDING / NOT AUTHORIZED** |
| Deployment | **PENDING / NOT AUTHORIZED** |
| Submission | **PENDING / NOT AUTHORIZED** |
| Social post | **PENDING / NOT AUTHORIZED** |

The only authorized Task 3 commit path is this checklist. After that local
commit, stop. Do not push, deploy, publish, submit, post, create a pull request,
merge, rewrite history, or begin Task 4.
