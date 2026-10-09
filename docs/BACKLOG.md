# Product backlog

Prioritised top to bottom. Points are relative effort (1 = under an hour, 8 = most of a day). Acceptance criteria (AC) are what the tests must prove.

Owners: **FS** = full-stack (this repo), **CV** = computer-vision camera app.

## Epic A: Accounts and profiles (FS) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| A1 | As a user I sign up and log in so my household's data is private | email + password, bcrypt, 7-day JWT; visitors land on `/signup`; 401/404 tests | 8 | Done |
| A2 | As a user I keep one profile per person in the household | create, list, select, delete (cascades plans and sessions); profiles scoped to the account | 3 | Done |
| A3 | As a user I set a plan and a goal angle per profile | `PUT`/`PATCH /plan`; previous plan kept inactive; camera app can read it | 3 | Done |

## Epic B: Progress dashboard (FS) — Done

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| B1 | As a user I see peak range per session over time with my goal line | `/progress` returns oldest-first series + plan goal; line chart + reference line | 3 | Done |
| B2 | As a user I see the latest session rep by rep, and any session set by set | `latestSessionReps` labelled `S1 R1…`; `/sessions/:id` page | 2 | Done |
| B3 | As a user I see the fatigue proxy per session and sessions per week | fatigue line with nudge/stop lines; ISO-Monday weeks | 2 | Done |
| B4 | As a demo presenter I can load weeks of history instantly | `POST /api/dev/seed` idempotent per account; demo sessions labelled | 2 | Done |

## Epic C: Camera app integration (CV)

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| C1 | As a user the camera app tracks my joint angle and counts my reps and sets | angle from `EXERCISES[id].joints[side]` via `metricFromInnerAngle`; reps via the shared thresholds; rest countdown and fatigue early-stop | 13 | Ready |
| C2 | As a user I see my skeleton and the measured angle drawn over the video | overlay at ≥ 15 fps on a laptop; highlighted joint triple | 3 | Ready |
| C3 | As a user I'm told how to face the camera before a set | alignment check from landmark visibility; cue text per exercise | 3 | Ready |
| C4 | As a user my finished session shows up on the dashboard | camera app `POST /api/sessions` with `x-api-key` (README section 4); visible within seconds | 3 | Ready |

## Epic D: Launch and hardening (FS)

| # | Story | AC | Pts | Status |
|---|---|---|---|---|
| D1 | As a team we deploy to getarc.health | Render blueprint; GoDaddy records; HTTPS; `CORS_ORIGINS` set; smoke test | 5 | Ready |
| D2 | As a family member I switch to my profile quickly | profile switcher remembered per device, optional PIN | 3 | Backlog |
| D3 | As a user I export my sessions as CSV | `GET /api/profiles/:id/sessions.csv`; test for header + rows | 2 | Backlog |
| D4 | As a user I get helpful errors when the API is down | toast + retry; status dot already exists | 2 | Backlog |
| D5 | As a user I can reset a forgotten password | email link, token expiry, tests | 5 | Backlog |
