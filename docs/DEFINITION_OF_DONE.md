# Definition of Done

A story is done when all of these are true. Reviewers check this list, not just the diff.

- [ ] Every acceptance criterion in the story has a test that fails without the change and passes with it.
- [ ] `npm test` and `npm run typecheck` pass locally and CI is green on the PR.
- [ ] No `any`, no skipped tests, no `console.log` left in production paths.
- [ ] API changes: zod schema + DTO in `dependencies/src/api.ts`, server integration test, route, client wrapper, and the table in `README.md` all updated together.
- [ ] Anything derived from raw reps (fatigue, summaries) is computed on the server; the client never sends it as truth.
- [ ] The change works in the running app (`npm run dev`), not only in tests, and the demo script in `docs/SPRINTS.md` still runs.
- [ ] A non-obvious decision got an ADR in `docs/adr/`.
- [ ] Reviewed by one teammate; squash-merged; branch deleted; card moved to Done.
