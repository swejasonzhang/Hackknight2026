# ADR-0003: getarc.health on GoDaddy; Render hosts the web app and the API; MongoDB Atlas holds the data

- Date: 2026-10-09
- Status: accepted

## Context

The product lives at getarc.health (registered at GoDaddy). The camera app only works over HTTPS, and the team wants deploys to happen from GitHub without a server to maintain.

## Decision

Render, driven by the `render.yaml` blueprint in the repo root: a static site (`getarc-web`) for `frontend/dist` on `getarc.health`, and a Node web service (`getarc-api`) for the API on `api.getarc.health`. The static site rewrites `/api/*` to the API's Render hostname, so the browser keeps same-origin calls and the site works before DNS is switched. Both get TLS from Render automatically once the GoDaddy records point at them. Data stays in the MongoDB Atlas cluster.

## Consequences

- A push to `main` deploys both services; secrets live in Render's environment, never in the repo.
- GoDaddy needs exactly three records (apex A, `www` CNAME, `api` CNAME); the wildcard and third-party records that came with the domain are removed.
- `tsx` is a runtime dependency of the backend so the API runs from TypeScript source in production.
