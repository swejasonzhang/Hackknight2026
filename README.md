# Arc

**Range of motion is an arc.** Arc is a webcam goniometer for home use, for anyone at any age, live at [getarc.health](https://getarc.health). After sign-up, **Arc** (Gemini) asks what you want from your body in a short chat (every question skippable) and builds your training **week**, one body area per training day, shown on a calendar on the dashboard. Press **Start recording** and the browser watches you exercise through the webcam: MediaPipe pose tracking runs on your device, draws the same white skeleton as the camera app, measures joint range of motion (ROM) in degrees for any of fifteen movements, counts reps and sets, and saves every set to MongoDB as it finishes; the video never leaves the device. **This repository is the web app and API**: accounts, one profile per person in the household, recording, and dashboards that show progress over weeks. The teammates' Python camera app (`computer-vision/`) measures the same movements and posts its sessions to the same API; their `ai-coach/` module is where Arc's prompts and voice started. It is a personal tool, not a clinical one: no doctor or therapist sees the data.

Stack: MongoDB Atlas · Express 5 · React 19 · Node 20 (MERN), TypeScript everywhere, Vite, Tailwind CSS 4, Motion, MediaPipe Tasks Vision (pose tracking in the browser), Gemini and ElevenLabs (Arc, the coach), the Web Speech API (hands-free commands), React Three Fiber (a whole 3D human body for every movement, and progress bars), Radix (accordion, select, tabs, tooltip), Vitest. Hosted on Render, domain at Porkbun. Visual identity "Calibre": white and blue, an instrument on paper; Unbounded, IBM Plex Sans and IBM Plex Mono; navy rail, cobalt readouts, a whole 3D human body posed for each of the fifteen movements, its tracked joints the camera's (ADR-0010, ADR-0014, ADR-0021). Every dropdown is a Radix Select drawn in the same system. The landing page runs a whole 3D body through elbow-flexion reps and a demo board that draws six random weeks with the app's own generator and charts (ADR-0011).

---

## 1. Quick start

Prerequisites: **Node 20.19 or newer** (`.nvmrc` says 20; `nvm use` picks it), npm 10, and the team's MongoDB Atlas connection string.

```bash
git clone https://github.com/swejasonzhang/Hackknight2026.git arc && cd arc
npm install            # all three workspaces; first run also downloads a MongoDB test binary (~150 MB)
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET; CV_API_KEY and the Arc keys are optional (see below)
npm run dev            # API on :8787, web app on :5173
```

Open <http://localhost:5173>. `/` is the landing page; **Create account** takes you to `/signup` (one account per household), then to `/welcome`, a full-page chat with Arc, and on to the app at `/dashboard`. The Arc logo in the app leads back to the landing page, where **Open dashboard** returns you to the app. Then:

1. **Welcome** → Arc asks what you want from your body, strength, muscle or stamina, where to start (every exercise, by area), the side, limits, experience, training days, height and weight. Tap a quick reply, type or speak; **Skip this question** passes on one, **Build my week now** stops the questions, **Skip for now** leaves. Arc saves the answers on your profile and builds your week.
2. **Dashboard** → pick who you're looking at, then a body area (Upper body, Back, Legs, Core) and an exercise. The panel reads out the latest session on a whole 3D body at adult proportions, posed for that movement and working through its range, rep after rep, over a faint band that marks the range covered; the calendar shows your week, marking the days that hold the picked exercise; every chart is folded behind a **+**: peak ROM per session against your goal, the latest session rep by rep, the fatigue proxy, sessions per week and a 3D view. **Profiles** → **Add a profile** for everyone else at home, or **Load demo data** for six weeks of random sessions across all fifteen movements.
3. **Record** → **Start recording** opens the webcam in the browser for the picked exercise at its prescription (your plan, else your week, else your goal's ranges); sets and rests run by themselves and every set is saved as it finishes (section 4b).
4. **Plan** → the plan (sets, reps, rest, goal angle) on the left, the log on the right (30 to 70). Step through the days to see each workout against the previous session, the first one and the goal; open a workout for the set-by-set view. **Account** (your avatar) → log out, or delete the account and everything in it.

Real sessions come from recording in the browser (section 4b) or from the Python camera app (section 4c). The API refuses to start without `MONGODB_URI` and `JWT_SECRET`, and prints what is missing; without `CV_API_KEY` it starts but warns that the camera app cannot store sessions.

## 2. Configuration

Copy `.env.example` to `.env` at the repo root. Only the backend reads it.

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | **Required.** `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/arc?retryWrites=true&w=majority`. A local server also works: `mongodb://127.0.0.1:27017/arc`. If the cluster refuses the connection the API prints why and retries every 10 s. |
| `JWT_SECRET` | **Required.** Signs login tokens. Any long random string: `openssl rand -hex 32`. |
| `CV_API_KEY` | Shared secret the camera app sends as `x-api-key` when it stores sessions or reads a plan. `openssl rand -hex 32`. Without it the camera app cannot write. |
| `GEMINI_API_KEY` | Optional. Arc's words (onboarding chat, set and session reads) from Gemini. Without it Arc asks its own questions and reads sessions from templates built on the same numbers. Server-side only; sent in the `x-goog-api-key` header. |
| `GEMINI_MODEL` | Optional, default `gemini-3.8-flash` (the ai-coach module's default). |
| `ELEVENLABS_API_KEY` | Optional. Arc's voice (ElevenLabs `eleven_turbo_v2_5`). Without it the browser speaks Arc's lines with its own voice. Server-side only. |
| `ELEVENLABS_VOICE_ID` | Optional, default `21m00Tcm4TlvDq8ikWAM`; the ai-coach module lists other voices. |
| `COACH_MAX_PER_MINUTE` | Optional, default 40: how many Arc requests one account may make a minute (the paid APIs sit behind them). |
| `PORT` | API port, default `8787`. The Vite dev server proxies `/api/*` here. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed in production, e.g. `https://getarc.health,https://www.getarc.health`. |
| `NODE_ENV` | `production` on Render. `/api/dev/seed` stays available in every environment (signed-in accounts only). |

`npm run seed -- you@example.com` loads the demo profile into the account with that email (the in-app button does the same through `POST /api/dev/seed`).

## 3. Everyday commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | API + web app with hot reload (`npm run dev:backend` / `npm run dev:frontend` for one of them) |
| `npm test` | All JavaScript test suites: shared engine, API (against a throwaway in-memory MongoDB), frontend |
| `cd computer-vision && python3 -m unittest` | The camera app's tests (plan mapping, upload to Arc); CI runs them too |
| `npm run test:watch -w dependencies` (or `-w backend`, `-w frontend`) | Watch mode for one workspace while doing TDD |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run build` | Production build of the web app into `frontend/dist` |
| `npm run seed -- <email>` | Seed demo data into that account |

## 4. How sessions get into the database

Two things record sessions, and both write through this API, so every session lands in MongoDB and every chart reads it from there:

- **The browser** (section 4b), as the signed-in member: the first finished set creates the session (`POST /api/sessions` with `complete: false`), each later set updates it (`PUT /api/sessions/:id`), the last marks it complete.
- **The Python camera app** (section 4c), with the `x-api-key` header: the whole session once it ends.

The server validates the body and recomputes the fatigue proxy and the summary from the raw reps every time, so the dashboard needs nothing else.

```http
POST /api/sessions
x-api-key: <CV_API_KEY>
content-type: application/json

{
  "profileId": "<id from GET /api/profiles>",
  "exercise": "elbow_flexion",
  "side": "right",
  "startedAt": 1760000000000,
  "endedAt": 1760000600000,
  "plan": { "sets": 3, "reps": 8, "restSeconds": 45, "targetDeg": 140 },
  "sets": [
    {
      "setNumber": 1,
      "reps": [
        { "index": 1, "peakDeg": 131.5, "startedAt": 1760000001000, "endedAt": 1760000003200, "durationMs": 2200 }
      ],
      "fatigue": { "index": 0, "romDecay": 0, "tempoDrift": 0, "romDropDeg": 0, "sampleReps": 0 },
      "startedAt": 1760000001000,
      "endedAt": 1760000030000,
      "endedEarly": false
    }
  ]
}
```

- Timestamps are milliseconds since the epoch. `fatigue` may be zeros; the server overwrites it.
- With the API key the camera app can also read any profile (`GET /api/profiles`, `GET /api/profiles/:id/plan`) to know who is exercising and what their plan is.
- The exact schema is `CreateSessionSchema` in `dependencies/src/api.ts`; the TypeScript types are in `dependencies/src/engine/types.ts`. Writing straight into the `sessions` collection also works if the documents follow `backend/src/models/Session.ts`, but then nothing recomputes the summary.

### What the engine defines

`@arc/dependencies` is pure TypeScript shared by the server and the browser recorder (the Python app keeps its own catalog in `movements.py`, which `arc_routine.py` and `arc_upload.py` map onto these ids):

- `EXERCISES` (`dependencies/src/engine/exercises.ts`): for each exercise, which three landmarks form the angle, how the inner angle becomes the metric (`metricFromInnerAngle`, always "more degrees = deeper into the rep"), the rep thresholds (`enterDeg`, `exitDeg`), the jitter floor (`minRepMs`), the default goal, and the cue that tells the user how to face the camera.
- `RepCounter`: the hysteresis rep counter (leave rest, pass `enterDeg`, return to `exitDeg` = one rep; shorter than `minRepMs` = ignored). `OneEuroFilter` smooths the angle stream first.
- `estimateFatigue`: the proxy below. `summarizeSets`: the per-session roll-up.

| Exercise | Joint (landmarks) | Metric shown and counted | Enter / exit | Default goal |
|---|---|---|---|---|
| Bicep curl | shoulder – elbow – wrist | 180° − inner angle | 90° / 40° | 140° |
| Tricep extension | shoulder – elbow – wrist | inner angle | 140° / 70° | 170° |
| Shoulder press | hip – shoulder – elbow | inner angle | 150° / 95° | 170° |
| Lateral raise | hip – shoulder – elbow | inner angle | 70° / 30° | 90° |
| Front raise | hip – shoulder – wrist | inner angle | 120° / 30° | 135° |
| Chest press | shoulder – elbow – wrist | inner angle | 150° / 80° | 170° |
| Pec fly | left wrist – left shoulder – right wrist | 180° − inner angle | 150° / 105° | 160° |
| Lat pulldown | hip – shoulder – elbow | 180° − inner angle | 105° / 35° | 120° |
| Bent-over row | shoulder – elbow – wrist | 180° − inner angle | 105° / 35° | 115° |
| Deadlift | shoulder – hip – knee | inner angle | 160° / 130° | 175° |
| Squat | hip – knee – ankle | 180° − inner angle | 90° / 20° | 100° |
| Lunge | hip – knee – ankle | 180° − inner angle | 80° / 30° | 90° |
| Seated knee extension | hip – knee – ankle | inner angle | 150° / 110° | 175° |
| Crunch | shoulder – hip – knee | 180° − inner angle | 45° / 22° | 55° |
| Ab twist | both shoulders | shoulder line against the level | 22° / 8° | 30° |

### Fatigue proxy (not a clinical measure)

For a set with at least 4 reps, compare the first k reps with the last k (k ≤ 3):

```
romDecay   = (mean peak of first k − mean peak of last k) / mean peak of first k
tempoDrift = (mean duration of last k − mean duration of first k) / mean duration of first k
index      = clamp(0.6 · romDecay + 0.4 · tempoDrift, 0, 1)       (only losses count)
```

The dashboard draws `0.12` (nudge) and `0.25` (early rest) as reference lines and labels the quantity "ROM decay + tempo drift", never "fatigue" as a diagnosis.

## 4b. Recording in the browser, the exercises and Arc

### Recording in the browser (no install)

The web app tracks the body itself (ADR-0017). The dashboard's **Record a session** panel has a **Start recording** button that opens `/record`: the browser asks for the camera once, MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`, the same pose model family as the Python app) runs on the device, and counting begins as soon as the movement's joints are in view. The plan's sets, reps and rest run by themselves. **Every set is saved to MongoDB as it finishes** (ADR-0023): the first set creates the session (`POST /api/sessions`, `complete: false`), each later set updates it (`PUT /api/sessions/:id`), and the last set (or **Finish and save**) marks it complete and opens its report. A recording that stops early, a closed tab or a lost camera, keeps every set that finished; its page says it stopped early, and the dashboard counts it. Over the camera the page draws MediaPipe's whole skeleton in white, head to feet, the same 35 lines the camera app draws, with the measured joint and its angle in cobalt on top (`frontend/src/record/overlay.ts`). The video never leaves the device; only the angle of each rep is stored.

How the angle becomes reps reuses the shared engine: each exercise's landmarks, metric and thresholds (`dependencies/src/engine/exercises.ts`), the One Euro filter and the hysteresis rep counter. `frontend/src/record/angle.ts` reads the joint (correcting for the video's aspect ratio, ignoring low-visibility landmarks) and `recorder.ts` runs the session. The WebAssembly runtime ships with the app (about 3.5 MB gzipped, loaded only on `/record`); the lite pose model loads from MediaPipe's model storage. In development, `/record?simulate` replaces the camera with a pretend person doing reps.

Every number the signed-in app shows comes from MongoDB through the API: the dashboard's readings and charts (`/progress`), the calendar and the day log (`/sessions`, `/program`), the session report (`/sessions/:id`) and Arc's reads (`CoachMessage`, `coachSummary`). Only the public landing page draws generated sample data, for visitors without an account.

### Fifteen movements, four areas

Arc tracks every exercise in the camera app's catalog (`computer-vision/movements.py`) plus the seated knee extension (ADR-0021), defined once in `dependencies/src/engine/exercises.ts` with the catalog's landmarks and thresholds:

| Area | Movements |
| --- | --- |
| Upper body | Bicep curl, Tricep extension, Shoulder press, Lateral raise, Front raise, Chest press, Pec fly |
| Back | Lat pulldown, Bent-over row, Deadlift |
| Legs | Squat, Lunge, Seated knee extension |
| Core | Crunch, Ab twist |

The dashboard picks one from four body-area tabs and keeps it in `?exercise=`. Everything follows the pick: the 3D body (each movement has its own whole-body pose, from a curl to a lying crunch, with the goniometer on the measured joint), the readings and charts, the calendar (days that hold it are marked) and **Start recording**, which runs it at its prescription: the saved plan when it is for that movement, else the week Arc built, else the member's goal ranges (`prescriptionFor`). The browser tracker reads any of them, the ab twist as the shoulder line against the level; the development simulator takes its landmarks from the 3D body itself, so the figure, the tracker and the simulator always agree. Arc's "where to start" shows the whole catalog by area, and Gemini is given the same list.

### Arc, the coach (Gemini + ElevenLabs)

Arc is the coach across the whole app (ADR-0018); the name never changes.

1. **After sign-up**, `/welcome` is its own full page between sign-up and the dashboard (ADR-0020): a chat in which Arc (Gemini) asks, one question at a time, what the member wants from their body, whether they want strength, muscle or stamina, where to start (every exercise in the catalog, shown by area), the side, injuries or limits, experience, which days they can train, and their height and weight (both skippable). Quick replies answer the common cases in a tap; typing and speaking work too. **Skip this question** passes on any question (Arc takes a sensible default and moves on), **Build my week now** stops the questions and builds the week from what has been said, and **Skip for now** leaves without a week. When Arc has enough it saves the answers on a new profile (`intake`) and builds the member's **week** (`Program`): their training days, each working one body area in turn (upper body, legs, back, core, starting from the focus's area), never the same area two training days running, the focus movement opening the week, with sets, reps and rest inside the training goal's ranges from the ai-coach module (strength 2-4 × 2-6 with 120-300 s rest, muscle 3-5 × 8-12 with 60-180 s, stamina 2-4 × 13-25 with 30-60 s). Gemini writes the week; the server keeps only the member's days and catalog movements, clamps the numbers into range, takes goal angles from the catalog and throws out a week that keeps to one area, falling back to Arc's own week. The dashboard shows it as a **calendar** under Record a session: training days planned, done or not recorded, today ringed, and the selected day's workout beside the grid. Every line of the chat is stored (`CoachMessage`). A profile without a week gets "Plan my week with Arc" on the calendar.
2. **While recording**, Arc is always listening, hands-free, through the browser's speech recognition, and always ready to talk (ADR-0024). Anything said to Arc that is not a command (a question, how it feels, "Arc, …") gets an answer from the live numbers (`POST /api/coach/ask`: Gemini's words, or Arc's own: pain means stop and check with a professional, form gets the last rep against the goal, hard or easy gets a concrete change), and after each rep Arc may coach it ("Go a little deeper.", "Slow down, lower it with control.", "Your range is fading.") at most every seven seconds. The commands: *start*, *pause* (the rest countdown freezes too), *resume*, *skip* (cut the set short, or skip the rest), *rest*, *stop* (finish and save), *how many* (Arc reads the count) and *repeat*. Short phrases count; longer talk only when it is addressed to Arc ("Arc, can we pause"); "don't stop" does not stop. Arc is muted while it speaks so it never hears itself. Every command is saved with the session (`events`). Pause and Skip are buttons too.
3. **After each set**, during the rest, Arc reads the set back in plain English in its voice: Gemini's words, or Arc's own specific read (the best and lowest rep, how many reached the goal, the tempo, one concrete thing for the next set).
4. **After the session**, the report opens and Arc reads the whole session aloud: what went well, how it compares with the last session and the first one, what needs work, and one next step. The read is stored on the session (`coachSummary`) and shown under each workout in the plan page's log, so progress can be compared over time.

