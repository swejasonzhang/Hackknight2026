# ROM Tracker

A webcam goniometer for home use, for anyone at any age. You do your exercises in front of a laptop camera, pose estimation measures joint range of motion (ROM) in degrees, the app counts reps and sets, times the rest, flags fading range, and shows your trend over weeks. Several people can share one install, each with their own profile. This is a personal tool, not a clinical one: no doctor or therapist sees the data.

This repository holds the **full-stack, end-to-end part**: the data model, the REST API, the React app, and the exercise engine (rep counting, fatigue proxy, session flow). The **computer-vision module is built separately by the CV teammates** and plugs in through one small interface (see [Where the camera plugs in](#where-the-camera-plugs-in)). Until it lands, a built-in simulated user drives the whole flow so everything can be developed and demoed.

Stack: MongoDB · Express 5 · React 19 · Node 20 (MERN), TypeScript everywhere, Vite, Vitest.

---

## 1. Quick start

Prerequisites: **Node 20.19 or newer** (`.nvmrc` says 20; `nvm use` picks it), npm 10, and a MongoDB database: the team's hosted **MongoDB Atlas** cluster (ask for the connection string) or a local MongoDB.

```bash
git clone <this repo> && cd Hackknight
npm install            # installs all three workspaces; first run also downloads a MongoDB test binary (~150 MB)
cp .env.example .env   # then paste the Atlas connection string into MONGODB_URI
npm run dev            # starts the API on :8787 and the web app on :5173
```

The API exits immediately if `MONGODB_URI` is missing. If the cluster cannot be reached it prints why (bad credentials, IP not on the Atlas access list) and retries every 10 seconds, so fixing Atlas is enough: no restart needed.

Open <http://localhost:5173>. The nav bar shows "API connected" when the server and database are up. Both dev servers listen on every network interface, so teammates and phones on the same Wi-Fi can open `http://<your-machine's-IP>:5173` (Vite prints the Network URL on start).

First time in the app:

1. **Profiles** page → click **Load demo data** (creates "Demo Profile" with six weeks of sessions), or **Add a profile** for yourself.
2. **Session** page → pick who is exercising, check the plan, click **Start session**. The simulated user starts moving; reps count up, the rest timer runs between sets, and the session is saved when the last set ends.
3. **Dashboard** page → see your trend, the rep-by-rep view of the latest session, the fatigue proxy, and sessions per week. Set or change your plan (sets, reps, rest, goal angle) in the panel on the right.

## 2. Configuration

Copy `.env.example` to `.env` at the repo root. Only the server reads it.

| Variable | Default | Meaning |
|---|---|---|
| `MONGODB_URI` | **required** | The hosted cluster: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ptg?retryWrites=true&w=majority`. A local server also works: `mongodb://127.0.0.1:27017/ptg`. |
| `PORT` | `8787` | API port. The Vite dev server proxies `/api/*` here. |
| `CORS_ORIGINS` | any origin | Comma-separated browser origins allowed in production, e.g. `https://app.yourdomain.com`. |
| `NODE_ENV` | | `production` disables `/api/dev/*`. |

`npm run seed` loads the demo data into the database named by `MONGODB_URI` (the in-app button does the same through `POST /api/dev/seed`).

## 3. Everyday commands

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | API + web app with hot reload (`npm run dev:backend` / `npm run dev:frontend` for one of them) |
| `npm test` | All test suites: shared engine, server API (against an in-memory MongoDB), client |
| `npm run test:watch -w dependencies` (or `-w backend`, `-w frontend`) | Watch mode for one workspace while doing TDD |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run build` | Production build of the client into `frontend/dist` |
| `npm run seed` | Seed demo data into `MONGODB_URI` |

## 4. How the app works

### Session flow

```
idle → align → active → rest → align → active → … → complete
                 ▲        │
                 └─ pause / resume (counting and the countdown both stop)
```

- **align**: the app waits until the joint is tracked for 1.5 s ("get into position") before counting.
- **active**: each rep is one excursion of the exercise metric past the *enter* threshold and back to the *exit* threshold (hysteresis, so a wobble never double-counts; movements shorter than `minRepMs` are ignored as jitter). The peak and the duration of each rep are recorded.
- **rest**: countdown from the plan's rest seconds, then the next set.
- A set ends when the planned rep count is reached, when you press **End set**, or when the **fatigue proxy** crosses the early-rest line.
- **complete**: the session is `POST`ed to the API and the summary links to the dashboard.

### Fatigue proxy (not a clinical measure)

For a set with at least 4 reps, compare the first k reps with the last k (k ≤ 3):

```
romDecay   = (mean peak of first k − mean peak of last k) / mean peak of first k
tempoDrift = (mean duration of last k − mean duration of first k) / mean duration of first k
index      = clamp(0.6 · romDecay + 0.4 · tempoDrift, 0, 1)       (only losses count)
```

`index ≥ 0.12` shows a nudge ("reach full range"); `index ≥ 0.25` ends the set early and starts the rest. The UI and the dashboard say "ROM decay" and "tempo drift" instead of claiming to measure fatigue. The server recomputes these numbers from the raw reps when a session is saved; it never trusts the client's.

### Exercises

| Exercise | Joint (landmarks) | Metric shown and counted | Enter / exit | Default goal |
|---|---|---|---|---|
| Elbow flexion | shoulder – elbow – wrist | 180° − inner angle (0 = straight) | 90° / 40° | 140° |
| Shoulder abduction | hip – shoulder – elbow | inner angle (arm at side ≈ 10°) | 70° / 30° | 160° |
| Seated knee extension | hip – knee – ankle | inner angle (seated ≈ 90°, straight = 180°) | 150° / 110° | 175° |

All three are defined in `dependencies/src/engine/exercises.ts`, including the cue that tells you how to face the camera.

### Where the camera plugs in

Everything downstream of the camera consumes one interface, `MotionSource` in `frontend/src/motion/types.ts`:

```ts
interface MotionSample { metricDeg: number; tMs: number; tracked: boolean }
interface MotionSource { label: string; start(onSample: (s: MotionSample) => void): void; stop(): void }
```

`frontend/src/motion/CameraMotionSource.ts` is the placeholder the CV team replaces. It should open the webcam, run pose estimation, compute the inner angle at the joint named by `EXERCISES[id].joints[side]` (from `@ptg/dependencies`), convert it with `metricFromInnerAngle`, and call `onSample` once per frame with `tracked: false` whenever a landmark is missing. `frontend/src/motion/SimulatedMotionSource.ts` is the stand-in used today; the Session page's "Simulated user" panel controls its tempo, peak and how fast its range decays, which is how to demo the fatigue logic.

## 5. API reference

Base URL in development: `http://localhost:8787`. All bodies are JSON. Validation errors return `400 { error: "Invalid request", issues: [...] }`; unknown ids return `404`.

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/health` | | `{ ok, db: "connected" \| "disconnected", uptime }` |
| `GET /api/profiles` | | profiles, newest first |
| `POST /api/profiles` | `{ name, email?, notes? }` | `201` profile |
| `GET /api/profiles/:id` | | profile |
| `GET /api/profiles/:id/plan` | | active plan (`404` if none) |
| `PUT /api/profiles/:id/plan` | `{ exercise, side, sets, reps, restSeconds, targetDeg }` | `201` new active plan; the previous one is kept inactive |
| `PATCH /api/profiles/:id/plan` | any subset of the plan fields | updated active plan |
| `GET /api/profiles/:id/plans` | | plan history, newest first |
| `POST /api/sessions` | see `CreateSessionSchema` in `dependencies/src/api.ts` | `201` session with server-computed fatigue and summary |
| `GET /api/profiles/:id/sessions?exercise=` | | sessions, newest first, optional exercise filter |
| `GET /api/sessions/:id` | | one session |
| `GET /api/profiles/:id/progress?exercise=` | | dashboard series: peak/mean/fatigue per session (oldest first), sessions per week, latest session rep by rep, plan goal |
| `POST /api/dev/seed` | | `201`/`200` `{ profileId, sessions, created }`; dev only |

Exercise ids: `elbow_flexion`, `shoulder_abduction`, `seated_knee_extension`. Sides: `left`, `right`. Timestamps are milliseconds since the epoch.

## 6. Repository layout

```
dependencies/  @ptg/dependencies  pure TypeScript used by both sides: domain types, exercise configs,
               rep counter, One Euro filter, fatigue proxy, session state machine, zod API schemas
backend/       @ptg/backend       Express 5 + Mongoose: models (Profile, Plan, Session), routes, services
               src/app.ts builds the app; src/index.ts connects the DB and listens; test/ holds API tests
frontend/      @ptg/frontend      Vite + React 19: pages (Session, Dashboard, Profiles), components, hooks,
               api/client.ts (typed fetch wrapper), motion/ (camera contract + simulator)
docs/          backlog, sprint plan, definition of done, architecture decision records
.github/       CI workflow and issue / PR templates
```

The three packages are npm workspaces. `@ptg/dependencies` is consumed as TypeScript source, so a change there is picked up by both the server and the client without a build step.

## 7. Testing and the development process

The project is developed **test-first**: write the failing test, make it pass, then clean up. `npm test` must be green before a pull request is opened, and CI (`.github/workflows/ci.yml`) runs typecheck, tests and the client build on every push and PR.

- `dependencies/src/**/*.test.ts`: engine behaviour (rep counting, hysteresis, jitter rejection, fatigue arithmetic, the full session flow, schema validation).
- `backend/test/*.test.ts`: every API route through supertest against a throw-away in-memory MongoDB (no mocks of the database).
- `frontend/src/**/*.test.ts(x)`: the simulated motion source driving the real rep counter, the API wrapper, and component behaviour with Testing Library.

How the team works (sprints, stories, definition of done, PR checklist) is in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/).

## 8. Deployment and the domain

The domain is registered at **GoDaddy**. The app is two deployables plus a database:

1. **Database**: MongoDB Atlas free tier. Put its connection string in `MONGODB_URI`.
2. **API** (`backend/`): any Node host (Render, Railway, Fly.io). Start command `npm run start -w backend`; set `NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGINS=https://app.<domain>`.
3. **Web app** (`frontend/`): `npm run build` produces `frontend/dist`; host it on Vercel/Netlify/Cloudflare Pages and rewrite `/api/*` to the API host (or set the API to serve `frontend/dist`).
4. **DNS at GoDaddy**: a CNAME `app` → the web host, a CNAME `api` → the API host, as each host's dashboard instructs. The camera and microphone only work over **HTTPS** (or on localhost), so both hosts must serve TLS; the hosts above do this automatically once the DNS records resolve.

## 9. Troubleshooting

- **"API unreachable" in the nav bar**: the server is not running or crashed on start. Run `npm run dev:backend` alone and read its output.
- **`npm install` fails with "Cannot read properties of null (reading 'edgesOut')"**: an npm 10 bug with workspaces. The repo's `.npmrc` already sets `legacy-peer-deps=true`, which avoids it; make sure the file is present.
- **API logs "Could not connect to MongoDB … IP that isn't whitelisted"**: in Atlas open *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`, fine for the hackathon; tighten later). The API keeps retrying every 10 s and connects on its own once the rule is active (about a minute). Also check the user and password in the connection string.
- **API exits with "MONGODB_URI is not set"**: create `.env` at the repo root from `.env.example` and paste the connection string.
- **Backend tests fail at `MongoMemoryServer.create` the first time**: the MongoDB test binary is still downloading. Run `npm test -w backend` again; it is cached afterwards (`node_modules/.cache/mongodb-memory-server`). Tests always use this throwaway instance and never touch the cluster in `.env`.
- **Engine warnings during `npm install`** about Node 22: informational. Everything here is pinned to versions that support Node 20.19+.
- **Camera does nothing**: expected until the CV module replaces `CameraMotionSource`; the Session page uses the simulator today.
