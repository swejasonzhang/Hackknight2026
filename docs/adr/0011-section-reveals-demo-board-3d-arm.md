# ADR-0011: Section reveals, a live demo board and a 3D arm on the landing page

- Date: 2026-10-10
- Status: accepted (amends the Motion bullet of ADR-0010)

## Context

After the Calibre redesign (ADR-0010) Jason asked for more animation so each section pops out, more demos of the graphs on the landing page, equal spacing in the left index, a general refinement pass, and a 3D model of an arm with moving joints around the elbow-flexion demo. ADR-0010 had ruled out scroll-in effects ("instruments settle; they do not bounce or fade in on scroll"), so that line needed a decision rather than a quiet exception.

## Decision

- **Sections reveal once, as instruments drawing themselves.** Every numbered strip draws its head rule left to right, then its title and content rise 18 px into place with a 70 ms stagger, once, when the strip enters the viewport. Headlines rise line by line out of a mask. Charts draw their lines and bars in when they become visible, and readout numerals count from their previous value, not from zero. Still one easing and short durations (under 1 s); still nothing that bounces, loops or reacts to the cursor. Reduced motion shows everything in place, unanimated.
- **The landing demos run Arc's real code.** The demo generator and the progress builder moved from the backend into `@arc/dependencies`, so the landing's demo board computes six random weeks in the browser with the exact functions the API uses, and renders them with the dashboard's own chart components: trend, rep by rep, fatigue, weekly and 3D bars, for each of the three movements. "New random six weeks" draws a new seed. Generated sessions sit at local training hours, so the API takes the browser's timezone offset when it seeds a demo profile.
- **A 3D arm, not a stick figure, on the landing.** The hero stage renders a lathed upper arm and forearm with a hand, tracking rings on the shoulder, elbow and wrist, the tracked segments drawn over the limb and a gauge ribbon sweeping the angle, driven by the same Motion value as the live readout numeral. It is lazy-loaded like the other scenes and falls back to a DOM callout without WebGL. The dashboard keeps the lighter joint scene.
- **The index is a scale.** On the landing, the five sections sit at equal intervals along a ruler whose cobalt fill tracks scroll progress. In the app, the rail's nav links share the rail's height in equal cells.

## Consequences

- `motion.tsx` gains `RuleDraw`, `MaskLines`, `WhenVisible` and a counting `AnimatedNumber`. `Strip` animates itself, so every page picks the reveal up without page-level changes.
- The landing page now imports the chart library. The main bundle grows by about 8 kB gzipped because the dashboard already loaded it. Splitting routes into separate chunks is the next lever if first-load size matters.
- `POST /api/dev/seed` accepts an optional `{ tzOffsetMinutes }` body (validated between -840 and 840). Without it, sessions are generated on UTC.
