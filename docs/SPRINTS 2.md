# Sprint plan

Short sprints with a demo at the end of each. Adjust the clock to the hackathon schedule; the shape stays the same: one goal, a demoable increment, a five-minute retro.

## Sprint 0 (done, 2026-10-09): foundation

**Goal:** an end-to-end web app a teammate can run in two commands.

Delivered: monorepo (`dependencies`, `backend`, `frontend`), engine with tests, REST API with integration tests, accounts, pages (Signup, Login, Dashboard, Profiles, Session detail), demo seed, design system, CI, docs.

## Sprint 1: camera in the loop (CV) + launch (FS)

**Goal:** a real rep counted by the camera app, stored through the API, visible on getarc.health.

| Owner | Stories |
|---|---|
| CV | C1 tracking + rep/set counting, C2 overlay |
| FS | D1 deploy to getarc.health, C4 ingestion end to end with the camera app, review CV PRs |

Demo script: sign up → add a profile → set a goal → camera app records 3 real elbow flexions → the session appears on the dashboard.

## Sprint 2: alignment and trust

**Goal:** the measurement is believable to a judge.

| Owner | Stories |
|---|---|
| CV | C3 alignment check and cue |
| FS | D3 CSV export, D4 API-down handling |

Demo script: show the "face the camera" guidance, a shoulder abduction set with the fatigue nudge, then open getarc.health on a phone.

## Sprint 3: pitch

**Goal:** rehearsed 3-minute demo on the live site with demo history loaded.

Everyone: bug bash, retro actions, pitch rehearsal ×3.

---

## Ceremonies

**Standup (5 min, start of each sprint and once mid-sprint)**

```
Name:   
Done:   
Next:   
Blocked:
```

**Sprint review / demo (10 min):** run the demo script above on `main`, not on a branch.

**Retro (10 min):**

```
Keep:   (one thing that worked)
Stop:   (one thing that cost time)
Start:  (one thing to try next sprint)
Action: (owner + what)
```

## Board

Columns: Backlog → Ready → Doing → Review → Done. WIP limit: one card per person in Doing. A card is Ready only when its acceptance criteria are written down in [BACKLOG.md](BACKLOG.md).
