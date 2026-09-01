# LocaleLens Phase 5 Public Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a clean Solari cookbook fork, a safe sample-mode web demo, and concise application materials without leaking credentials or exposing the concept before the owner approves release.

**Architecture:** Production hosting serves deterministic sample evidence by default. Live Solari capture remains owner-controlled and disabled on the public deployment unless a later security decision adds an authenticated backend. The repository, demo, short video, and social post all point to the same verified terminal SHA.

**Tech Stack:** Verified Phase 4 application, GitHub fork, Product Design-selected visuals, optional Sites hosting only after explicit owner approval, and the in-app Browser for final inspection.

**Spec:** `docs/superpowers/specs/2026-09-01-localelens-design.md`

## Global Constraints

- Begin only from an owner-accepted Phase 4 terminal SHA.
- The owner must explicitly authorize each external mutation: public push, deployment, and social post.
- Use a public **fork** of `solari-sdk/solari-cookbook`; do not substitute a blank repository.
- Keep the concept private until the owner says it is ready to publish.
- Public hosting defaults to `NEXT_PUBLIC_APP_MODE=sample` and contains no `SOLARI_API_KEY`.
- Do not claim live deployment, production safety, replay availability, assistive-technology verification, or hiring outcomes without direct evidence.
- Do not add product features, redesign, analytics, tracking, or an account system in this phase.
- Do not force-push, rewrite history, modify repository settings, or merge without explicit owner direction.

---

## Planned file responsibilities

```text
README.md                                         # cookbook index entry only
examples/localelens-web/
├── README.md                                     # problem, demo, setup, architecture, evidence
├── docs/submission/demo-script.md                # 75-second recording script
├── docs/submission/project-summary.md            # copy-ready application description
├── docs/submission/release-checklist.md           # privacy, secret, link, and SHA gates
├── docs/submission/social-post.md                 # post prepared but not published
└── public/social-card.png                         # real selected/design-generated asset
```

### Task 1: Prepare the reviewer path

**Files:**
- Modify: `README.md`
- Modify: `examples/localelens-web/README.md`
- Create: `examples/localelens-web/docs/submission/project-summary.md`

- [ ] **Step 1: Write the reviewer journey before editing**

The first 60 seconds must answer: what problem this solves, why Solari is essential, how to run sample mode, how to enable owner-controlled live mode locally, what evidence is captured, and where tests and limitations live.

- [ ] **Step 2: Update the cookbook root surgically**

Add one LocaleLens row or section in the existing cookbook style. Do not rewrite unrelated examples or formatting. Link to `examples/localelens-web/`.

- [ ] **Step 3: Write the example README**

Include:

- one-sentence value proposition;
- one real interface screenshot from the selected visual implementation;
- feature list limited to shipped behavior;
- sample/live provenance boundary;
- Solari browser, proxy, recording, and replay use;
- architecture diagram already defined in the spec;
- exact setup and verification commands;
- environment variable names without values;
- security and privacy design;
- live-call budgets and evidence links;
- known limitations;
- no invented roadmap claims.

- [ ] **Step 4: Write a 150-word project summary**

Structure: problem, user, Solari mechanism, technical judgment, measurable proof, limitations. Avoid inflated language such as “revolutionary,” “production-ready,” or “AI-powered.”

- [ ] **Step 5: Verify links and commit**

```bash
rg -n '\]\([^)]+' README.md examples/localelens-web/README.md examples/localelens-web/docs/submission/project-summary.md
git diff --check
git add README.md examples/localelens-web/README.md examples/localelens-web/docs/submission/project-summary.md
git commit -m "docs: prepare LocaleLens reviewer journey"
```

### Task 2: Prepare a real social asset and demo script

**Files:**
- Create: `examples/localelens-web/public/social-card.png`
- Create: `examples/localelens-web/docs/submission/demo-script.md`
- Create: `examples/localelens-web/docs/submission/social-post.md`

- [ ] **Step 1: Create the social-card brief from the selected design**

Use the implemented interface screenshot as the source. The card must fit the selected palette and typography, show three regional result columns, include the name LocaleLens, and avoid fake partner logos, fabricated metrics, provider keys, temporary replay URLs, and hiring compensation claims.

- [ ] **Step 2: Generate or compose the real asset**

Use Product Design/ImageGen when a derived asset is needed; do not draw substitutes in CSS or SVG. Export 1200x630 PNG, inspect it at actual size, and verify readable type and safe cropping.

- [ ] **Step 3: Write the 75-second demo script**

Use this sequence:

1. 0–10 seconds: user problem and one URL.
2. 10–25 seconds: choose US, UK, and Germany.
3. 25–45 seconds: independent statuses and screenshots.
4. 45–60 seconds: evidence differences and Solari receipt/replay.
5. 60–70 seconds: JSON/print export and sample/live label.
6. 70–75 seconds: repository and honest limitation.

Do not require live narration if a deterministic sample recording is more reliable. State clearly when footage is sample mode.

- [ ] **Step 4: Draft but do not publish the post**

