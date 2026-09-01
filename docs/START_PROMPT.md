# LocaleLens Phase 0 Start Prompt

Use this prompt in a fresh Codex task only after Billy has created a GitHub **fork** of `https://github.com/solari-sdk/solari-cookbook/` and supplied the fork URL.

```text
We are starting LocaleLens Phase 0 only.

Goal:
Create the fork-anchored repository foundation, typed domain contracts, deterministic redacted fixtures, minimal buildable Next.js shell, and Phase 0 evidence exactly as specified. Do not begin Phase 1.

Authoritative documents in the local planning checkout:
- /Users/billytompazis/Documents/ChatGPT/Solari project/docs/EXECUTION_INDEX.md
- /Users/billytompazis/Documents/ChatGPT/Solari project/docs/superpowers/specs/2026-09-01-localelens-design.md
- /Users/billytompazis/Documents/ChatGPT/Solari project/docs/superpowers/plans/2026-09-01-localelens-phase-0-foundation.md

Repository setup:
1. Confirm the current repository, branch, remotes, HEAD, and worktree status before changing anything.
2. Billy's fork URL is: <PASTE THE FORK HTTPS URL HERE>
3. The official upstream is https://github.com/solari-sdk/solari-cookbook.git.
4. Configure normal Git remotes only if missing: origin must be Billy's fork and upstream must be the official repository. Do not rewrite an existing unexpected remote; stop and report it.
5. Fetch both remotes and record the exact upstream/main SHA.
6. Create branch codex/localelens-phase-0-foundation from that exact upstream/main SHA.
7. Bring the planning documents into the fork without changing their content. If Billy provides a local planning commit SHA, cherry-pick that commit; otherwise copy only the tracked docs paths with an explicit, reviewable commit. Preserve unrelated and untracked files.

Execution requirements:
- Use the Superpowers execution/TDD workflow and follow the Phase 0 plan task by task.
- Work under examples/localelens-web/ and touch the cookbook root README only as required by Phase 0.
- Use exact pinned dependencies from the plan and inspect the lockfile and direct dependency tree.
- Write the failing test first, run it and capture RED, implement the smallest passing code, then rerun the focused check.
- Keep code direct and lean: no abstraction for one caller, no state library, no component suite, no Solari dependency, no API route, no provider key, no analytics, and no deployment.
- Use deterministic redacted fixtures only.
- Make zero Solari calls.
- Stage explicit paths. Do not add .DS_Store or unrelated files.
- Commit small verified task checkpoints locally on the same phase branch.
- Do not push unless Billy separately authorizes checkpoint pushes.

Phase 0 completion gate:
- npm test passes.
- npm run typecheck passes.
- npm run lint passes.
- npm run build passes.
- npm ls --depth=0 matches the planned direct dependencies.
- git diff --check passes.
- The example README records zero live calls and honest Phase 0 limitations.
- No Phase 1 design or UI work exists.

At the end, report:
- repository path and branch;
- exact upstream base SHA, predecessor SHA, and terminal SHA;
- commits created;
- verification commands and outcomes;
- live calls used (must be 0);
- remaining tracked/untracked changes;
- the exact sentence: Phase 0 complete; Phase 1 not started.

Stop. Do not begin Phase 1, push, deploy, or publish anything.
```

Before sending the prompt, replace only the fork URL field. If a planning commit SHA is available, add it to step 7; do not invent one.
