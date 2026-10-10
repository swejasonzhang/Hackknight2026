# ADR-0020: Arc's chat is its own page, and Arc builds a weekly program shown as a calendar

- Date: 2026-10-10
- Status: accepted

## Context

Jason asked for the "Tell Arc what you want from your body" chat to be a whole page between sign-up and the dashboard. It should be skippable, chatbot-like, and focused on what the member wants for themselves. He also asked for a calendar on the dashboard showing the plan Gemini builds from those answers.

Until now `/welcome` lived inside the app shell and ended with a single plan: one movement with its sets, reps and rest. The teammates' `ai-coach` module (PR #26) defined an onboarding survey: how often, the purpose, the goal (strength, hypertrophy or endurance), height, weight and activity level. It also fixed set, rep and rest ranges per goal.

## Decision

- **`/welcome` is a full page outside the app shell.** It has a navy bar with progress ("4 of 9"), Arc's voice and "Skip for now". The conversation scrolls with the page, and the composer is pinned to the bottom. Quick replies for the current question sit above the answer box, alongside typing and the microphone. A "What Arc is learning" checklist sits at the side on wide screens. Sign-up still lands here. Skip goes to the dashboard, which offers the chat again: "Tell Arc what you want", or "Plan my week with Arc" on the calendar.
- **Nine topics, in order:** goals, training goal (strength, muscle or stamina), where to start, side, limits, experience, training days, height, weight. Height and weight can be skipped. The intake keeps its earlier fields and adds `trainingGoal`, `trainingDays`, `heightCm` and `weightKg`, all optional, so older profiles still validate. With Gemini, each reply names its `topic`, which drives the progress and the quick replies. Without Gemini, Arc asks its own questions and reads the answers with tested parsers: weekdays by name or count, feet and inches, pounds.
- **The program is a new collection.** A `Program` holds a summary in Arc's voice and up to seven days, one per weekday. Each day has a title and one to four prescriptions in the plan's shape. As with plans, a new program deactivates the last one. `GET /api/profiles/:id/program` is open to the owner and the camera app's key. Deleting a profile or an account removes its programs.
- **Gemini writes the week; the rules bound it.** `buildProgram` asks Gemini for the week as structured JSON, then `programFromGemini` holds it to the rules:
  - Only the member's days count. A day Gemini drops is filled from Arc's own week.
  - Only catalog movements are kept.
  - Sets, reps and rest are clamped into the goal's ranges.
  - Goal angles come from the catalog, never from the model.

  When Gemini is off or sends nothing usable, `programFromIntake` builds the week with the same rules. Every day opens with the focus movement. Anyone past "new" gets a second, rotating movement. Numbers sit higher in the range with experience, and rest sits lower. The active plan becomes the week's first movement, so Record starts there.
- **The calendar** (`PlanCalendar`, on the dashboard under Record a session) shows a month of Monday-to-Sunday weeks:
  - Each training day is marked planned, done (a session that day) or not recorded (a past training day without one). Today is ringed.
  - Days before the program existed are not marked.
  - The selected day's workout, its sessions and links to Record and to the day's log sit beside the grid.
  - Arrow keys, Home and End, and Page Up and Page Down move the selection.

## Consequences

- The scripted path now asks nine questions instead of six; Gemini usually needs about as many turns.
- The final onboarding turn can make two Gemini calls: the chat, then the week.
- What each day prescribes does not yet change what Record runs. Record still uses the active plan, the week's first movement. Wiring the day's workout and the 14 camera-app exercises into Record is the next change.
