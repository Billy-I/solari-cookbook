# LocaleLens Phase 2 Start Prompt

Use this prompt in a fresh Codex task only after Billy has created a public GitHub fork of `https://github.com/solari-sdk/solari-cookbook/` and supplied its exact HTTPS URL.

Replace `<PLANNING_CHECKPOINT_SHA>` after the planning-only commit is created. Do not replace it with the older Phase 1 evidence SHA.

```text
Start LocaleLens Phase 2 only. Do not begin Phase 3.

Use this existing local repository:

/Volumes/SECA-Wikidata/seca-artifacts/LocaleLens

Required lineage:
- Phase 0 terminal SHA: 53b73806c6205d8181bf19b7fc0f8cd81e7ad18c
- Phase 1 evidence terminal SHA: 6ae07c11d58f2fce27e3cdca84b75578968a04cc
- Reviewed planning checkpoint SHA: <PLANNING_CHECKPOINT_SHA>
- Billy's cookbook fork: <PASTE THE FORK HTTPS URL HERE>
- Official upstream: https://github.com/solari-sdk/solari-cookbook.git

Confirm the repository, tracked worktree state, remotes, branch, HEAD, exact predecessor, and ancestry first. Preserve the untracked Next.js-generated examples/localelens-web/AGENTS.md and examples/localelens-web/CLAUDE.md. Verify the fork is genuinely owned by Billy and is a fork of the official cookbook. Configure it as origin only if exact ownership and parentage are proven; retain the official repository as upstream. Do not rewrite an unexpected remote. Push only the already-completed Phase 1 branch if it is not yet published, then verify remote SHA parity.

Create:

codex/localelens-phase-2-secure-capture

from exactly the reviewed planning checkpoint SHA. Keep all Phase 2 work on that branch. Do not open a PR, deploy, post publicly, or begin Phase 3.

Read completely before acting:

- docs/EXECUTION_INDEX.md
- docs/superpowers/specs/2026-09-01-localelens-design.md
- docs/superpowers/plans/2026-09-01-localelens-phase-2-secure-capture.md
- docs/evidence/localelens-phase-1.md

Use the applicable Superpowers execution, TDD, systematic debugging, Browser, Computer Use, and verification skills.

Phase 2 must make LocaleLens functional against the real Solari Browser system, not only sample fixtures. Recheck the official Solari quickstart, sessions, proxies, and recording documentation and confirm @solarisdk/browser@0.1.2 is still the registry latest before installing it. If the documented API or version changed, stop and revise the plan before implementation.

Billy will create or supply the Solari API key from https://console.getsolari.com through an approved local secret path. Never ask Billy to paste the key into chat. Never print, log, screenshot, commit, expose to client code, or place it in any NEXT_PUBLIC_ variable. Keep LIVE_CAPTURE_ENABLED=false by default.

Follow the Phase 2 plan RED-first. Implement only the smallest single-region server-side capture and replay path: strict public-HTTPS validation, redirect revalidation, one recorded stealth residential proxy session, bounded evidence and screenshot, matching proxy receipt, safe errors, per-request browser/client cleanup, guarded capture route, guarded replay lookup, and qualified evidence.

Do not create or deploy a separate locale test website in Phase 2. Use https://example.com/ for the bounded real-provider smoke proof. This proves Solari launch, navigation, extraction, screenshot, cleanup, proxy receipt, and replay behavior; it does not prove content localization. Phase 3 remains responsible for the real multi-country comparison.

Make no live call until all mocked tests, typecheck, lint, build, secret scan, and live guards pass. Use at most three live Solari calls, with no automatic retry. Record exact call count and qualify unavailable replay/provider evidence as NOT PROVEN rather than manufacturing PASS.

At the end, commit the Phase 2 evidence locally and report repository, branch, predecessor SHA, terminal SHA, commits, verification commands, exact live-call count, tracked/untracked state, and the exact sentence:

Phase 2 complete; Phase 3 not started.

Stop. Do not continue into Phase 3 automatically.
```
