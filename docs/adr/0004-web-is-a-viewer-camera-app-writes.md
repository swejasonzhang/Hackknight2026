# ADR-0004: The web app visualises; the camera app records sessions; accounts with JWT and an API key

- Date: 2026-10-09
- Status: accepted

## Context

The computer-vision teammates' camera app tracks the joint, counts reps and sets, and times rest. Running a second session flow in the browser duplicated that. Users should land on a sign-up page when not logged in, and a household's profiles should be private to its account.

## Decision

- The web app has no session page and no simulated motion source. It shows accounts, profiles, plans and dashboards built from the sessions stored in MongoDB.
- Sessions enter through `POST /api/sessions`. The camera app authenticates with a shared `x-api-key` (`CV_API_KEY`) and may read any profile and plan; the server validates the body and recomputes fatigue and the summary.
- Accounts are email + password with bcrypt (bcryptjs) hashes and 7-day JWTs signed with `JWT_SECRET`. Profiles carry `ownerId`; a user only sees their own, and a foreign profile is a 404. `/` is a public landing page; app pages send visitors to `/login`.
- The shared engine keeps the rep counter and smoothing filter as the reference implementation of the rep contract for a JavaScript camera app; the session state machine was removed.

## Consequences

- Three secrets in `.env`: `MONGODB_URI`, `JWT_SECRET`, `CV_API_KEY`; the API refuses to start without the first two.
- The camera app needs the API URL and the key, and a profile id (from `GET /api/profiles`) for the person exercising.
- A hosted auth provider was considered and not used: the app would then not own password hashing or token issuing, and the camera app would still need a separate credential.
