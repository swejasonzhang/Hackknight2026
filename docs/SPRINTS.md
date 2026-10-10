# Sprint plan

Short sprints with a demo at the end of each. Adjust the clock to the hackathon schedule; the shape stays the same: one goal, a demoable increment, a five-minute retro.

## Sprint 0 (done, 2026-10-09): foundation

**Goal:** an end-to-end web app a teammate can run in two commands.

Delivered: monorepo (`dependencies`, `backend`, `frontend`), engine with tests, REST API with integration tests, accounts, pages (Signup, Login, Dashboard, Profiles, Session detail), demo seed, design system, CI, docs.

## Sprint 1 (done, 2026-10-10): camera in the loop + launch

**Goal:** a real rep counted, stored through the API, visible on getarc.health.

The plan changed mid-sprint: instead of waiting on the camera app, the web app learned to track the body itself (ADR-0017), so a member needs nothing but a browser.

Delivered: getarc.health live on Render (D1); recording in the browser with MediaPipe, the shared engine counting reps and sets (C1–C3 in the browser, PR #23); the whole 3D body on every page (PRs #18–#21); the Calibre redesign and folded charts (PRs #13–#17); Arc, the coach, with Gemini words, ElevenLabs voice and hands-free commands (PR #25).

## Sprint 2 (done, 2026-10-10): the member's week, every exercise, every session kept

**Goal:** from sign-up to a week of varied training, any of the camera app's exercises, nothing lost.

Delivered: account deletion and name/email rules (PR #27); Arc's chat as its own page and the week on a calendar (PR #28); the camera app's fifteen-exercise catalog under four body-area tabs (PR #29); a different body area each training day and skippable questions (PR #30); every set saved to MongoDB as it finishes and the camera app's uploads, C4 (PR #31); the camera app's white skeleton over the browser camera (PR #32).

## Sprint 3 (done, 2026-10-10): the coach, the body and the week

**Goal:** Arc coaches through the whole recording, the body shows what each movement works, and the member owns their week.

Delivered: Arc always listening and answering, ElevenLabs for every line (G1, PR #33); the anatomical body with muscles in red and yellow and a form guide beside the camera (G2, PR #34); the member's own week, crossed out a movement at a time with Next (G3, PR #35, which also answers the teammates' observed issues); the household leaderboard and the weight held (G4, PR #36); the landing readouts brought up to date (G5, PR #37); an end-to-end check of the whole journey and a clean-up for the demo.

Demo script (the live site, about three minutes):

1. Landing page: the 3D body curling with its biceps lit, then the readouts board (the Muscles and Household views).
2. **Create account** → `/welcome`: answer Arc with the quick replies (Build muscle, a back movement from the catalog, Every day), skip height and weight; Arc builds the week → **Change it**: add a lower-back movement to today → **Save my week**.
3. Dashboard: the calendar's today panel lists the day under each muscle group with **Next**; the figure names the muscles it works.
4. **Next** → `/record`: the form guide on the right, Weight held, the white skeleton on the body; ask Arc "is my form ok" mid-set; let a set finish and hear Arc's read; **Finish and save**.
5. The report: the movement crossed out, **Next** to the following one, Arc's read of the session.
6. Profiles → **Load demo data** → the leaderboard by Arc score, then by Weight.

## Sprint 4: trust and polish

**Goal:** the measurement is believable to a judge, and nothing breaks on stage.

| Owner | Stories |
|---|---|
| AI | D8: set `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` on `getarc-api` and rehearse Arc's lines |
| CV + FS | D7: one set of rep thresholds between the camera app and the browser (done, ADR-0029); CV tries each movement on camera |
| FS | D6 faster first load, D4 API-down handling; D3 CSV export and D5 password reset if time allows |

## Sprint 5: pitch

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
