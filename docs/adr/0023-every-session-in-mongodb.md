# ADR-0023: Every set goes to MongoDB as it finishes, and the camera app sends its sessions too

- Date: 2026-10-10
- Status: accepted; closes backlog story C4

## Context

Jason asked that "the data from every session is stored in MongoDB and that the graphs or anything that needs data grabs from MongoDB accordingly." An audit found the signed-in app already reads everything from the API, so from MongoDB: readings, charts, the calendar, the day log, session reports and Arc's reads. Two gaps remained:

- **The browser saved a recording only at its very end.** A closed tab, a lost camera or a member who walked away lost every set.
- **The Python camera app never sent its sessions anywhere.** That was story C4.

## Decision

- **Set by set.** The browser saves a recording as it goes:
  - The first finished set creates the session (`POST /api/sessions`, `complete: false`).
  - Each later set replaces it with every set so far (`PUT /api/sessions/:id`).
  - The last set, or Finish and save, marks it complete.

  `SessionSaver` runs the saves one after another, so a quick second set never makes a second session. A failed save is made up by the next one, which carries everything so far. The server recomputes fatigue and the summary on every save; a complete session is final (409), and a session stays with its profile (400).
- **An unfinished recording is real data.** It shows on the dashboard like any other. Its report is labelled "Stopped early" and explains that every finished set was saved. Sessions from before this change, and any sent whole (the camera app), are complete.
- **The camera app sends its session.** Run from a plan with `--profile <id>` and `CV_API_KEY`, `main.py` turns the app's own export into Arc's session body (`arc_upload.py`):
  - reps grouped by set;
  - times rebuilt from each rep's duration and the time since the rep before, with the plan's rest between sets;
  - peaks converted to Arc's number for the movement (180 minus the smallest angle for bending movements, the largest angle for straightening ones);
  - the goal from the catalog.

  It posts with the key in a header, to `ARC_API_URL` (default `https://api.getarc.health`). HTTPS is required except to this computer. A test checks each movement's conversion and goal against `exercises.ts`.

## Consequences

- A session in progress is visible to the dashboard while it records, with the sets it has so far.
- The landing page's charts still use generated sample data. They are for visitors without an account, not anyone's sessions.
- CI runs every camera-app test module (`python -m unittest`).
