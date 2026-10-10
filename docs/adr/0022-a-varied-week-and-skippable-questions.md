# ADR-0022: The week works a different body area each day, and every question can be skipped

- Date: 2026-10-10
- Status: accepted; amends ADR-0020

## Context

ADR-0020's week opened every training day with the member's focus movement and added a second movement from the same area. Jason pointed out that nobody trains the same muscle group every day of a week: "Ensure every week is diverse and not everything is the same muscle group." He also wanted to be able to skip through Arc's questions.

## Decision

- **One body area per training day, in turn.** Arc's own week (`programFromIntake`) gives each training day one area. The areas cycle upper body, legs, back, core, starting from the focus's area.
  - No area falls on two training days running, and the week covers as many areas as it has days, up to four.
  - The focus movement opens the week.
  - An area that comes round again uses its other movements.
  - Someone new does one movement a day; everyone else does two.
- **Gemini is held to the same rule.** Gemini is told to give each day one area and never the same area two training days running. `isDiverseWeek` checks what comes back: no area two training days running, and at least three areas when there are three or more days. A week that fails is replaced by Arc's own.
- **Skip this question.** Answering "Skip" (or "pass", "next", "not sure") takes a sensible default for that topic:
  - goals: move better; training goal: muscle;
  - focus: the bicep curl; side: right;
  - no limits; some experience; three spread days;
  - height and weight are left out.

  Gemini is told to accept a skip and never ask that question again.
- **Build my week now.** The welcome page can stop the questions at any point (`finish: true`). The server builds the intake from what has been said, with defaults for the rest, then the week, Gemini writing it when configured.
- **Each answer is read for its own question.** Arc's lines now carry the topic they asked (`ChatTurn.topic`), so an answer is matched to the question it followed even when Gemini asks out of order. Lines without a topic fall back to the scripted order.

## Consequences

- A week may not include the focus area every day. The focus movement still opens the week and leads its area's days.
- Programs built before this change keep their old shape until Arc rebuilds them ("Rebuild with Arc" on the calendar).
