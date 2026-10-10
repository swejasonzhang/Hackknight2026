# ADR-0008: Visual identity: neon black

- Date: 2026-10-09
- Status: accepted (supersedes ADR-0006)

## Context

The white-and-blue identity (ADR-0006) read as a clean SaaS product. Jason pointed at fitnessai.com as "extremely on point" for what he wants: a black canvas, white type, one electric blue, condensed uppercase display headlines with a neon glow, pill buttons, and black cards that glow at the edge, with white and blue bands breaking up the page.

## Decision

- **Palette.** Black canvas (`#000`), near-black surfaces, white ink with light-gray body text, one electric blue (`--primary` #00a1ff) for actions, glows, rings and chart lines. Feedback colours are brightened for black. `.on-light` re-themes a section to white with charcoal type (the "data" section); `.on-blue` makes a solid blue band with black buttons.
- **Type.** Bayon (Google Fonts, one weight) for every `h1`, `h2` and display headline, uppercase, tight leading. Inter for everything else; feature titles are large and light (300). Hero and auth headlines carry a blue text glow (`.glow-text`).
- **Shape and depth.** Pill buttons (`.btn`, `.btn-primary`, `.btn-white`, `.btn-navy` for black-on-blue). 28 to 36 px radii. Depth is light, not shadow: cards get a 1 px blue ring plus a blue glow (`--glow`), stronger on the hero device panel.
- **Landing structure**, mirroring the reference with Arc's content: centred glowing headline and outlined/blue pills, the live-measurement device panel, a "progress should be measurable" bento of glowing cards with large light titles, a left-aligned "structured weeks" section with day chips and the showcase chart, a white "let the data do the heavy lifting" section with ring icons and plus-bullets, household stat cards in Bayon plus the FAQ accordion, a blue band, a final bullets section, and a footer. The marquee is gone.
- **App.** Black sidebar with a glowing blue active pill, black blurred top bar, Bayon page titles and stat numbers, glowing cards, dark inputs with a blue focus ring, blue-tinted avatars.
- Motion, Lucide icons, the Radix accordion and the registration-form requirements from ADR-0006 are unchanged.

## Consequences

- Tokens still live in `frontend/src/index.css` behind `@theme inline`; the `--navy` token now means black and is kept only so existing utilities keep compiling.
- Contrast is checked on black and inside `.on-light`; body text on black is `#d9d9d9`, muted is `#8b8b94` (both pass AA on black at body sizes).
- Fonts load from Google Fonts (Bayon, Inter); the display fallback is Arial Narrow / Impact so the uppercase layout survives offline.
