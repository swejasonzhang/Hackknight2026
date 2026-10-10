# ADR-0005: Visual identity: hardcore gym, one dark theme

- Date: 2026-10-09
- Status: superseded by ADR-0006

## Context

The first design read as a generic SaaS dashboard. The product is a strength and mobility tool used at home, and the team wants it to feel like serious training equipment: powerful, disciplined, athletic.

## Decision

- One dark theme only: near-black canvas with a faint diagonal hatch, graphite surfaces, hairline and strong borders, sharp 2px corners. No light theme.
- Palette: blood red (`--primary`) for actions and emphasis, industrial orange (`--primary-2`) for goals and warnings in context, metallic silver (`--accent`) for secondary data. Semantic green/amber/red stay for status.
- Type: Barlow Condensed (600 to 900) for headlines, labels, buttons and table headers, uppercase with wide tracking; Inter for body and numbers.
- Components: solid high-contrast buttons with hover, focus ring (orange), active and disabled states; inputs with strong borders and red focus; cards with coloured top bars for stat tiles; squared tabs with a sliding red block; squared badges and avatars.
- Motion from the earlier landing-page design pass is kept (page reveals, live arc, marquee) and respects reduced motion.
- Registration: email, password and confirm password with independent show/hide controls, inline validation tied to the fields, a disabled submit until valid, and a loading state.

## Consequences

- Tokens live in `frontend/src/index.css` and are exposed to Tailwind through `@theme inline`; a palette change is a token change.
- Charts use the same tokens (`--chart-*`), so red/orange/silver carry through Recharts without per-chart colours.
- Contrast is checked against the dark surfaces; light pastel elements must not be reintroduced.
