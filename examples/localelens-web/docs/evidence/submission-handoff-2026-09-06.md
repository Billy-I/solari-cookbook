# LocaleLens submission handoff — 2026-09-06

This successor records the final recording-disclosure refinement and updated
reviewer materials. It preserves all prior live acceptance evidence and does
not claim a new live run, hosted deployment, or social submission.

## Scope and lineage

- Starting branch: `main`.
- Starting local and remote `origin/main` SHA:
  `be9a20c8aa2b289976fce2ae8aa4ecb9f6aeab1c`.
- Original cookbook ancestor:
  `d304843f5ea0edb5c27829bb2ca30868645bef7a`.
- Required live-readiness lineage ancestor:
  `bfe73564786ba7d1a65f43d595e83d7a26530ebf`.
- GitHub metadata confirms the public fork `Billy-I/solari-cookbook`, parent
  `solari-sdk/solari-cookbook`, default branch `main`.
- Owner explicitly requested completion, commit, push, and the latest work on main.
- The commit containing this report is the handoff candidate; its exact SHA and
  post-push remote readback are reported after Git creates it. A document cannot
  embed the hash of its own containing commit.

## Changes

- Screenshots remain the primary evidence. The optional recording and safe
  session reference now appear under collapsed **Technical details**.
- The UI says **Page-load recording**, explains the absence of automated
  clicks/scroll/navigation, and does not request recording status before the
  disclosure opens. Opening the viewer explicitly requests bounded event data.
- Updated component and browser tests cover that request boundary and copy.
- README, cookbook entry, project summary, social drafts, and optional
  walkthrough now describe user-owned keys and live-only operation.
- Added correct clone/install/start commands, `ENOENT` and port troubleshooting,
  actual **View larger** action copy, and the 2–15-market limit.
- Current documentation routes reviewers to this handoff while older phase
  evidence retains its original statements.
- Archived the old sample social card without changing bytes. SHA-256 before
  and after the move: `6127ef483e4f0702f45a06dcd1906aa221bae9072d360911a83ffa43ade762d0`.
- Added a real screenshot of the disconnected production UI, with no key,
  captured results, private browser chrome, or provider data.

## Fresh credential-free verification

Tests ran in a temporary, non-Git source copy with the exact application source,
tests, configuration, and lockfile from this candidate. It used a fresh
`npm ci`, not the existing installed packages. No branch or worktree was created.
This kept Next-generated `next-env.d.ts`, AGENTS/CLAUDE files, and Playwright
outputs away from the protected working-copy paths. Source-byte parity was
checked before commit. Documentation-only finishing edits do not affect the build.

All npm commands used Node `v22.22.2` via the pinned runtime PATH.

| Command | Result |
| --- | --- |
| `node --version` | PASS: v22.22.2 |
| `npm ci --no-audit --no-fund` | PASS: 460 packages installed; existing ESLint plugin peer-range warnings noted below |
| `npm test` | PASS: 35 files, 357 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `SOLARI_API_KEY=synthetic-secret-build-canary npm run build` | PASS: production Next.js build, TypeScript, prerendered shell and dynamic API routes |
| `npm run check:budget` | PASS: 155,880 B main-route gzip / 184,320 B ceiling |
| `npm run check:production-boundaries` | PASS: 121 files with the final screenshot included; canary not exposed |
| `npm run check:api-methods` | PASS for app-reachable methods; TRACE remains NOT_PROVEN because it is rejected before Proxy |
| `npm run test:e2e` | PASS: 7/7 Chromium tests, synthetic route responses only |
| `npm run start -- --hostname 127.0.0.1 --port 34127` | PASS: production server started; in-app Browser inspection below |
| `git diff --check` | PASS |

The final read-only Node checks also passed: 50 local Markdown link targets,
balanced Markdown fences, 95 source/config/test files byte-identical to the
tested copy, and a 209-character X draft using URL-weighted counting. A narrow
scan of 13 changed text files found no realistic Solari credential or private
key patterns. This is a scoped pattern check, not a claim that every possible
secret format or every historical file has been audited.

The synthetic canary is not a usable key. The browser tests cover connection
gating, partial results, explicit retry, recording disclosure/viewer/export,
JSON download, print invocation, keyboard order, axe, reduced motion, 44px
targets, and responsive reflow. They do not prove new provider behavior.

## Browser and process evidence

- Opened the production build in the in-app Browser on `127.0.0.1:34127`.
- Observed the empty masked connection form, disabled connect/compare actions,
  all 15 markets, and GB/US default selection. No key was entered.
- Captured and inspected the full disconnected interface now linked by the README.
- Expanded **How it works** and observed the explanation. Browser error log: empty.
- Closed the temporary tab and stopped the exact npm-owned server via Ctrl+C.
- `lsof -nP -iTCP:34127 -sTCP:LISTEN` and
  `lsof -nP -iTCP:34123 -sTCP:LISTEN` returned no listeners afterward.
- The pre-existing development server on `34126` was left untouched. This is
  not a claim that every LocaleLens process on the computer was shut down.

## Provider and external-action accounting

| Action during this handoff | Count / status |
| --- | --- |
| Solari authentication requests | 0 |
| Initial billable captures | 0 |
| Capture retries | 0 |
| Provider recording requests | 0 |
| New dashboard inspection | NOT RUN |
| Live acceptance | Prior owner-accepted evidence retained; not rerun |
| PR, deployment, release, social post, hosted-CI inspection, settings changes | None |
| Merge | None needed: the changes are already based on main |

The [previous live report](byok-live-only.md#follow-up-live-observation) records
eight successful captures, zero capture retries, one UI-observed connection,
Brazil recording acceptance, disconnect/shutdown proof, and the count deviation
and dashboard uncertainty. Those qualifications remain unchanged.

## Protected files and limits

Protected files remained unstaged and retained these hashes:

| Path relative to app | SHA-256 |
| --- | --- |
| `next-env.d.ts` | `6feb180faa5acaf19451d0f2662b77ff272d3199fac6bec8dff30152e883762b` |
| `AGENTS.md` | `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb` |
| `CLAUDE.md` | `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49` |
| `test-results/.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |

No files inside the protected `test-results/` directory were written by this
pass. Historical documents can contain local paths and old sample behavior;
this handoff does not erase history or claim a new whole-history privacy audit.

Fresh installation reported pre-existing peer-range warnings because some
ESLint plugins declare support only through ESLint 9 while the pinned project
uses ESLint 10. Installation and lint both passed; dependency upgrades were not
mixed into this UI/documentation handoff. Playwright also emitted non-fatal
color-environment and player-teardown warnings; all seven tests passed.

The supported topology remains one long-lived Node process. Hosted HTTPS,
serverless/multi-instance operation, direct assistive technology, general
provider reliability, and current hiring availability remain unproven. The
public repository and prepared post enable the owner to submit; no social
post or application message has been sent by the agent.
