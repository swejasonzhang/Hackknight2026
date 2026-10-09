# Arc

**Range of motion is an arc.** Arc is a webcam goniometer for home use, for anyone at any age, live at [getarc.health](https://getarc.health). A separate **camera app** (built by the computer-vision teammates) watches you exercise, measures joint range of motion (ROM) in degrees, counts reps and sets, and stores each session in MongoDB. **This repository is the web app and API around that data**: accounts, one profile per person in the household, and dashboards that show progress over weeks. It is a personal tool, not a clinical one: no doctor or therapist sees the data.

Stack: MongoDB Atlas · Express 5 · React 19 · Node 20 (MERN), TypeScript everywhere, Vite, Vitest. Hosted on Render, domain at Porkbun.

---

## 1. Quick start

Prerequisites: **Node 20.19 or newer** (`.nvmrc` says 20; `nvm use` picks it), npm 10, and the team's MongoDB Atlas connection string.

```bash
git clone https://github.com/swejasonzhang/Hackknight2026.git arc && cd arc
npm install            # all three workspaces; first run also downloads a MongoDB test binary (~150 MB)
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET and CV_API_KEY (see below)
npm run dev            # API on :8787, web app on :5173
```

Open <http://localhost:5173>. You land on **/signup**; create an account (one per household). Then:

1. **Profiles** → **Add a profile** for each person who exercises, or **Load demo data** for a profile with six weeks of seeded sessions.
2. **Dashboard** → pick who you're looking at and the exercise. You get peak ROM per session with your goal line, the latest session rep by rep, the fatigue proxy per session, sessions per week, and a table of recent sessions (click one for the set-by-set view). Set or change your plan (sets, reps, rest, goal angle) in the panel on the right.

Real sessions arrive when the camera app records them (section 4). The API refuses to start without the three secrets and prints what is missing.

## 2. Configuration

Copy `.env.example` to `.env` at the repo root. Only the backend reads it.

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | **Required.** `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/arc?retryWrites=true&w=majority`. A local server also works: `mongodb://127.0.0.1:27017/arc`. If the cluster refuses the connection the API prints why and retries every 10 s. |
| `JWT_SECRET` | **Required.** Signs login tokens. Any long random string: `openssl rand -hex 32`. |
| `CV_API_KEY` | Shared secret the camera app sends as `x-api-key` when it stores sessions or reads a plan. `openssl rand -hex 32`. Without it the camera app cannot write. |
| `PORT` | API port, default `8787`. The Vite dev server proxies `/api/*` here. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed in production, e.g. `https://app.yourdomain.com`. |
| `NODE_ENV` | `production` disables `/api/dev/*`. |

`npm run seed -- you@example.com` loads the demo profile into the account with that email (the in-app button does the same through `POST /api/dev/seed`).

## 3. Everyday commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | API + web app with hot reload (`npm run dev:backend` / `npm run dev:frontend` for one of them) |
| `npm test` | All test suites: shared engine, API (against a throwaway in-memory MongoDB), frontend |
| `npm run test:watch -w dependencies` (or `-w backend`, `-w frontend`) | Watch mode for one workspace while doing TDD |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run build` | Production build of the web app into `frontend/dist` |
| `npm run seed -- <email>` | Seed demo data into that account |

## 4. How sessions get into the database

The camera app owns the measurement: it tracks the joint, counts reps and sets, and sends each finished session to this API. Recommended path: **`POST /api/sessions` with the `x-api-key` header**, because the server validates the body, recomputes the fatigue proxy and the summary from the raw reps, and the dashboard needs nothing else.

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

### What the engine defines for the camera app

`@arc/dependencies` is pure TypeScript shared by the server and (if the camera app is JavaScript) the camera app:

- `EXERCISES` (`dependencies/src/engine/exercises.ts`): for each exercise, which three landmarks form the angle, how the inner angle becomes the metric (`metricFromInnerAngle`, always "more degrees = deeper into the rep"), the rep thresholds (`enterDeg`, `exitDeg`), the jitter floor (`minRepMs`), the default goal, and the cue that tells the user how to face the camera.
- `RepCounter`: the hysteresis rep counter (leave rest, pass `enterDeg`, return to `exitDeg` = one rep; shorter than `minRepMs` = ignored). `OneEuroFilter` smooths the angle stream first.
- `estimateFatigue`: the proxy below. `summarizeSets`: the per-session roll-up.

| Exercise | Joint (landmarks) | Metric shown and counted | Enter / exit | Default goal |
|---|---|---|---|---|
| Elbow flexion | shoulder – elbow – wrist | 180° − inner angle (0 = straight) | 90° / 40° | 140° |
| Shoulder abduction | hip – shoulder – elbow | inner angle (arm at side ≈ 10°) | 70° / 30° | 160° |
| Seated knee extension | hip – knee – ankle | inner angle (seated ≈ 90°, straight = 180°) | 150° / 110° | 175° |

### Fatigue proxy (not a clinical measure)

For a set with at least 4 reps, compare the first k reps with the last k (k ≤ 3):

```
romDecay   = (mean peak of first k − mean peak of last k) / mean peak of first k
tempoDrift = (mean duration of last k − mean duration of first k) / mean duration of first k
index      = clamp(0.6 · romDecay + 0.4 · tempoDrift, 0, 1)       (only losses count)
```

The dashboard draws `0.12` (nudge) and `0.25` (early rest) as reference lines and labels the quantity "ROM decay + tempo drift", never "fatigue" as a diagnosis.

## 4b. The camera app (Python)

The computer-vision side lives in [`computer-vision/`](computer-vision/) as a Python 3.12 project managed with [uv](https://docs.astral.sh/uv/): `main.py` starts `ExerciseTracker` from `movements.py`, which uses OpenCV and MediaPipe to track the joint, count reps against flex/extend thresholds and time rest.

```bash
cd computer-vision
uv sync          # installs mediapipe and opencv into .venv
uv run main.py   # opens the webcam window
```

It does not yet send finished sessions to the API; that is backlog story C4 (`POST /api/sessions` with the `x-api-key` header, section 4 above).

## 5. API reference

Base URL in development: `http://localhost:8787`. All bodies are JSON. Validation errors return `400 { error: "Invalid request", issues: [...] }`; unknown or foreign ids return `404`; missing credentials return `401`.

**Credentials.** Browser requests send `Authorization: Bearer <token>` (from signup or login, valid 7 days). The camera app sends `x-api-key: <CV_API_KEY>` instead and may access every profile. Users only ever see their own profiles.

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/health` | | `{ ok, db: "connected" \| "disconnected", uptime }` (open) |
| `POST /api/auth/signup` | `{ name, email, password (≥ 8) }` | `201 { token, user }`; `409` if the email exists (open) |
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`; `401` on a bad pair (open) |
| `GET /api/auth/me` | | the signed-in user |
| `GET /api/profiles` | | your profiles, newest first (API key: all profiles) |
| `POST /api/profiles` | `{ name, email?, notes? }` | `201` profile (users only) |
| `GET /api/profiles/:id` | | profile |
| `DELETE /api/profiles/:id` | | `204`; also deletes its plans and sessions |
| `GET /api/profiles/:id/plan` | | active plan (`404` if none) |
| `PUT /api/profiles/:id/plan` | `{ exercise, side, sets, reps, restSeconds, targetDeg }` | `201` new active plan; the previous one is kept inactive |
| `PATCH /api/profiles/:id/plan` | any subset of the plan fields | updated active plan |
| `GET /api/profiles/:id/plans` | | plan history, newest first |
| `POST /api/sessions` | see section 4 | `201` session with server-computed fatigue and summary |
| `GET /api/profiles/:id/sessions?exercise=` | | sessions, newest first, optional exercise filter |
| `GET /api/sessions/:id` | | one session |
| `GET /api/profiles/:id/progress?exercise=` | | dashboard series: peak/mean/fatigue per session (oldest first), sessions per week, latest session rep by rep, plan goal |
| `POST /api/dev/seed` | | `201`/`200` `{ profileId, sessions, created }`; your demo profile; dev only |

Exercise ids: `elbow_flexion`, `shoulder_abduction`, `seated_knee_extension`. Sides: `left`, `right`.

## 6. Repository layout

```
dependencies/  @arc/dependencies  pure TypeScript shared by both sides: domain types, exercise configs,
               rep counter, One Euro filter, fatigue proxy, session summary, zod API schemas
backend/       @arc/backend       Express 5 + Mongoose: models (User, Profile, Plan, Session), auth,
               routes, services; src/app.ts builds the app, src/index.ts connects and listens, test/ = API tests
frontend/      @arc/frontend      Vite + React 19: auth (token, context, route guards), pages (Signup, Login,
               Dashboard, Profiles, SessionDetail), components, api/client.ts (typed fetch wrapper)
computer-vision/  Python camera app (OpenCV + MediaPipe, uv): tracks the joint, counts reps, times rest
docs/          backlog, sprint plan, definition of done, architecture decision records
.github/       CI workflow and issue / PR templates
```

The three JavaScript packages are npm workspaces; the camera app is a separate Python project. `@arc/dependencies` is consumed as TypeScript source, so a change there is picked up by both sides without a build step.

## 7. Testing and the development process

The project is developed **test-first**: write the failing test, make it pass, then clean up. `npm test` must be green before a pull request is opened, and CI (`.github/workflows/ci.yml`) runs typecheck, tests and the build on every push and PR.

- `dependencies/src/**/*.test.ts`: engine behaviour (rep counting, hysteresis, jitter rejection, fatigue arithmetic, summaries, schema validation).
- `backend/test/*.test.ts`: every API route through supertest against a throwaway in-memory MongoDB, including sign-up, login, token checks, API-key access and profile isolation between accounts. Tests never touch the cluster in `.env`.
- `frontend/src/**/*.test.ts(x)`: the API wrapper (token header, 401 handling), the route guards (visitors land on `/signup`), and the sign-up / login form.

How the team works (sprints, stories, definition of done, PR checklist) is in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/).

