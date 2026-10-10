# ADR-0006: Visual identity: white and blue, one primary typeface

- Date: 2026-10-09
- Status: superseded by ADR-0008 (neon black, 2026-10-09)

## Context

The dark hardcore-gym theme (ADR-0005) read as niche and heavy for a product used by every age in a household. The team asked for a premium fitness look: clean, energetic and trustworthy, that works as well on a phone in a living room as on a laptop.

## Decision

- Palette: white and off-white canvases (`--canvas`, `--surface`, `--surface-2`), a bold blue primary (`--primary` #2563eb) for actions and emphasis, deep navy (`--navy` #0a1f44) for the sidebar, the auth brand panel and showcase panels, a sky highlight (`--sky`) on navy, cool grays for text and lines, and accessible green/amber/red for feedback. A `.on-navy` class re-themes the tokens so the same components work inside navy panels.
- Type: Manrope only (400 to 800), loaded from Google Fonts. No second display face; hierarchy comes from weight, size and tracking (`--text-display`, `--text-h1..h3`).
- Shape: rounded corners (20px cards, 12px controls, pill tabs and badges), soft layered shadows, a blue glow on primary buttons.
- Icons: Lucide React, re-exported from `components/icons.tsx` under the app's own names, plus the custom Arc mark.
- Motion (Motion for React): page transitions, staggered lists, scroll reveals, hover lifts, animated numbers, the live arc and marquee, all gated by `prefers-reduced-motion`.
- Layout: landing with a navy "device" panel for the live measurement; split-screen account pages (navy brand panel, white form); signed-in shell with a navy sidebar on desktop that collapses to a compact top bar on phones.
- Registration keeps the ADR-0005 requirements: email, password and confirm password with independent show/hide controls, inline validation, a disabled submit until valid, loading state, autocomplete hints, and no password ever logged or placed in a URL or error message.
- Not adopted: shadcn/ui, React Hook Form and Zod on the client. The forms are small, already validated inline, and the API schemas in `dependencies` are the single source of truth; another layer would not earn its weight.

## Consequences

- Tokens live in `frontend/src/index.css` and reach Tailwind through `@theme inline`; charts read `--chart-*`, so a palette change is still a token change.
- Contrast is checked on white surfaces and inside `.on-navy` panels; avatars use blue-family tints only.
- ADR-0005's dark theme is retired. There is one light theme; `color-scheme: light` is set on the root.
