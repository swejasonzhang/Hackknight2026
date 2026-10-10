# ADR-0007: TigerData (Postgres + TimescaleDB) replaces MongoDB; sessions stream live

- Date: 2026-10-09
- Status: accepted (supersedes the database choice in ADR-0001 and ADR-0003)

## Context

The camera app produces time-series data: a rep every couple of seconds, grouped into sets and sessions. MongoDB stored each session as one document, which made per-rep queries awkward and offered nothing for live updates. The team wants real-time representation of that data and chose TigerData's Tiger Cloud, the managed service from the company formerly called Timescale, whose database is Postgres with the TimescaleDB extension.

## Decision

- **Postgres everywhere.** Accounts, profiles, plans, sessions, sets and reps are relational tables created by an idempotent startup migration (`backend/src/schema.ts`). IDs are UUIDs; timestamps are `timestamptz` and cross the API as epoch milliseconds, exactly as before, so the API contract and every DTO are unchanged.
- **`reps` is the time series.** One row per rep keyed by its start time, with session, profile, exercise, set and rep index. When the server offers the TimescaleDB extension (Tiger Cloud does), the migration turns `reps` into a hypertable; on plain Postgres or in tests it stays an ordinary table with the same shape. Sessions keep their summary and plan snapshot; sets keep their fatigue estimate.
- **Driver and access.** node-postgres (`pg`) through a small `Db` interface (`query` and `transaction`), hand-written SQL in `backend/src/store/*`. No ORM: the queries are few, readable and use Postgres features directly (`jsonb_array_elements` for bulk inserts, cascading foreign keys for deletion).
- **Connection.** `DATABASE_URL` replaces `MONGODB_URI`. The URL's `sslmode` is mapped to node-postgres' `ssl` option with libpq semantics (`require` encrypts without verifying; `verify-full` verifies). Startup retries as before; there is no fallback database.
- **Tests on PGlite.** Each backend test file boots an in-process Postgres (PGlite, Postgres compiled to WebAssembly) with the real schema and truncates between tests. No binary download, no Docker, no service container in CI.
- **Live feed.** `GET /api/profiles/:id/stream` is a Server-Sent Events endpoint. Storing a session publishes it on an in-process event bus; subscribed dashboards receive it and refresh. The browser subscribes with `fetch` so the login token stays in a header, never in a URL. One API instance serves production; a multi-instance deployment would relay events through Postgres `NOTIFY`.

## Consequences

- Jason creates the Tiger Cloud service and sets `DATABASE_URL` locally (`.env`) and on Render (`getarc-api`). Until then the API refuses to start, by design.
- Existing MongoDB data is not migrated; the hackathon data is demo data that `POST /api/dev/seed` recreates.
- Mongoose, mongodb-memory-server and the MongoDB binary cache in CI are gone. `backend/src/models` became `backend/src/store`.
- Analytics on reps (per-week buckets, rolling bests) can now be SQL with `time_bucket`; the progress aggregation stays in TypeScript for now because it is pure and tested.
