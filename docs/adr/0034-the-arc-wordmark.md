# ADR-0034: The ARC wordmark

- Date: 2026-10-11
- Status: accepted; replaces the tile-and-arc mark of ADR-0010

## Context

Jason shared an image of a new logo on 2026-10-11: "Use this for logo inspiration, replace any and all occurrences of the previous logo with this one."

The image is a heavy, forward-leaning ARC wordmark:
- the A a solid triangle whose foot is an arrow driving to the right;
- the R and C slanted, with their ends cut on the diagonal.

The old mark was a navy tile holding a white arc and a cobalt point, with the name set beside it in type.

## Decision

- The logo is now the ARC wordmark, redrawn as SVG paths (`Logo` in `frontend/src/components/icons.tsx`, and `docs/brand/arc-wordmark.svg`).
  - It is one colour: navy on paper, white on navy.
  - The name set in type beside the old mark is gone; the wordmark is the name.
- Where only a square fits, the A alone (`mark`) stands for it: the welcome chat's avatar, the phone bar, and the favicon (the A in white on a navy tile). The full wordmark would be unreadable at those sizes.
- **Every place the old mark stood:**
  - the app's rail;
  - the phone bar;
  - the sign-up and log-in header;
  - the landing page's header and footer;
  - the welcome chat's header and avatar;
  - the favicon;
  - the README.
- Every logo still leads back to the landing page.

## Consequences

- The wordmark is drawn from the image, not traced from a source file. If a vector original turns up, its paths can replace these four without touching anything else.
