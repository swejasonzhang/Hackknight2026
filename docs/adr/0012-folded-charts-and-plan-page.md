# ADR-0012: Folded charts on the dashboard, and a plan page with a day-by-day log

- Date: 2026-10-10
- Status: accepted (amends the dashboard composition in ADR-0010)

## Context

The dashboard had grown into one long column: four charts, a 3D view, a table of recent sessions and the plan form. Jason asked for the graphs to be compressed into a plus sign that expands, for the plan to move into the sidebar as its own page, and for that page to carry the log on the right, at 30 to 70, where you can cycle through days to see your workouts and progress.

## Decision

- **Dashboard charts fold.** Every chart is a row with its index, its title, its latest reading and a plus. Pressing the row unfolds the chart, which draws itself in each time it opens. Several can be open at once, and one control opens or closes them all. They are built on Radix Accordion, the same as the FAQ. The measurement panel stays, and its plan line links to the plan page.
- **The plan has its own page, `/plan`, third in the rail between Dashboard and Profiles.** On desktop the plan form takes 30 % of the width and stays in view while you scroll. The log takes the other 70 %. Below 1024 px they stack, plan first.
- **The log goes one day at a time.** Arrows step a day back or forward, and the log never steps past today or before the first workout. A seven-day strip shows the week, with one lamp per workout, and picks a day. Each workout shows its readings and how its best rep moved against the previous session of the same movement and side, against the first one, and against the goal it was counted against. A range meter sets the best rep, the previous best and the goal side by side. A day without workouts is a rest day and offers the last workout before it.
- **Days are the viewer's calendar days.** Sessions are grouped by local date with calendar arithmetic, so daylight saving cannot skip or repeat a day. The chosen day lives in the URL (`/plan?day=YYYY-MM-DD`), and a session opened from the log returns to the same day.

## Consequences

- The plan page needs every session of a profile, which `GET /api/profiles/:id/sessions` already returns. No API change.
- `WhenVisible` from ADR-0011 is removed: a folded chart mounts when it is opened, which serves the same purpose.
- The session page's back link follows where the session was opened from, and defaults to the plan page.
