# Contributing

How this team builds Arc. Short on ceremony, strict on two things: every change is driven by a test, and every change is small enough to merge the same day.

## The loop (TDD)

1. Pick a story from [docs/BACKLOG.md](docs/BACKLOG.md) (or the board) and move it to **Doing**. One story per person at a time.
2. Branch from `main`: `git checkout -b <area>/<short-story-name>` (areas: `dependencies`, `backend`, `frontend`, `computer-vision`, `docs`).
3. **Red**: write the smallest failing test that expresses the next piece of behaviour. Run it in watch mode: `npm run test:watch -w <workspace>`.
4. **Green**: write the least code that makes it pass. No extra features "while you're there".
5. **Refactor**: tidy names and structure with the test still green.
6. Repeat 3 to 5 until the story's acceptance criteria are all covered by tests.
7. `npm test && npm run typecheck` from the root, then open a PR using the template. CI must be green.
8. One teammate reviews (read the tests first, then the code). Squash-merge. Delete the branch.

Where tests live and what they cover:

| Layer | Test kind | Where | Runs against |
|---|---|---|---|
| `dependencies` engine | unit | `dependencies/src/**/*.test.ts` | pure functions |
| `backend` services | unit | `backend/src/**/*.test.ts` | pure functions |
| `backend` API | integration | `backend/test/*.test.ts` | the real Express app + an in-memory MongoDB |
| `frontend` logic | unit | `frontend/src/**/*.test.ts` | API wrapper and auth helpers (fetch stubbed) |
| `frontend` UI | component | `frontend/src/**/*.test.tsx` | route guards and forms with Testing Library in jsdom |

Rules of thumb: test behaviour through the public interface, not implementation details; one assertion theme per test; name tests as sentences ("ends a set early when the fatigue proxy crosses the stop line"); never mock the database in API tests; never hit the real API from client tests.

## Agile cadence

Details and templates are in [docs/SPRINTS.md](docs/SPRINTS.md).

- **Sprints** are short (a few hours during the hackathon). Each has one goal and a demo at the end.
- **Daily (or per-sprint) standup**, 5 minutes: what I finished, what I'm doing next, what's blocking me.
- **Board columns**: Backlog → Ready → Doing → Review → Done. "Done" means the [Definition of Done](docs/DEFINITION_OF_DONE.md), nothing less.
- **Retro** after each demo: keep / stop / start, three items max, one action each.

## Conventions

- Commits: `<area>: <imperative summary>` e.g. `server: recompute fatigue when a session is saved`.
- Keep `@arc/dependencies` free of DOM, Node and MediaPipe imports; it is the contract between the server, the client and the CV module.
- API changes start in `dependencies/src/api.ts` (zod schema + DTO type), then the server test, then the route, then the client wrapper.
- Numbers derived from raw reps (fatigue, summaries) are computed on the server from the reps; the client's copies are display-only.
- Record a non-obvious decision as an ADR in `docs/adr/` (copy `0000-template.md`).