Keep it concise: problem, shipped result, why Solari, repository link field, demo link field, and tags `@harrychow_` and `@getsolari`. The fields remain local until real URLs exist; do not invent them.

- [ ] **Step 5: Commit the materials**

```bash
git add examples/localelens-web/public/social-card.png examples/localelens-web/docs/submission/demo-script.md examples/localelens-web/docs/submission/social-post.md
git commit -m "docs: prepare LocaleLens submission materials"
```

### Task 3: Run the release and privacy gate

**Files:**
- Create: `examples/localelens-web/docs/submission/release-checklist.md`

- [ ] **Step 1: Verify the exact release candidate**

```bash
git status --short --branch
git log -1 --oneline
npm test
npm run typecheck
npm run lint
npm run build
npm run check:budget
npm run test:e2e
git diff --check
```

- [ ] **Step 2: Inspect the entire public diff**

Compare against the exact upstream cookbook base. Confirm only LocaleLens and required root-index changes exist. Check generated files, screenshots, fixtures, docs, Git history, ignored files, and build output for keys, local paths, personal data, draft notes, browser storage, temporary URLs, and provider payloads.

- [ ] **Step 3: Verify public behavior**

Build with `NEXT_PUBLIC_APP_MODE=sample`, no Solari key, and live capture disabled. The complete main journey must work from deterministic fixtures; any live action must be absent or clearly disabled.

- [ ] **Step 4: Record the release decision**

The checklist records release-candidate SHA, upstream base SHA, checks, public mode, secrets result, content review, owner approval fields, and known limitations. Do not mark owner approval yourself.

- [ ] **Step 5: Commit and stop for owner authorization**

```bash
git add examples/localelens-web/docs/submission/release-checklist.md
git commit -m "chore: freeze LocaleLens release candidate"
git status --short --branch
```

Stop here until the owner separately authorizes public push.

### Task 4: Publish the approved fork

**Precondition:** Owner has created the public GitHub fork and explicitly authorized push.

- [ ] **Step 1: Verify remotes and fork ancestry**

```bash
git remote -v
git ls-remote origin HEAD
git ls-remote upstream HEAD
git merge-base --is-ancestor upstream/main HEAD
```

Expected: `origin` is the owner's cookbook fork; `upstream` is `solari-sdk/solari-cookbook`; the release branch descends from the recorded upstream base.

- [ ] **Step 2: Re-run checks on the terminal SHA**

Run the complete release-candidate command set without source changes.

- [ ] **Step 3: Push once with normal Git**

```bash
git push -u origin HEAD
```

Do not force-push or alter repository settings.

- [ ] **Step 4: Verify remote parity**

Compare local `git rev-parse HEAD` with the remote branch SHA returned by `git ls-remote`. Record the public repository URL and immutable commit URL in the checklist.

- [ ] **Step 5: Stop for deployment authorization**

Public source is now visible; deployment has not started.

### Task 5: Publish the approved sample demo

**Precondition:** Owner has explicitly approved deployment and selected a hosting target. If Sites is selected, use `sites-hosting` with the already verified Product Design project; do not reinitialize it.

- [ ] **Step 1: Configure sample-only hosting**

Set `NEXT_PUBLIC_APP_MODE=sample` and `LIVE_CAPTURE_ENABLED=false`. Do not configure `SOLARI_API_KEY` in the public host.

- [ ] **Step 2: Deploy the exact remote-parity SHA**

Keep build logs and deployment identifier. Do not claim deployment success from a local build.

- [ ] **Step 3: Inspect the deployed main journey**

Use the in-app Browser at 360x800 and 1440x900. Run the complete sample journey, JSON download, print entry point, keyboard navigation, and console inspection. Confirm live endpoints are disabled and no source maps or responses expose secrets.

- [ ] **Step 4: Record deployment evidence**

Add the final HTTPS URL, SHA, UTC time, host, checks, mode, and failures to the release checklist. Commit any documentation change and obtain owner authorization before pushing that successor commit.

### Task 6: Publish the approved application post

**Precondition:** Owner has reviewed the exact post, repository URL, demo URL, screenshot/card, and privacy boundary, and explicitly authorized posting.

- [ ] **Step 1: Replace local URL fields with verified links**

Open every link before use. Include only claims proven in the release checklist.

- [ ] **Step 2: Final redaction review**

Inspect the post text, attached image, and video frames for keys, local paths, personal notifications, account information, browser tabs, private repository names, and temporary replay URLs.

- [ ] **Step 3: Publish once**

Tag `@harrychow_` and `@getsolari`. Do not expose additional app details beyond the approved public materials.

- [ ] **Step 4: Verify the live post**

Open the post, confirm links and media, and record the URL. Do not edit or repost automatically if an issue appears; report it to the owner first.

## Phase 5 exit gate

- [ ] The public repository is a verified Solari cookbook fork at remote SHA parity.
- [ ] The public demo is sample-only and contains no provider key.
- [ ] Repository, deployed demo, and submission materials describe only proven behavior.
- [ ] Demo and repository links have been opened and verified.
- [ ] Owner separately authorized public push, deployment, and posting.
- [ ] The release checklist records exact SHA lineage and remaining limitations.
