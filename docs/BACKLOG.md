# Product backlog

Prioritised top to bottom. Points are relative effort (1 = under an hour, 8 = most of a day). Acceptance criteria (AC) are what the tests must prove.

Owners: **FS** = full-stack (this repo), **CV** = computer-vision camera app, **AI** = the ai-coach module (Gemini, ElevenLabs).

## Epic A: Accounts and profiles (FS) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| A1 | As a user I sign up and log in so my household's data is private | email + password, bcrypt, 7-day JWT; `/` landing, `/signup`, `/login`, app under `/dashboard`; 401/404 tests | 8 | Done |
| A2 | As a user I keep one profile per person in the household | create, list, select, delete (cascades plans and sessions); profiles scoped to the account | 3 | Done |
| A3 | As a user I set a plan and a goal angle per profile | `PUT`/`PATCH /plan`; previous plan kept inactive; camera app can read it | 3 | Done |

## Epic B: Progress dashboard (FS) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| B1 | As a user I see peak range per session over time with my goal line | `/progress` returns oldest-first series + plan goal; line chart + reference line | 3 | Done |
| B2 | As a user I see the latest session rep by rep, and any session set by set | `latestSessionReps` labelled `S1 R1…`; `/sessions/:id` page | 2 | Done |
| B3 | As a user I see the fatigue proxy per session and sessions per week | fatigue line with nudge/stop lines; ISO-Monday weeks | 2 | Done |
| B4 | As a demo presenter I can load weeks of history instantly | `POST /api/dev/seed` idempotent per account; demo sessions labelled | 2 | Done |

## Epic C: Tracking and recording (CV in the camera app, FS in the browser) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| C1 | As a user my joint angle is tracked and my reps and sets are counted | angle from `EXERCISES[id].joints[side]` via `metricFromInnerAngle`; reps via the shared thresholds; rest countdown | 13 | Done in the browser (PR #23, ADR-0017); the camera app counts its own |
| C2 | As a user I see my skeleton and the measured angle drawn over the video | the whole white skeleton as the camera app draws it, the measured joint and its angle in cobalt | 3 | Done (PR #23; full skeleton PR #32) |
| C3 | As a user I'm told how to face the camera before a set | waits until the movement's joints are visible; cue text per exercise | 3 | Done in the browser (PR #23) |
| C4 | As a user my finished session shows up on the dashboard | camera app `POST /api/sessions` with `x-api-key` (`main.py --profile`, `arc_upload.py`); visible within seconds | 3 | Done (PR #31; ADR-0023) |

## Epic D: Launch and hardening (FS)

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| D1 | As a team we deploy to getarc.health | Render blueprint; Porkbun records; HTTPS; `CORS_ORIGINS` set; smoke test | 5 | Done (live 2026-10-09) |
| D2 | As a family member I switch to my profile quickly | profile switcher remembered per device, optional PIN | 3 | Switcher done; PIN backlog |
| D3 | As a user I export my sessions as CSV | `GET /api/profiles/:id/sessions.csv`; test for header + rows | 2 | Backlog |
| D4 | As a user I get helpful errors when the API is down | toast + retry; status dot already exists | 2 | Backlog |
| D5 | As a user I can reset a forgotten password | email link, token expiry, tests | 5 | Backlog |
| D6 | As a first-time visitor the site opens fast | split the app's pages from the landing bundle (the main chunk is 1.2 MB before gzip); 3D and pose tracking already load on demand | 3 | Backlog |
| D7 | As a member my reps count the same in the browser and the camera app | one set of rep thresholds agreed with the CV team (`exercises.ts` ↔ `movements.py`) | 3 | Backlog (needs CV) |
| D8 | As a member Arc speaks in its ElevenLabs voice and Gemini's words on the live site | `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` set on `getarc-api`; record page says "ElevenLabs" | 1 | Ops (keys not set yet) |

## Epic E: Arc, the coach (FS + AI) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| E1 | As a new member I tell Arc what I want and get a week built for me | full page between sign-up and dashboard; nine topics incl. the ai-coach survey; every question skippable, "Build my week now"; Gemini week held to the member's days, the catalog and the goal's ranges | 8 | Done (PRs #25, #28, #30) |
| E2 | As a member my week works a different body area each day | no area two training days running; at least three areas from three days; Gemini weeks that repeat are replaced | 3 | Done (PR #30; ADR-0022) |
| E3 | As a member I see my week on a calendar | planned, done and not recorded days; today's workout and the way to record it | 3 | Done (PR #28) |
| E4 | As a member Arc reads each set and session back in its voice, hands-free | Gemini words, ElevenLabs voice, browser fallback; voice commands stored with the session | 5 | Done (PR #25) |

## Epic F: Every exercise, every session (FS + CV) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| F1 | As a member I can train any of the camera app's exercises | fifteen movements in four body-area tabs; everything on the dashboard and Record follows the pick | 8 | Done (PR #29; ADR-0021) |
| F2 | As a member nothing is lost if a recording stops early | every set saved to MongoDB as it finishes; the report says it stopped early | 3 | Done (PR #31; ADR-0023) |
| F3 | As a member I can delete my account | email, password and DELETE; everything removed; the old token refused | 3 | Done (PR #27; ADR-0019) |

## Epic G: The coach, the body and the week (FS + AI) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| G1 | As a member Arc listens the whole time I record and answers what I say | questions and feelings answered from the live numbers; cues after reps at most every 7 s; ElevenLabs for every line once the key is set; specific set reads without Gemini | 5 | Done (PR #33; ADR-0024) |
| G2 | As a member I see the movement done right and the muscles it works | anatomical body; target muscles red, helpers yellow; a form guide beside the camera; the back as upper back, lats and lower back; a side only where one is picked | 8 | Done (PR #34; ADR-0025) |
| G3 | As a member I arrange my own week and work through each day | edit any day by hand, several movements a day by muscle group; each day a checklist crossed out as sessions are recorded; Next to the following movement; Arc's week editable in the chat | 8 | Done (PR #35; ADR-0026) |
| G4 | As a household we see who moved most | weight held saved with each session; a leaderboard of the account's profiles by reps, sets, weight moved, steadiness and an Arc score | 5 | Done (PR #36; ADR-0027) |
| G5 | As a visitor the landing page shows the app as it is | all fifteen movements, the weight held, the body with its muscles, a demo household's leaderboard | 2 | Done (PR #37) |
