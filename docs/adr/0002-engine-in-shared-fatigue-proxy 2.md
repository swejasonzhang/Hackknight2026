# ADR-0002: Rep counting, fatigue proxy and session flow live in `dependencies`, and fatigue is a labelled proxy

- Date: 2026-10-09
- Status: accepted

## Context

Rep counting and the session state machine consume the angle stream the CV module produces, and the server must validate and summarise what the client saves. Fatigue has no ground truth a webcam can observe.

## Decision

- The engine (`RepCounter`, `OneEuroFilter`, `estimateFatigue`, `sessionReducer`) is pure TypeScript in `@arc/dependencies`, unit-tested, with no DOM, Node or MediaPipe imports.
- Fatigue is an explicit proxy: ROM decay plus tempo drift between the first and last reps of a set, with thresholds `FATIGUE_NUDGE = 0.12` and `FATIGUE_STOP = 0.25`. The UI says "ROM decay" and "tempo drift"; it never claims to measure fatigue.
- The server recomputes fatigue and the session summary from raw reps on `POST /api/sessions` and ignores the client's values.

## Consequences

- The CV module only has to emit `{ metricDeg, tMs, tracked }`; everything else is already tested.
- Thresholds can be tuned in one place and the tests pin their behaviour.
- Whoever reads the dashboard gets honest labels; the pitch should present the proxy the same way.
