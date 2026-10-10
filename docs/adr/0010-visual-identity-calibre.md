# ADR-0010: Visual identity "Calibre": a calibrated instrument on paper

- Date: 2026-10-10
- Status: accepted (supersedes ADR-0008 and ADR-0009)

## Context

Every earlier identity (white-and-blue, hardcore gym, neon black, neon black with 3D) kept the same compositions: a hero with cards on the landing, a brand panel beside a form card for the account pages, a sidebar with a row of stat tiles and a grid of chart cards in the app. Jason's directive asked for a ground-up redesign in a premium white-and-blue athletic identity: new layout, new composition, new typography, new component styling, new spacing and hierarchy, and one design system, with the old presentation explicitly not the blueprint.

## Decision

- **Metaphor.** The camera app is the sensor; the web app is the instrument that reads it out. The interface is drawn as a calibrated instrument on an engineering sheet: paper panels on a vellum bench, hairline rules and corner registration marks instead of cards, mono readouts and rulers, and one oversized number per page.
- **Colour.** White (`--paper`) carries every reading; the bench between panels is off-white (`--vellum`), which makes panels read without borders or shadows. Navy (`--navy` #0b1b3a) is the chassis only: the 56 px instrument rail, masthead bands, block buttons, the 3D bones, the goal rule. Cobalt (`--cobalt` #0b3dff) is measurement ink only: the big readout numeral, the gauge, the data line, links, the energised edge of a control, the focus ring; it never fills an area larger than a 3 px edge or a lamp. Status is a lamp plus a mono tag (OK / ERR / NOTE), never a coloured box; success, warning and error colours are distinct and only used for status.
- **Type.** Unbounded (wide geometric display, 500 to 700) for display headlines, page titles, strip titles and readout numerals; IBM Plex Sans for body and input values; IBM Plex Mono for every instrument voice: labels, tags, buttons, validation, metadata, axis ticks, ledger numbers. The scale lives as `.t-*` classes.
- **Composition.** No top navigation bar and no sidebar of pills. Signed-in routes sit on a fixed 56 px navy rail with vertical mono labels (a bottom instrument bar on phones) beside a vellum bench. The dashboard is a sticky measurement panel (profile switcher, exercise switch, the 3D specimen on a blueprint grid, a ledger of readouts) beside a single column of numbered, ruled strips. Profiles are a register ledger whose last row is the create form. A session is a lab report: a sticky stage beside the report with one giant readout. Account pages are a navy masthead band over an off-centre datasheet of ruled rows with lamps, with deliberate emptiness beside it. The landing is a sticky title block and index beside a datasheet-like column: display headline, the live specimen stage with a spec list, numbered strips, two navy bands.
- **Components.** Square corners everywhere; `.btn` (hairline), `.btn-block` (navy with a cobalt edge), `.btn-ghost`, `.btn-danger`; `.input` with a square SHOW / HIDE toggle; `.datasheet` rows; `.ledger`; `.readout-row`; `.switch` (Radix Tabs); `.alert-strip`; `.hatch` for loading. Focus-visible is a 2 px cobalt outline everywhere.
- **Motion.** Instruments settle; they do not bounce or fade in on scroll. 120 ms colour changes, 240 ms layout moves, 320 ms strips appearing, a 600 ms count for readout numerals, a 700 ms needle sweep; one easing. Everything respects `prefers-reduced-motion`, and the design reads the same with motion off.
- **3D.** The joint and progress scenes stay as the fitness-technology element, re-themed for paper (navy bones, cobalt ink, a light blueprint grid) and lazy-loaded with a DOM fallback.

## Consequences

- `frontend/src/index.css` is a new system; nothing from the earlier systems remains, and no overrides stack on old rules.
- Primitive names in `ui.tsx` are kept (Card, StatTile, EmptyState, PageHeader, Avatar, Segmented, Skeleton, Alert) so page code and the tests' contracts survive, but each is a different component visually; `Lamp`, `Tag` and `Strip` are new.
- The effects layer from ADR-0009 (spotlight cards, magnetic buttons, scroll progress, parallax) is removed: it belonged to the glow aesthetic.