**What leaves your device.** Never the video. The angles of each rep go to the API and MongoDB. When Arc's services are switched on, the onboarding chat and a session's numbers go to Gemini to write Arc's words, Arc's lines go to ElevenLabs to be spoken, and hands-free commands go through the browser's speech recognition (Chrome sends that audio to Google).

Gemini and ElevenLabs run only on the server (`backend/src/services/gemini.ts`, `voice.ts`, and Arc's prompts in `arc.ts`, ported from the teammates' `ai-coach/` module); keys travel in headers, never URLs, and never reach the browser. Without `GEMINI_API_KEY` every flow still works (Arc's scripted questions and templates, marked "Gemini off"); without `ELEVENLABS_API_KEY` the browser speaks Arc's lines, and the record page says so. With it, every line Arc speaks is ElevenLabs: stored lines by id, short ones (acknowledgements, cues) through `POST /api/coach/speak`, cached on the server so a repeat costs nothing; each page learns which voice it has before Arc's first word. Routes: `GET /api/coach/status`, `POST /api/coach/onboarding` (each reply names the `topic` it asks about; the last carries `intake`, `plan` and `program`), `POST /api/coach/ask` (live answers, both lines stored), `POST /api/coach/speak` (MP3 for a short line), `POST /api/coach/sets`, `POST /api/coach/sessions/:id/summary` (once per session), `GET /api/coach/messages/:id/audio` (MP3, owner only); signed-in members only, rate-limited per account.

## 4c. The camera app (Python)

The computer-vision side lives in [`computer-vision/`](computer-vision/) as a Python 3.12 project managed with [uv](https://docs.astral.sh/uv/): `main.py` starts `ExerciseTracker` from `movements.py`, which uses OpenCV and MediaPipe to track the joint, count reps against flex/extend thresholds and time rest.

```bash
cd computer-vision
uv sync          # installs mediapipe and opencv into .venv
uv run main.py   # opens the webcam window
```

Started with `--profile <profile id>` and `CV_API_KEY` set, it sends the finished session to Arc (`computer-vision/arc_upload.py`, ADR-0023): `POST /api/sessions` with the `x-api-key` header to `ARC_API_URL` (default `https://api.getarc.health`; plain HTTP only to this computer). Each rep's time is rebuilt from the app's own log, its peak converted to Arc's number for the movement, and the session lands in MongoDB beside the browser's.

The Python app can still start straight into a plan: `uv run main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45`, and with `--profile <id>` (and `CV_API_KEY`) it saves the session to Arc when the routine ends.

Its tracking and thresholds are the computer-vision team's; the browser's numbers come from the shared engine (section 4), mapped onto the same fourteen catalog movements.

## 5. API reference

Base URL in development: `http://localhost:8787`. All bodies are JSON. Validation errors return `400 { error: "Invalid request", issues: [...] }`; unknown or foreign ids return `404`; missing credentials, or a token for an account that has been deleted, return `401`.

**Credentials.** Browser requests send `Authorization: Bearer <token>` (from signup or login, valid 7 days). The camera app sends `x-api-key: <CV_API_KEY>` instead and may access every profile. Users only ever see their own profiles.

**Names and emails.** One rule, shared by every form and the API (`dependencies/src/fields.ts`): a name is letters (any alphabet), spaces, apostrophes, hyphens or periods, at least one letter, up to 80 characters; an email is a real address like `name@example.com`, up to 254 characters. Each field states its requirement under it, names the exact problem once it is left, and the submit button waits until every field passes.

**Deleting an account.** The account tag (the avatar on the rail, or the last cell of the phone bar) opens `/account`: who is signed in, Log out, and Delete account. Deleting asks for the account's email and password again and for `DELETE` typed out; the server checks the pair, removes the account with every profile, plan, session and Arc message, and the old token stops working at once. A wrong pair answers `403` (not `401`, so a typo does not sign the member out) and five wrong tries in 15 minutes lock the form for the rest of that window. The password is never logged or echoed back.

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/health` | | `{ ok, db: "connected" \| "disconnected", uptime }` (open) |
| `POST /api/auth/signup` | `{ name, email, password (≥ 8) }`, name and email by the rule above | `201 { token, user }`; `409` if the email exists (open) |
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`; `401` on a bad pair (open) |
| `GET /api/auth/me` | | the signed-in user |
| `POST /api/auth/account/delete` | `{ email, password, confirm: "DELETE" }` | `204`; the account and all of its data are gone. `403` on a wrong pair, `429` after five wrong tries in 15 minutes (users only) |
| `GET /api/profiles` | | your profiles, newest first (API key: all profiles) |
| `POST /api/profiles` | `{ name, email?, notes? }` | `201` profile (users only) |
| `GET /api/profiles/:id` | | profile |
| `DELETE /api/profiles/:id` | | `204`; also deletes its plans and sessions |
| `GET /api/profiles/:id/plan` | | active plan (`404` if none) |
| `PUT /api/profiles/:id/plan` | `{ exercise, side, sets, reps, restSeconds, targetDeg }` | `201` new active plan; the previous one is kept inactive |
| `PATCH /api/profiles/:id/plan` | any subset of the plan fields | updated active plan |
| `GET /api/profiles/:id/plans` | | plan history, newest first |
| `GET /api/profiles/:id/program` | | the week Arc built: `{ summary, days: [{ weekday (0 = Sunday), title, items: [plan fields] }], source }` (`404` until Arc has built one) |
| `POST /api/sessions` | see section 4; optional `complete: false` while a recording is saved set by set | `201` session with server-computed fatigue and summary |
| `PUT /api/sessions/:id` | the same body, every set so far | the session, recomputed; `409` once it is complete, `400` for another profile (users and the camera app) |
| `GET /api/profiles/:id/sessions?exercise=` | | sessions, newest first, optional exercise filter |
| `GET /api/sessions/:id` | | one session |
| `GET /api/profiles/:id/progress?exercise=` | | dashboard series: peak/mean/fatigue per session (oldest first), sessions per week, latest session rep by rep, plan goal |
| `POST /api/dev/seed` | optional `{ tzOffsetMinutes }` (the browser's `getTimezoneOffset()`) | `201`/`200` `{ profileId, sessions, created }`; your demo profile with six weeks of random sessions at local training hours (a new seed per account); signed-in accounts only, in every environment |

Exercise ids (the first three predate the catalog and keep their ids): `elbow_flexion` (bicep curl), `tricep_extension`, `shoulder_press`, `shoulder_abduction` (lateral raise), `front_raise`, `chest_press`, `pec_fly`, `lat_pulldown`, `bent_over_row`, `deadlift`, `squat`, `lunge`, `seated_knee_extension`, `crunch`, `ab_twist`. Sides: `left`, `right`.

## 6. Repository layout

```
dependencies/  @arc/dependencies  pure TypeScript shared by both sides: domain types, exercise configs,
               rep counter, One Euro filter, fatigue proxy, session summary, demo data generator,
               progress builder, the week (goal ranges, answer parsing, Arc's own week), zod API schemas
backend/       @arc/backend       Express 5 + Mongoose: models (User, Profile, Plan, Program, Session, CoachMessage), auth,
               routes, services; src/app.ts builds the app, src/index.ts connects and listens, test/ = API tests
frontend/      @arc/frontend      Vite + React 19 + Tailwind + Motion: pages (Landing, Signup, Login, Welcome, Dashboard,
               Plan, Record, Profiles, SessionDetail, Account), plan/ (day log, PlanCalendar), auth (token, context, route guards),
               api/client.ts (typed fetch wrapper)
computer-vision/  Python camera app (OpenCV + MediaPipe, uv): tracks the joint, counts reps, times rest;
               arc_routine.py starts it from an Arc plan, arc_upload.py sends the session to the API
ai-coach/      Python module from the teammates (Gemini + ElevenLabs): Arc's persona, onboarding survey and
               training ranges, ported into backend/src/services/arc.ts, which the app runs
docs/          backlog, sprint plan, definition of done, architecture decision records
.github/       CI workflow and issue / PR templates
```

The three JavaScript packages are npm workspaces; `computer-vision/` and `ai-coach/` are separate Python projects (uv). `@arc/dependencies` is consumed as TypeScript source, so a change there is picked up by both sides without a build step.

## 7. Testing and the development process

The project is developed **test-first**: write the failing test, make it pass, then clean up. `npm test` must be green before a pull request is opened, and CI (`.github/workflows/ci.yml`) runs typecheck, tests and the build on every push and PR.

- `dependencies/src/**/*.test.ts`: engine behaviour (rep counting, hysteresis, jitter rejection, fatigue arithmetic, summaries, schema validation), the name and email rules (accents, other alphabets, apostrophes and hyphens accepted; digits, symbols, blanks and over-long values refused with a reason), the exercise catalog (fifteen movements in four areas, thresholds between rest and the goal, the camera app's landmarks), the demo generator (repeatable per seed, upward trends scaled to each movement's range, local training hours), what Record runs for a movement (the plan, else the week, else the goal ranges), the progress builder, and the week (the ai-coach goal ranges, reading training days, goals, heights and weights from plain answers, Arc's own week on the chosen days and inside the ranges, the training day for a date).
- `backend/test/*.test.ts`: every API route through supertest against a throwaway in-memory MongoDB, including sign-up, login, token checks, API-key access and profile isolation between accounts, a recording saved set by set (in MongoDB from its first set and on the dashboard at once, one session growing with each set, kept when it never finishes, a finished one final, another profile or account refused), account deletion (signed-in members only, a wrong or another account's pair refused without echoing the password and without ending the session, `DELETE` required, everything of the account removed and nothing of anyone else's, the old token refused afterwards, the lockout after five wrong tries), and Arc (onboarding with and without Gemini and its fallback when Gemini fails, the profile and plan it saves, set and session reads stored once, ElevenLabs audio only for the owner, the nine onboarding topics in order with the week saved and served, running again for an existing profile, Gemini's week held to the member's days, the catalog and the ranges with Arc's week filling the gaps, the week going with its profile and its account, keys only in headers, the rate limit, voice commands stored with sessions; Gemini and ElevenLabs are stubbed, never called). Tests never touch the cluster in `.env`.
- `frontend/src/**/*.test.ts(x)`: the API wrapper (token header, 401 handling, saving a recorded session), browser recording (the white skeleton over the camera, MediaPipe's own 35 connections, drawn only where the model can see, each set saved as it finishes into one session, saves one after another, a failed save made up by the next, reading the joint from pose landmarks with aspect correction and visibility, the session recorder's sets, rests, early finish and whole-millisecond times, the simulated person, the camera-blocked and insecure-page messages, the dashboard's record panel), the route guards (app pages send visitors to `/login`, sign-up and log-in send signed-in users to `/dashboard`), the app logo leading to the landing page and the landing page's buttons for visitors and signed-in users, the full-page chat with Arc (quick answers for the question asked, skipping, the week it shows at the end), the dashboard calendar (training days planned, done and not recorded, today's workout and the way to record it, month steps and arrow keys, the invitation when there is no week), the sign-up / login form and the requirement line under every name and email field (the profiles page included), the account page (details, log out, deletion held until the email, password and `DELETE` are right, the server's refusal shown without the password, the landing-page notice afterwards), new pages opening at the top, Arc (the onboarding chat page, the session read, the API calls), voice commands (every gym word, negations, addressing Arc), the recorder's pause, resume, skip, rest and stop with the saved command log, UI primitives, the themed dropdown and the plan form that uses it, the 3D body's skeleton for all fifteen movements (every part present, the tracked landmarks on its joints, the reading measured back exactly as the camera app would, the goniometer arc on the moving segment, no limb stretching, the classics moving one limb, planted feet staying planted through squats, lunges and deadlifts, nothing below the floor, every pose in frame), the exercise picker (four area tabs, the area's movements, switching area picking its first), the ab twist's shoulder-line reading, every movement counted end to end through the camera path by the simulated person, the sticky columns that never scroll on their own, the dashboard's chart folds, the plan page's day log (stepping, rest days, progress against the previous session and the goal) and its local-calendar day arithmetic, and the hero's rep detector.

- `computer-vision/test_arc_upload.py`: sending a camera-app session to Arc (sets and reps from the app's log, whole-millisecond times with the rest between sets, each movement's number and goal matching `exercises.ts`, the key in a header and never over plain HTTP to another computer, `--profile` and `CV_API_KEY`).
- `computer-vision/test_arc_routine.py`: the plan-to-routine mapping for running the Python app from a plan (all fourteen catalog movements mapped once each and named as movements.py names them, whole-body movements on the catalog's own landmarks, a seated knee extension definition, mirrored landmarks, plan validation, command-line round trip). `cd computer-vision && python3 -m unittest`; CI runs them too.

How the team works (sprints, stories, definition of done, PR checklist) is in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/).

## 8. Deployment: getarc.health

The domain **getarc.health** is registered at Porkbun, which also serves its DNS. Hosting is Render, defined by [`render.yaml`](render.yaml) at the repo root: a static site `getarc-web` for the web app and a Node web service `getarc-api` for the API. The static site rewrites `/api/*` to the API's Render hostname, so the browser keeps the same-origin calls it uses in development and the site works on Render's own URLs before DNS is switched. A push to `main` deploys both.

### One-time setup (about 15 minutes)

1. **Connect GitHub to Render.** At dashboard.render.com choose *New → Blueprint*, pick the `swejasonzhang/Hackknight2026` repo and the `main` branch. Render reads `render.yaml` and creates `getarc-web` and `getarc-api`. (If you created services from an earlier version of the file, delete those first so the names don't collide.)
2. **Set the secrets** it asks for: `MONGODB_URI` (the Atlas string), and for Arc's words and voice `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` (both optional: without them Arc runs on its own questions and the browser's voice). `JWT_SECRET` and `CV_API_KEY` are generated; copy `CV_API_KEY` from `getarc-api` → *Environment* and give it to the camera-app team.
3. **Allow Render in Atlas.** Atlas → Network Access → add the outbound IPs shown on `getarc-api` → *Networking* (or `0.0.0.0/0` for the hackathon).
4. **Check it on Render's URLs first:** `https://getarc-api.onrender.com/api/health` returns `{ ok: true, db: "connected" }`, and `https://getarc-web.onrender.com` shows the landing page. If Render gave a service a suffixed hostname (the name was taken), update the rewrite destination in `render.yaml` to match.
5. **Point the domain at Render.** The blueprint deliberately leaves domains out (Render refuses a blueprint whose domain is attached anywhere else). Add `getarc.health` under `getarc-web` → *Settings → Custom Domains* and `api.getarc.health` under `getarc-api`; if Render says a domain is taken, it names the service or workspace that holds it. Then at Porkbun → *Domain Management* → `getarc.health` → **DNS Records**, delete the default records (the `A` records for the root and `*` pointing at `192.0.79.151` / `192.0.79.171`, and any `AAAA` records; the `_acme-challenge` TXT records are Porkbun's own SSL automation and can go too) and add these. Porkbun's *Host* field takes only the part before the domain: leave it blank for the root.

   | Type | Host | Answer | TTL |
   |---|---|---|---|
   | ALIAS | *(blank)* | `getarc-web.onrender.com` | 600 |
   | CNAME | `www` | `getarc-web.onrender.com` | 600 |
   | CNAME | `api` | `getarc-api.onrender.com` | 600 |

   ALIAS is Porkbun's root-level CNAME, so you never have to copy an IP from Render. (If you prefer an `A` record for the root, Render's apex address is `216.24.57.1`, shown on the Custom Domains screen.) Render verifies the domain within minutes and issues HTTPS; `www.getarc.health` redirects to the root automatically.
6. **Final check:** `https://api.getarc.health/api/health` and `https://getarc.health`.

Production env on `getarc-api` (all in `render.yaml`): `NODE_ENV=production`, `NODE_VERSION`, `MONGODB_URI`, `JWT_SECRET`, `CV_API_KEY`, `CORS_ORIGINS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. The camera app sends its sessions to `https://api.getarc.health` (its `ARC_API_URL` default) with the API key.

## 9. Troubleshooting

- **The API lamp on the rail is red** (its tooltip says unreachable, or the database disconnected): the server is not running, crashed on start, or cannot reach MongoDB. Run `npm run dev:backend` alone and read its output; `/api/health` says which.
- **API exits with "MONGODB_URI is not set" / "JWT_SECRET is not set"**: create `.env` at the repo root from `.env.example` (locally) or set the variables on the Render service.
- **API logs "Could not connect to MongoDB … IP that isn't whitelisted"**: in Atlas open *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`, fine for the hackathon). The API retries every 10 s and connects on its own once the rule is active. While the database is unreachable the API stays up: `/api/health` reports `db: "disconnected"` and data routes answer `503 Database unavailable`; it reconnects by itself (retrying every 10 s) once Atlas accepts the connection, so nothing needs restarting.
- **Camera app gets 401**: it must send `x-api-key` with the exact value of `CV_API_KEY` in the API's `.env` (set `CV_API_KEY` in the shell that runs `main.py --profile …`).
- **Arc says "Gemini off" or speaks in the browser's voice**: `GEMINI_API_KEY` or `ELEVENLABS_API_KEY` is not set on the API; everything still works on Arc's own questions and templates.
- **`npm install` fails with "Cannot read properties of null (reading 'edgesOut')"**: an npm 10 workspace bug; the repo's `.npmrc` (`legacy-peer-deps=true`) avoids it.
- **CI fails with "Cannot find native binding" for rolldown**: the lockfile was generated without the Linux build of Vite's bundler. Regenerate it from a clean install (`rm -rf node_modules package-lock.json && npm install`) and commit `package-lock.json`.
- **Backend tests fail at `MongoMemoryServer.create` the first time**: the MongoDB test binary is still downloading. Run `npm test -w backend` again.
