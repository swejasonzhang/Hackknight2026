# ADR-0004: GoDaddy for the domain; separate hosts for web app, API and database

- Date: 2026-10-09
- Status: accepted

## Context

The demo should run on a real URL, and the webcam only works over HTTPS (or localhost).

## Decision

Register the domain at GoDaddy and point DNS records at managed hosts: a static host for `frontend/dist` (`app.<domain>`), a Node host for the API (`api.<domain>`), and MongoDB Atlas for the database. Both hosts provide TLS automatically once DNS resolves. The API reads `MONGODB_URI`, `CORS_ORIGINS` and `NODE_ENV=production`.

## Consequences

- No servers to patch; deploy is `git push` on each host.
- Two origins means CORS must list the app origin; `/api/dev/*` is disabled in production.
- Steps are in `README.md` → Deployment; story D3 tracks the work.
