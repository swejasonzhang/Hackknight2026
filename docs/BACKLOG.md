# Product backlog

Prioritised top to bottom. Points are relative effort (1 = under an hour, 8 = most of a day). Acceptance criteria (AC) are what the tests must prove. Move stories to the board (GitHub Projects or the whiteboard) when a sprint starts; this file stays the source of truth for the wording.

Owners: **FS** = full-stack (this repo), **CV** = computer-vision teammates.

## Epic A: Core session loop (FS) — DONE in sprint 0

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| A1 | As a user I see a live angle readout so I know the app is tracking me | readout updates ≥ 10×/s; shows "move into frame" when untracked | 2 | Done (simulator) |
| A2 | As a user my reps are counted automatically | hysteresis counter; wobble never double counts; < `minRepMs` ignored; per-rep peak + duration recorded | 3 | Done |
| A3 | As a user I get sets, a rest countdown, pause and resume | idle→align→active→rest→…→complete; pause freezes counting and the countdown; skip rest; end set | 3 | Done |
| A4 | As a user my session is saved when it ends | `POST /api/sessions` with sets; server recomputes fatigue + summary; 400 on bad body; 404 on unknown profile | 3 | Done |
| A5 | As a user I'm nudged, then rested early, when my range fades | index ≥ 0.12 nudge; ≥ 0.25 early rest with the reason shown | 2 | Done |

## Epic B: Progress dashboard (FS) — DONE in sprint 0

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| B1 | As a user I see peak ROM per session over time with the target line | `/progress` returns oldest-first series + plan target; line chart + reference line | 3 | Done |
| B2 | As a user I see the latest session rep by rep | `latestSessionReps` labelled `S1 R1…`; bar chart | 1 | Done |
| B3 | As a user I see the fatigue proxy per session and adherence per week | fatigue line with nudge/stop lines; sessions-per-week bars (ISO Monday weeks) | 2 | Done |
| B4 | As a user I set and adjust my own plan | `PUT`/`PATCH /plan`; previous plan kept inactive; the Session page loads the active plan | 3 | Done |
| B5 | As a demo presenter I can load weeks of history instantly | `POST /api/dev/seed` idempotent; "Load demo data" button; demo sessions labelled | 2 | Done |

## Epic C: Computer vision (CV) — NEXT

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| C1 | As a user the webcam tracks my joint angle | `CameraMotionSource` implements `MotionSource`; emits `metricDeg` from `EXERCISES[id].joints[side]` via `metricFromInnerAngle`; `tracked:false` when a landmark's visibility < 0.5 | 8 | Ready |
| C2 | As a user I see my skeleton and the measured angle drawn over the video | overlay follows the video at ≥ 15 fps on a laptop; highlighted joint triple | 3 | Ready |
| C3 | As a user I'm told how to face the camera before a set | alignment check uses landmark visibility (and optionally the 2D/3D angle gap); cue text per exercise | 3 | Ready |
| C4 | As a developer I can switch between simulator and camera | source picker on the Session page; simulator stays available for demos and tests | 1 | Ready |

## Epic D: Hardening (FS)

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| D1 | As a user I sign up and log in so my profiles are private to my household | email + password, bcrypt, JWT; `ownerId` on profiles; 401/404 tests | 8 | Backlog (deferred 2026-10-09: functionality first) |
| D2 | As a family member I switch to my profile quickly | profile switcher remembered per device, optional PIN | 3 | Backlog |
| D3 | As a team we deploy to the real domain | Atlas + API host + static host; DNS at GoDaddy; HTTPS; `CORS_ORIGINS` set; smoke test in CI | 5 | Backlog |
| D4 | As a user I export my sessions as CSV | `GET /api/profiles/:id/sessions.csv`; test for header + rows | 2 | Backlog |
| D5 | As a user I get helpful errors when the API is down | toast + retry; health badge already exists | 2 | Backlog |

## Epic E: Parked (not in scope now)

| # | Story | Note |
|---|---|---|
| E1 | AI coach voice conversation | Removed from scope on 2026-10-09. If revived: `POST /api/pt/chat` grounded in `ProgressDto`, structured "adjustment" applied through `applyAdjustment`. |
| E2 | Text-to-speech / speech-to-text provider | Removed with E1. |
