# LocaleLens Phase 1 Evidence

## Scope and lineage

- Status: Phase 1 sample-mode visual shell complete; Phase 2 not started.
- Repository: `/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens`
- Branch: `codex/localelens-phase-1-visual-shell`
- Exact predecessor: `53b73806c6205d8181bf19b7fc0f8cd81e7ad18c`
- Pre-evidence implementation commit: `f79ea6d5e201355396b7b24cffa1f02a8e6582ba`
- Remote: only `upstream`, `https://github.com/solari-sdk/solari-cookbook.git`
- Runtime used for Phase 1 verification: Node.js `v22.22.2`
- `live_solari_calls: 0`
- `sample_mode: PASS`
- `direct_screen_reader: NOT_PROVEN`
- `hosted: NOT_PROVEN`
- `phase_2_authorized: false`

The branch was created locally from the exact Phase 0 terminal SHA after the
repository, clean worktree, remotes, branch, HEAD, and predecessor were checked.
No push, pull request, publication, deployment, remote change, API key use, or
provider call occurred. The real cookbook fork remains outstanding.

## Mandatory visual gate

Exactly three distinct full-page directions were generated before any Phase 1
UI source was edited:

1. `docs/design/evidence/phase-1-option-a.png`
2. `docs/design/evidence/phase-1-option-b.png`
3. `docs/design/evidence/phase-1-option-c.png`

Owner feedback was: `i vote for the first design`. Direction A is frozen as the
sole source of truth in `docs/design/localelens-visual-direction.md`; directions
were not combined.

The implementation uses the selected warm-neutral editorial grid, graphite
rules, restrained red signal action, compact receipt/status bands, dominant
three-market screenshots, aligned evidence, future export label, and limitations
footer. The source and final implementation were reviewed together in
`docs/design/evidence/phase-1-qa-comparison.html`; `design-qa.md` records
`final result: passed`.

## RED-first evidence

| Slice | RED observation | GREEN observation |
| --- | --- | --- |
| Page composition | Selected heading/regions were absent | Semantic selected-direction structure passed |
| Run form | `audit-form` module was absent | Six behavioral tests passed for defaults, bounds, validation, trimming, order, and busy state |
| Run lifecycle | Hook and status modules were absent | Independent progress, first-result visibility, retry, partial failure, and one live region passed |
| Regional result | Result module was absent | Screenshot description, null consent, safe failure, and retry passed |
| Difference table | Table module was absent | Header association and textual comparison state passed |

The final Vitest run passed 8 files and 33 tests.

## Browser and Computer Use evidence

All browser evidence used the requested in-app Browser against the local Next.js
development server. Computer Use opened the generated US storefront evidence in
Preview at actual size; all three `1280x900` assets were also inspected before
use. No external or live target was opened.

| Viewport | Evidence | Observation |
| --- | --- | --- |
| `360x800` | `docs/design/evidence/phase-1-shell-360x800.jpg` | One-column form; six market rows and action are each `44px`; document client and scroll widths both `345px` |
| `768x1024` | `docs/design/evidence/phase-1-shell-768x1024.jpg` | Form wraps without clipping; result widths are `353`, `353`, and `705px`; post-fix status rows are each `58px` |
| `1440x900` | `docs/design/evidence/phase-1-shell-1440x900.jpg` | Three equal `459px` evidence columns; document client and scroll widths both `1425px` |

The real browser journey selected Germany, submitted the deterministic sample,
and reached three complete regions with a `complete` receipt. The same browser
showed zero error or warning console entries. Semantic browser checks confirmed
the disclosure, URL input, each enabled checkbox, and primary button are
keyboard-focusable with a visible outline. Component coverage confirms native
keyboard-operable controls and invalid-submit focus on the single alert. Direct
screen-reader output remains explicitly unproven.

## Terminal verification

Commands ran locally from `examples/localelens-web/` except the repository-level
diff and Git checks.

| Command | Result |
| --- | --- |
| `npm test` | PASS (8 files, 33 tests) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; static `/` and `/_not-found` |
| `git diff --check` | PASS |

The pinned test/build chains continue to emit the known experimental
CommonJS-to-ESM warning recorded in Phase 0; required commands still exit
successfully. The exact planned Node `v22.20.0` was unavailable on this host, so
Phase 1 used installed Node `v22.22.2`, which satisfies the repository's Node 22
range and jsdom's declared engine.

The only new direct dependency is exact `lucide-react@1.38.0`. No Solari SDK or
other provider package was installed. Two npm-created extraneous helper folders
exist only in local `node_modules`; they are absent from `package.json`, the lock
file's root dependency set, Git, and the product bundle.

## Security and phase boundaries

- Sample fixtures and screenshots are synthetic and deterministic.
- No capture or replay API route exists.
- No SDK, API key, live call, session, replay URL, IP address, or provider output
  enters the client, evidence, or Git history.
- Captured values render as text; no untrusted HTML is injected.
- Export and print are disabled future controls with the visible label
  `Available after Phase 3`; they perform no download.
- Browser evidence proves only the local sample shell. Hosted, provider,
  production, direct screen-reader, and Phase 2 behavior remain `NOT_PROVEN`.
- Local Next.js tooling generated untracked `examples/localelens-web/AGENTS.md`
  and `examples/localelens-web/CLAUDE.md`; they were deliberately not staged or
  committed because they are outside Phase 1 product scope.

Phase 1 complete; Phase 2 not started.
