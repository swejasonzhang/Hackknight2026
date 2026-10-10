# ADR-0027: A household leaderboard, with the weight held on every session

- Date: 2026-10-10
- Status: accepted

## Context

Jason: "We can implement a leaderboard section within profile where it ranks you based on reps, weight, fatigue and sets. Everything factored in and compared with other profiles."

Two gaps stood in the way. Sessions recorded reps, sets and a fatigue proxy, but no weight. And nothing compared one profile with another.

## Decision

- **The weight held, per session.** Sessions take an optional `loadKg` (0 to 500; 0 means bodyweight, absent means not given).
  - The record page has **Weight held** under the live readings, in kilograms or pounds (remembered per browser). It is stored in kilograms, starts from the last weight used for the movement, and goes out with every set-by-set save.
  - The camera app takes `--weight` in kilograms.
  - The session report shows the weight.
- **Who is compared.** Only the profiles on the member's own account: the household. A personal, at-home app does not show strangers' training. A cross-account board would need its own opt-in and privacy decision.
- **What is compared.** Over this week, the last 30 days or all time (`GET /api/leaderboard?window=`), each profile gets:
  - reps and sets;
  - weight moved (reps times the weight held), plus its heaviest weight;
  - steadiness: 1 minus the mean fatigue proxy, over sessions with a set long enough to measure it.
- **The Arc score.** Each measure is taken against the household's best, and the results are averaged to 100. Leading on everything scores 100. Weight moved joins the score only once someone records a weight, so a household that never enters weights is not scored on it. Any single measure can rank the board too; ranking by fatigue puts the steadiest first, and ties share a place.
- **Where.** The Profiles page, under the register. The profile being viewed carries the cobalt edge, and demo data is labelled. The computation (`leaderboard`) is a pure function in the shared package, so the server and its tests use the same rules.

## Consequences

- The score is relative: adding a stronger household member lowers everyone else's score without anyone training less. The board says so ("each against the best here").
- Members only: the camera app's key gets `403`.
- Sessions recorded before this change have no weight. They count for reps, sets and steadiness, and as 0 kg moved.
