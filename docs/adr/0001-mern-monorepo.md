# ADR-0001: MERN stack in a three-package npm workspace

- Date: 2026-10-09
- Status: accepted (database choice superseded by ADR-0007: Postgres/TimescaleDB on Tiger Cloud replaced MongoDB on 2026-10-09)

## Context

The team splits into a full-stack group and a computer-vision group. The full-stack group needs a conventional stack teammates already know, a place for shared domain logic, and a boundary the CV group can target without reading the rest of the code.

## Decision

MongoDB + Express 5 + React 19 + Node 20, TypeScript throughout, as npm workspaces: `dependencies` (domain types, engine, API schemas), `backend` (API), `frontend` (web app). `@arc/dependencies` is consumed as TypeScript source (its `exports` points at `.ts`), so no build step sits between a change and its use. The CV module plugs into `frontend/src/motion/types.ts` (`MotionSource`).

## Consequences

- One `npm install`, one `npm test`, one CI job. Relative imports inside `dependencies` use explicit `.ts` extensions so both the bundler-resolved client and the Node-resolved server type-check them.
- npm 10 has a workspace bug (`edgesOut` crash) worked around with `legacy-peer-deps=true` in `.npmrc`; peer packages such as `@testing-library/dom` and `jsdom` are therefore declared explicitly.
- Mongoose models (Profile, Plan, Session) hold the only Mongo-specific code; DTO mappers keep `_id` and other internals out of API responses.
