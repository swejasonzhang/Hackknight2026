# ADR-0035: A site-wide sweep: speed, search, screen sizes and verified fixes

- Date: 2026-10-11
- Status: accepted

## Context

Jason: "We'll do a site wide sweep that looks for bugs. Ensure that the whole application is fully mobile responsive as well as fits into different screen sizes. Minimize latency for the web. If there is enough time, SEO."

What the sweep measured:

- **Download.** Every visitor downloaded every page's code first: one 355 KB (gzipped) bundle, including the chart library.
- **The body file.** It was served uncompressed (743 KB).
- **Caching.** No cache headers were set.
- **The API.** It sleeps on Render's free plan, so the first sign-in waited for it to wake.

## Decision

- **Split by route.**
  - Only the landing page ships with the first download: about 222 KB gzipped.
  - Every other page loads when it is first visited, behind a placeholder of a screen's height, so nothing jumps.
  - The pages a visitor most likely opens next are fetched when the browser is idle.
  - The landing's readouts board, and the chart library under it, load when a visitor scrolls near it.
- **A gzipped body.** The bake also writes `body.bin.gz` (430 KB). The browser unpacks it with its own `DecompressionStream`, and falls back to the plain file where it cannot. A host that unpacks it on the way is detected by the gzip header.
- **Caching.** Hashed files under `/assets/` are cached for a year. `index.html` is always rechecked, so a release is picked up at once.
- **A warm API.** The landing page pings `/api/health` in the background, so the API is awake by the time a visitor signs in.
- **Search and sharing.**
  - A descriptive title, a canonical link, and Open Graph and Twitter cards with a 1200×630 social image.
  - JSON-LD (`WebApplication`), `robots.txt` (the app behind sign-in is not indexed), a sitemap and a home-screen icon.
  - Each page sets its own title.
- **Screen sizes.**
  - An automated audit loaded every route at twelve widths from 320 to 1920 px (144 pages). It checked for sideways scroll, elements outside the viewport, and clipped or spilling text.
  - The only real finding: the plan log's date was cut off on the narrowest phones. It now shortens there.
- **Bugs.**
  - Five reviewers each read one area: the pages, recording and voice, the API, the 3D figure and landing, and the shared engine.
  - A second agent tried to refute each finding before anything was fixed.
  - The confirmed fixes, each with a test, are listed in the pull request. Among them:
    - the camera app's shared key could delete any profile;
    - logins had no throttle;
    - the dashboard showed the previous profile's numbers while the next loaded;
    - a failed final save threw the recording away;
    - "Am I done?" ended the session;
    - the demo data never reached its goals.

## Consequences

- A first visit to a page other than the landing waits for that page's code: a few KB to a few tens of KB, usually already fetched while the browser was idle.
- The repository holds the body twice, plain (for the tests and old browsers) and gzipped. The bake writes both.
- Two findings are left for a decision:
  - Weekly charts group sessions by UTC week rather than the member's own. The dashboard's "this week" tile is already local.
  - A challenge's week turns an hour off across a clock change.
