# LocaleLens Phase 1 Visual Direction

Date: 2026-09-01

owner_selected: true

## Selection

- Selected option: first displayed direction, recorded as `phase-1-option-a.png`.
- Owner feedback: "i vote for the first design"
- Source visual: `docs/design/evidence/phase-1-option-a.png`
- Implementation target: a full-width editorial proof sheet with one ruled run-control band, a compact receipt and status ledger, three equal regional screenshot columns, aligned evidence rows, restrained evidence actions, and a limitations footer.

The implementation must not combine structure, color, or interaction patterns from the other two directions.

## Rejected direction trade-offs

- `phase-1-option-b.png` gives the run form a persistent left column. Its strong asymmetry is distinctive, but it reduces the width available to the three regional screenshots and makes the primary comparison feel more like a workspace shell.
- `phase-1-option-c.png` turns each country into a stacked editorial record. It reads well as a report, but it weakens immediate side-by-side screenshot comparison at the 1440px review viewport.

## Visible design tokens

- Canvas: warm neutral `#f7f5f0`.
- Raised field surface: soft white `#fffefa`.
- Primary text: graphite `#1c1d1c`.
- Muted text: `#62635f`.
- Fine rules and control borders: `#c9c6be`.
- Strong rules: `#373936`.
- Signal/action: restrained burnt coral `#d84c36` with a darker hover state.
- Type: the system sans stack required by the approved product spec; storefront screenshots may carry their own embedded editorial display type.
- Shape: square-to-subtle 4px corners, no decorative cards, no nested cards, and no ambient shadow.
- Spacing: 24px page gutter at desktop, 16px at compact widths, with dense 8/12/16px internal rhythm and 24/32px section separation.

## Responsive adaptation

- At 1440x900, keep the form in one ruled row and render three equal screenshot/evidence columns.
- At 768x1024, allow form controls and receipt facts to wrap; use two result columns when they remain readable and let the third occupy the next row.
- At 360x800, render one form control and one regional result per row. Preserve screenshot aspect ratio and keep the difference table inside its own labeled horizontal overflow region when the columns cannot reflow.
- Never introduce a fixed-height application shell, page-level horizontal overflow, internal vertical scroll trap, or essential hover-only content.
- Maintain a 44px minimum target for coarse pointers.

## Motion

- Animate only meaningful run-stage transitions with a short opacity change.
- Do not animate evidence values, screenshots, or decorative surfaces.
- Under `prefers-reduced-motion: reduce`, remove non-essential transitions and present every stage change immediately.
