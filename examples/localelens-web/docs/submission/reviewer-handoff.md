# LocaleLens reviewer handoff

LocaleLens is a runnable Solari browser use case for checking regional web
experiences. The [app README](../../README.md) contains setup, the user journey,
architecture, credit boundaries, and troubleshooting. Start there to review
the product; no private Lunar or FrameBase code is required.

## Original brief and submission route

The original request was a public web app for the Solari hiring opportunity,
with strong product design, simple code, a quick end-to-end use case, and no
publication of the owner's separate private projects.

The recovered challenge instructions ask applicants to fork the Solari
cookbook, build a real Solari use case, publish the source on a public GitHub
account, and share it on LinkedIn or X tagging Harry Chow and Solari. They
encourage AI-assisted development. They do not explicitly require a hosted
demo, video, or upstream pull request.

Sources: [original fact-sheet link](https://x.com/harrychow_/status/2094521275586691410)
and [indexed reproduction of the hiring post](https://www.sotwe.com/harrychow_).
On 2026-09-06 the original X page returned 403 to the reader; the reproduction
corroborated the original conversation's instructions. Current hiring
availability is not proven by this code handoff.

## Review and submission checklist

| Item | Status |
| --- | --- |
| Public cookbook fork | GitHub confirms `Billy-I/solari-cookbook` is public, forked from `solari-sdk/solari-cookbook`, with default branch `main` |
| Real Solari use case | User-owned live browser captures, country-proxy validation, evidence comparison, optional page-load recording |
| Current source | Publish the verified handoff commit to `origin/main`; exact commit and remote parity are reported after Git assigns the SHA |
| Local setup | Node 22.22.2, `npm ci`, one Next.js process, key entered in the masked UI |
| Automated proof | See [current verification](../evidence/submission-handoff-2026-09-06.md) |
| Live proof | Owner accepted the recorded eight-market follow-up; see [qualified evidence](../evidence/byok-live-only.md#follow-up-live-observation) |
| Application description | [Project summary](project-summary.md) |
| Social submission | [Copy-ready X and LinkedIn text](social-post.md); not posted by the build agent |
| Optional demo | [Walkthrough script](demo-script.md); no finished video or hosted deployment claimed |

Submission link:
<https://github.com/Billy-I/solari-cookbook/tree/main/examples/localelens-web>

After publication, the owner can share that link using the prepared post and
tag the named profiles. A repository push alone does not submit a social post.

## What the implementation proves

- Explicit connection and comparison actions, no automatic capture retries.
- 2–15 selected markets, at most three concurrent captures, deterministic batching.
- Separate per-market progress, partial results, cancellation, and stale-response protection.
- Larger screenshot inspection, captured-field comparisons, bounded JSON and print exports.
- Optional page-load recording under collapsed Technical details. No recording
  status request is made while it stays collapsed; a new opening may check
  status again. Event data loads only on the explicit viewer action.
- Server-memory credentials, opaque HttpOnly cookies, same-origin requests,
  owner-isolated references, SSRF checks, bounded evidence, and cleanup paths.

## Limits reviewers should know

This is an initial page capture, not autonomous navigation, interaction testing,
continuous monitoring, or a compliance audit. Geography is one possible reason
for differing results; timing, personalization, experiments, and site behavior
can also change what is captured. Missing fields remain “Not detected.”

Run one long-lived Node instance. Serverless, multiple instances, hosted HTTPS,
and direct screen-reader behavior have not been proven. A server restart loses
credential sessions and recording references. Refreshing the page loses the
client-held report; export evidence you want to retain before leaving.

The accepted eight-market follow-up exceeded its original two-capture proposal;
the owner accepted the disclosed result afterward. Dashboard delta was not
proven, and only Brazil's recording was visibly accepted. These qualifications
are retained in the live evidence and are not replaced by automated tests.

Older phase evidence remains intact. The archived social card depicts the old
sample UI and must not be attached as current live evidence. No new provider
call is needed to build, test, or read this submission package.
