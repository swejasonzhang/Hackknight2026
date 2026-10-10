# ADR-0021: Arc tracks the camera app's whole catalog, picked from four body-area tabs

- Date: 2026-10-10
- Status: accepted

## Context

Jason asked for "all of the different exercises within computer vision" on the dashboard, under four tabs instead of the three movement switches, with "anything and everything" updating when a workout is picked. He chose four body-area tabs: Upper body, Back, Legs and Core. He also asked that Arc's "where to start" offer the whole catalog rather than three movements.

The camera app's catalog (`computer-vision/movements.py`) has fourteen exercises in six groups. Arc had three movements: elbow flexion (the catalog's bicep curl), shoulder abduction (its lateral raise) and the seated knee extension, which the camera app defines in `arc_routine.py`.

## Decision

- **One catalog of fifteen.** These are the fourteen catalog exercises plus the seated knee extension, in `dependencies/src/engine/exercises.ts`. Each has a name, a short label, a body area, the camera app's landmarks, a metric that rises into the rep, rep thresholds, a goal, and a rest and furthest angle for the 3D body.
  - Thresholds come from the camera app, eased a little where the browser's smoothing needs room.
  - The three original ids stay, so stored sessions and plans stay valid; they take the catalog's names (Bicep curl, Lateral raise).
  - The lateral raise's default goal drops to 90°, the height the camera app counts at.
  - The ab twist is measured as the slope of the shoulder line against the level, as the camera app does.
  - The pec fly measures the angle at the left shoulder between the two wrists, on both sides.
  - The database enums, Gemini's prompt and schema, the welcome page's choices and the Python mapping all come from this list. A fifteenth or sixteenth exercise is one entry.
- **Four tabs, then the area's movements.** `ExercisePicker` is the area tabs over chips for the area's movements. Switching area picks its first movement. The pick lives in `?exercise=`.
- **Everything follows the pick.**
  - The 3D body, the readings and the charts.
  - The calendar: days that hold the movement are marked.
  - Record: **Start recording** opens `/record?exercise=…` at `prescriptionFor`'s numbers. That is the saved plan when it is for this movement, else the week Arc built (today's prescription first), else the member's goal ranges on their side.
- **One body, many poses.** `skeleton.ts` poses the whole body for every movement from the reading:
  - curls, extensions and presses with the arm;
  - raises from the shoulder;
  - hinges, squats and lunges with the feet planted (the lunge and the pec fly found by bisection);
  - a crunch lying down, and a twist leaning the shoulders.

  The goniometer arc is measured from the tracked joint's own base segment, so it stays on the joint when the whole body moves. The development simulator reads its landmarks from this body, so the figure, the tracker and the simulator always agree. A test counts reps for all fifteen movements, both sides, through the camera path.
- **Arc's "where to start" shows the catalog.** The question names the four areas, and the reply carries every movement grouped by area (`choices`). The welcome page shows them as a card in the conversation. Gemini is given the same list and told never to offer only a few. Typed or tapped names map to their movement.
- **The Python camera app maps all fourteen.** `arc_routine.py` maps every Arc id to its catalog entry; whole-body movements use the catalog's own landmarks whichever side is picked.

## Consequences

- Demo data covers every movement, so each tab has six weeks of readings. Each movement's starting gap and gains scale with its range.
- The landing page's demo board keeps three featured movements; its spec and FAQ describe the fifteen.
- The shoulder movements measure from the trunk line, as a goniometer does. A raw hip–shoulder–elbow reading on a real person sits a few degrees off that line, the camera app's calibration question, still open with the CV team.
