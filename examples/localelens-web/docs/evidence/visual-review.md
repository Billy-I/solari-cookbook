# LocaleLens Phase 4 Visual Review

## Status and scope

- Status: **LOCAL BROWSER REVIEW COMPLETE WITH QUALIFICATIONS**.
- Phase 4 exact predecessor: `06bfba6efd2c9ef4ef98cc0eb9266afd377082fa`.
- Phase 4 implementation head: `818f32463b66faba049a57fa34e2e8b5d1219c3e`.
- Exact evidence-commit SHA: resolved and reported by Git after this document is committed; it is not embedded self-referentially here.
- Selected reference: `docs/design/localelens-visual-direction.md` and
  `docs/design/evidence/phase-1-option-a.png`.
- Browser evidence: direct observation in the in-app Browser. Screenshots stay
  only under the ignored `.superpowers/` evidence area and are not committed.

The review kept automated sample Playwright, in-app Browser, live-provider,
deployed, and assistive-technology evidence separate.

## In-app Browser responsive review

Sample idle/featured-success, invalid-input, and running states were directly
observed at every required viewport. The stable shell retained the selected
editorial hierarchy, ruled sections, compact spacing, subtle radii, and warm
neutral/graphite/signal treatment. Document-level horizontal overflow was
false at every measured size.

| State | `360x800` | `768x1024` | `1440x900` |
| --- | --- | --- | --- |
| Idle | PASS | PASS | PASS |
| Invalid input and focused error summary | PASS | PASS | PASS |
| Running with independent country stages | PASS | PASS | PASS |
| Featured/sample success | PASS | PASS | PASS |
| Live partial failure with successful evidence retained | NOT PROVEN at this size | NOT PROVEN at this size | PASS |
| Explicit live GB retrying | NOT PROVEN at this size | NOT PROVEN at this size | PASS |
| Live replay pending | NOT PROVEN at this size | NOT PROVEN at this size | PASS |
| Live replay ready | NOT PROVEN at this size | NOT PROVEN at this size | PASS |

The live-only state variants could not be re-resized after a stale blocked
Browser error tab prevented returning to those transient states. That
limitation does not erase the directly observed responsive shell, success,
invalid-input, and running evidence, but the mobile/tablet live-state variants
remain explicitly `NOT PROVEN`.

### Responsive observations

- At `360x800`, the comparison table switched to the compact semantic
  definition-list view.
- At `768x1024`, the table used a bounded internal horizontal presentation
  without introducing document overflow.
- At `1440x900`, the full comparison table and regional cards remained visible.
- Images used `object-fit: cover`, remained within their cards, and preserved
  the intended equal-height comparison treatment.
- Invalid submission moved focus to the error summary.
- Keyboard focus on the URL input was visibly rendered as a 3px solid signal
  ring with a 2px offset.

## Live-state visual evidence at `1440x900`

The in-app Browser directly showed the initial partial state, the explicit GB
retrying state, replay pending, the final three-country complete state, and
replay ready for all three countries. Browser console warning/error entries:
`0`.

| Country | Intrinsic screenshot | Rendered crop |
| --- | ---: | ---: |
| United States | `1273x12705` | `382x268` cover |
| United Kingdom | `1265x11989` | `381x268` cover |
| Germany | `1265x4543` | `381x268` cover |

Every ready replay action was inspected without recording its sensitive URL.
All three resolved to HTTPS URLs with no URL credentials, no fragment, and a
default/443 port; each link used `target="_blank"` and
`rel="noopener noreferrer"`.

## Fresh automated rendered evidence

The dedicated Playwright runner uses its own non-reused local server with
`NEXT_PUBLIC_APP_MODE=sample`. It observes requests and fails if a sample test
contacts `/api/captures` or `/api/replays`. This is automated sample evidence,
not manual in-app Browser or provider evidence.

| Surface | Automated sample observation | Evidence boundary |
| --- | --- | --- |
| `1440x900` main journey | PASS: three-country completion, semantic difference table, JSON download, print invocation, second run, no console errors, and no document-level horizontal overflow. | Playwright only. |
| `360x800` main journey | PASS: compact comparison surface, JSON download, print invocation, second run, no console errors, and no document-level horizontal overflow. | Playwright only. |
| Idle, validation, running, complete, and partial-failure states | PASS: automated axe found zero violations in the named sample states. | Automated axe is not assistive-technology proof. |
| Keyboard focus | PASS: the automated tab sequence reached the expected controls and computed a visible focus outline of at least 2 CSS pixels with at least 3:1 contrast. | Playwright keyboard/computed-style evidence. |
| Coarse-pointer targets | PASS: tested interactive targets were at least 44 by 44 CSS pixels at a `390x844` touch viewport. | Automated geometry evidence. |
| Reduced motion | PASS: emulated reduced motion removed meaningful CSS animation/transition and restored automatic scroll behavior. | Automated emulation only. |
| Reflow proxy | PASS: a `640x720` CSS-pixel viewport retained the named content and avoided document-level horizontal overflow. | This is not actual browser-chrome 200% zoom. |

## Qualifications

- Computer Use could not control the Codex app because of the safety boundary.
- Actual browser-chrome 200% zoom is `NOT PROVEN`; the automated 640-CSS-pixel
  reflow proxy stays a separate PASS.
- In-app Browser reduced-motion behavior is `NOT PROVEN` because no media
  emulation was used there; automated Playwright reduced-motion evidence is a
  separate PASS.
- Screen reader and VoiceOver behavior are `NOT PROVEN`.
- No cross-browser, deployed, or production-host visual result is claimed.

## Stop condition

The required local Browser evidence is frozen with the qualifications above.
Phase 4 is locally complete; owner acceptance remains pending. Phase 5 was not
started, and no push, deployment, release, or publication was performed.