## 8. Deployment: getarc.health

The domain **getarc.health** is registered at Porkbun, which also serves its DNS. Hosting is Render, defined by [`render.yaml`](render.yaml) at the repo root: a static site `getarc-web` for the web app and a Node web service `getarc-api` for the API. The static site rewrites `/api/*` to the API's Render hostname, so the browser keeps the same-origin calls it uses in development and the site works on Render's own URLs before DNS is switched. A push to `main` deploys both.

### One-time setup (about 15 minutes)

1. **Connect GitHub to Render.** At dashboard.render.com choose *New → Blueprint*, pick the `swejasonzhang/Hackknight2026` repo and the `main` branch. Render reads `render.yaml` and creates `getarc-web` and `getarc-api`. (If you created services from an earlier version of the file, delete those first so the names don't collide.)
2. **Set the secret** it asks for: `MONGODB_URI` (the Atlas string). `JWT_SECRET` and `CV_API_KEY` are generated; copy `CV_API_KEY` from `getarc-api` → *Environment* and give it to the camera-app team.
3. **Allow Render in Atlas.** Atlas → Network Access → add the outbound IPs shown on `getarc-api` → *Networking* (or `0.0.0.0/0` for the hackathon).
4. **Check it on Render's URLs first:** `https://getarc-api.onrender.com/api/health` returns `{ ok: true, db: "connected" }`, and `https://getarc-web.onrender.com` lands on the sign-up page. If Render gave a service a suffixed hostname (the name was taken), update the rewrite destination in `render.yaml` to match.
5. **Point the domain at Render.** Add `getarc.health` under `getarc-web` → *Settings → Custom Domains* and `api.getarc.health` under `getarc-api`. Then at Porkbun → *Domain Management* → `getarc.health` → **DNS Records**, delete the default records (the `A` records for the root and `*` pointing at `192.0.79.151` / `192.0.79.171`, and any `AAAA` records; the `_acme-challenge` TXT records are Porkbun's own SSL automation and can go too) and add these. Porkbun's *Host* field takes only the part before the domain: leave it blank for the root.

   | Type | Host | Answer | TTL |
   |---|---|---|---|
   | ALIAS | *(blank)* | `getarc-web.onrender.com` | 600 |
   | CNAME | `www` | `getarc-web.onrender.com` | 600 |
   | CNAME | `api` | `getarc-api.onrender.com` | 600 |

   ALIAS is Porkbun's root-level CNAME, so you never have to copy an IP from Render. (If you prefer an `A` record for the root, use the IP Render shows on the Custom Domains screen.) Render verifies the domain within minutes and issues HTTPS; `www.getarc.health` redirects to the root automatically.
6. **Final check:** `https://api.getarc.health/api/health` and `https://getarc.health`.

Production env on `getarc-api`: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CV_API_KEY`, `CORS_ORIGINS`. The camera app talks to `https://api.getarc.health` (or `https://getarc-api.onrender.com`) with the API key.

## 9. Troubleshooting

- **"API unreachable" in the nav bar**: the server is not running or crashed on start. Run `npm run dev:backend` alone and read its output.
- **API exits with "MONGODB_URI is not set" / "JWT_SECRET is not set"**: create `.env` at the repo root from `.env.example` (locally) or set the variables on the Render service.
- **API logs "Could not connect to MongoDB … IP that isn't whitelisted"**: in Atlas open *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`, fine for the hackathon). The API retries every 10 s and connects on its own once the rule is active.
- **Camera app gets 401**: it must send `x-api-key` with the exact value of `CV_API_KEY` in the API's `.env`.
- **`npm install` fails with "Cannot read properties of null (reading 'edgesOut')"**: an npm 10 workspace bug; the repo's `.npmrc` (`legacy-peer-deps=true`) avoids it.
- **CI fails with "Cannot find native binding" for rolldown**: the lockfile was generated without the Linux build of Vite's bundler. Regenerate it from a clean install (`rm -rf node_modules package-lock.json && npm install`) and commit `package-lock.json`.
- **Backend tests fail at `MongoMemoryServer.create` the first time**: the MongoDB test binary is still downloading. Run `npm test -w backend` again.
