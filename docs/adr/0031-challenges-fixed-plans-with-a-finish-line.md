# ADR-0031: Challenges, fixed plans with a finish line

- Date: 2026-10-11
- Status: accepted

## Context

Jason: "There should be a challenge section where there is a fixed plan for people who want to get a certain physique within a certain time such as summer body or 1 year transformation."

Until now the week came from Arc's chat or from the member's own hand, and it stayed as it was until someone changed it. Nothing led toward a goal with a date on it.

## Decision

- **Eight challenges, defined in code** (`dependencies/src/challenges.ts`): Summer body (12 weeks), 1-year transformation (52), Strong arms (8), 30-day core (4), Legs and glutes (10), V-taper back (12), Strong back, better posture (6) and First month (4).
  - Each challenge is a run of phases. A phase is a week of training days built only from the catalog's fifteen movements, every goal inside its movement's range.
  - The phases step up: more sets, then heavier and harder movements, then a sharpening phase.
  - They are data, not database rows, so they are reviewed and tested like code. A test checks every phase against the catalog and the goal ranges.
- **One run at a time per profile** (`ChallengeRun` in MongoDB): the challenge, the start (the member's own midnight), the phase in force, and `active`, `done` or `left`.
  - **Starting** writes the first phase as the profile's week (`source: "challenge"`). The week it replaces stays in the history, and starting another challenge leaves the one under way.
  - **Each new phase replaces the week when it starts.** The server brings the run up to date before it answers for the run, the week or the plan, so the dashboard, the plan page, the recorder and the camera app all read the new phase from its first day.
  - A profile's challenge writes go one at a time (a queue per profile; the API is one Node process), so two reads at a phase boundary write the new week once.
  - **Leaving** keeps the week as it is, to keep or to change on the plan page.
- **Progress counts the member's own sessions**: a planned training day is done when any session was recorded that day, on the member's calendar. Today counts only once it is trained.
- **The body at the finish.** The detail grows the member's own body today through the plan's weekly sets with the same growth model as the history (`growWeek`, ADR-0030), so the figure shows where finishing the plan takes this member's body, not a stock picture.
- **Where it shows.** A Challenges page in the navigation (*Goals* on a phone): the run under way, every challenge as a card, and the picked one's detail. The dashboard names the challenge and its week beside the profile.

## Consequences

- Changing a challenge means editing `challenges.ts`. A run whose challenge was removed is ended as left rather than breaking its profile's pages.
- A challenge's week can still be changed by hand on the plan page. The next phase replaces it when it starts, as the page says.
- The finish body is a projection from the growth model, for motivation; it is not a promise, and the page does not present it as one.
