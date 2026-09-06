# LocaleLens project summary

LocaleLens helps product designers, localization teams, and QA engineers inspect
how one public HTTPS page appears across markets. It uses Solari browser sessions
and country proxies to collect screenshots, final URLs, language, pricing clues,
headings, calls to action, and consent text. The interface shows regional progress,
expandable screenshots, field differences, and JSON/print exports. Optional
page-load recordings sit behind Technical details.

Built with Next.js, React, and TypeScript, it runs 2–15 selected markets in
deterministic batches of at most three. Each user enters their own key through
a masked form; credentials stay in bounded server memory behind an opaque
HttpOnly cookie. Public-target validation, bounded extraction, cleanup, and
explicit retries keep the workflow controlled. There is no LLM, database,
account system, or shipped sample mode.

The owner-accepted live follow-up captured eight markets successfully. Its
dashboard correlation and broader provider reliability remain unproven.
The supported runtime is one long-lived local Node process; hosted and
multi-instance operation are not claimed.

Source and setup: [LocaleLens on GitHub](https://github.com/Billy-I/solari-cookbook/tree/main/examples/localelens-web).
See [current verification](../evidence/submission-handoff-2026-09-06.md) for
automated results and the [live report](../evidence/byok-live-only.md) for
the exact acceptance qualifications.
