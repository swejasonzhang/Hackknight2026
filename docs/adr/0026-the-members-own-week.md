# ADR-0026: The member's own week, done a movement at a time

- Date: 2026-10-10
- Status: accepted; amends ADR-0020 and ADR-0022

## Context

Jason asked for two things:
- "Within the plan the user can select their current plan and adjust it however they like."
- "One day can have several exercises that target a certain muscle group. When you finish an exercise for that muscle group then it gets crossed out within that day and you move onto the next."

A teammate (Kelvin) reported three problems while testing:
1. A new plan's workout did not show in the log, so it could not be recorded from there.
2. There was no way on to the next workout of the day.
3. Arc's suggested week could not be edited by hand during the chat.

Before this change:
- Only Arc could write the week. The plan page edited a single movement's plan.
- Arc gave someone new one movement a day.
- The log listed only recorded sessions.
- After a recording, the report was a dead end.

## Decision

- **The week is the member's.** `PUT /api/profiles/:id/program` saves a week arranged by hand:
  - any days, up to eight movements a day, every number inside the plan's limits;
  - each movement can name the muscle group it is there for (`muscle`).

  It becomes the week in force. The last one is kept, and `GET /programs` lists them so an earlier week can be started from again. Arc writes the summary (`describeWeek`), and the active plan follows the first movement. Only members can change a week: the camera app's key can read weeks but gets `403` on a change.
- **One editor, two places.** The plan page and the end of the welcome chat use the same week editor (`WeekEditor`). In it:
  - a day is a training day or a rest day;
  - a movement is added by target muscle, then a movement that works it, and joins its muscle group;
  - movements can be moved up and down, changed (sets, reps, rest, goal, and side where there is one) or removed;
  - a day's title follows what it holds unless the member types one.

  A training day with nothing in it is refused. A body area on two training days running gets a gentle note, not a refusal.
- **Several movements a day by muscle group.** Arc's own week gives two movements a day to someone new and three to everyone else. Gemini is asked for two to four. Each movement names its muscle.
- **A day is a checklist.** `checklistFor` ticks off one planned movement per session of it recorded that day. The checklist (`TodayList`) appears in four places:
  - the log, for any day since the week was set (Kelvin's first issue);
  - the dashboard calendar;
  - under the camera on `/record`, which with no movement named starts on today's next one;
  - at the top of the session report on the day itself, with **Next** to the following movement (Kelvin's second issue).

  It groups the movements under their muscle groups, crosses out what is done and offers the next one.
- **Today's numbers first.** `prescriptionFor` now prefers the day's own prescription in the week over the single plan, so a movement planned twice in a week keeps each day's numbers.

## Consequences

- Plans and weeks stay in history; nothing is deleted when the member rearranges.
- A day's checklist reads the week in force. A day before the week was set shows only its sessions, never a plan it did not have.
- The single-movement plan editor is gone. `PUT /plan` stays for the camera app and older clients.
