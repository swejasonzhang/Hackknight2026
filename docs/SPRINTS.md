# Sprint plan

Short sprints with a demo at the end of each. Adjust the clock to the hackathon schedule; the shape stays the same: one goal, a demoable increment, a five-minute retro.

## Sprint 0 (done, 2026-10-09): foundation

**Goal:** an end-to-end web app a teammate can run in two commands.

Delivered: monorepo (`dependencies`, `backend`, `frontend`), engine with tests, REST API with integration tests, accounts, pages (Signup, Login, Dashboard, Profiles, Session detail), demo seed, design system, CI, docs.

## Sprint 1 (done, 2026-10-10): camera in the loop + launch

**Goal:** a real rep counted, stored through the API, visible on getarc.health.

The plan changed mid-sprint: instead of waiting on the camera app, the web app learned to track the body itself (ADR-0017), so a member needs nothing but a browser.

Delivered: getarc.health live on Render (D1); recording in the browser with MediaPipe, the shared engine counting reps and sets (C1–C3 in the browser, PR #23); the whole 3D body on every page (PRs #18–#21); the Calibre redesign and folded charts (PRs #13–#17); Arc, the coach, with Gemini words, ElevenLabs voice and hands-free commands (PR #25).

## Sprint 2 (2026-10-10, in review): the member's week, every exercise, every session kept

**Goal:** from sign-up to a week of varied training, any of the camera app's exercises, nothing lost.

Delivered: account deletion and name/email rules (PR #27); Arc's chat as its own page and the week on a calendar (PR #28); the camera app's fifteen-exercise catalog under four body-area tabs (PR #29, in review); a different body area each training day and skippable questions (PR #30, in review); every set saved to MongoDB as it finishes and the camera app's uploads, C4 (PR #31, in review); the camera app's white skeleton over the browser camera (PR #32, in review).

Demo script: sign up → chat with Arc at `/welcome`, skipping one question, and pick an exercise from the catalog → see the week on the dashboard calendar, a different area each day → pick an area and an exercise → **Start recording**: the white skeleton follows the body, reps count, each set saves as it ends and Arc reads it back → the session report, Arc's read, and the day marked done on the calendar.

## Sprint 3: trust and polish

**Goal:** the measurement is believable to a judge, and nothing breaks on stage.

| Owner | Stories |
|---|---|
| CV + FS | agree one set of rep thresholds between the camera app and the browser (open question in the shared doc) |
| FS | D3 CSV export, D4 API-down handling, D5 password reset |
| AI | set `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` on `getarc-api` and rehearse Arc's lines |

## Sprint 4: pitch

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
