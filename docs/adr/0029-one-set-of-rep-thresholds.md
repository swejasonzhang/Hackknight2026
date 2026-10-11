# ADR-0029: The camera app counts reps at Arc's thresholds

- Date: 2026-10-10
- Status: accepted; closes backlog D7, amends ADR-0021 and ADR-0023

## Context

Jason: "The Python camera app counts reps with its own thresholds. Its front raise still runs to 135°, against 95° in the browser. This needs to be more consistent."

Until now, each side counted with its own numbers:
- **The browser** counted with `exercises.ts`. A front raise counts once the arm passes 80° and returns under 30°, and aims for a 95° goal.
- **The camera app** counted with the thresholds in `movements.py`. The same front raise needed 135°.

The same rep could count in one and not the other, and both saved to the same dashboard. `arc_upload.py` also kept its own copy of each movement's metric and goal. Its test caught drift only by reading the TypeScript with a regular expression.

The ab twist differed in what it measured, not only where it counted:
- **The browser** reads the shoulder line's tilt off the level, 0 to 90°.
- **The camera app** read the line's raw angle. In its mirrored frame, a level line can read 180°.

## Decision

- **One source.** `dependencies/src/engine/exercises.ts` stays the only place a threshold or goal is set. `computer-vision/arc_catalog.json` holds, for each movement:
  - its name, and whether it is sided;
  - how it is measured, and whether its number is the bend or the joint angle itself;
  - its rest, exit, enter, goal and furthest angles, and its tempo floor.

  `dependencies/src/engine/cameraCatalog.test.ts` writes the JSON (`npm run catalog -w dependencies`). The test fails in CI when the two disagree. The JSON carries a note never to edit it by hand.
- **Converted, not copied.** `arc_routine.arc_thresholds` turns Arc's enter and exit angles into the camera app's flex and extend thresholds.
  - **Bend movements** (curl, pec fly, pulldown, row, squat, lunge, crunch): Arc's number is 180° minus the joint angle. So `flex = 180 − enter`, `extend = 180 − exit`, normal logic.
  - **Joint-angle movements** (tricep extension, presses, raises, deadlift, knee extension, and the twist's tilt): `extend = enter`, `flex = exit`, inverted logic.

  A front raise now counts past 80° and is armed again under 30°, as in the browser.
- **Every entry point.** The rule applies however the app is started:
  - From a plan, `build_routine` applies it.
  - Without one, `main.py` gives the whole catalog Arc's thresholds at start-up (`align_catalog`). So does `movements.py` when run directly.
  - The fallback routine reads its thresholds from the catalog instead of repeating numbers.
- **The camera team keeps the rest.** Landmarks, names, drawing and the over-extension limits stay in `movements.py`. In the browser, `maxDeg` is where a goal and the 3D figure stop, not a form penalty, so it is not mapped onto the camera app's over-extension warning.
- **The twist measures the same thing.** `calculate_torso_twist_angle` folds the line's angle to its tilt off the level (0 to 90°), whichever shoulder sits on the left. This matches `tiltDeg` in the browser.
- **The upload reads the same file.** `arc_upload.METRIC` and `TARGET_DEG` come from `arc_catalog.json` instead of hand-kept dictionaries.

## Consequences

- A rep counts at the same angles in both apps. The Python tests replay each of the fifteen movements through the camera app's counting rule. A rep that reaches Arc's enter angle counts. One that stops a degree short does not. No second rep counts without a return to the exit angle.
- The camera app's counts change for every movement whose numbers differed. A curl counts at 90° of bend, not the camera app's own 140°. A twist needs a 22° tilt, not 8.5°. The CV team should try each movement on camera.
- Two things are still the browser's alone:
  - **Form checks** (ADR-0028), which reject a rep that swings or breaks form.
  - **The tempo floor** (`minRepMs`), which rejects a rep that is too quick.

  The JSON carries `minRepMs` for when the camera app adopts it.
- Changing a threshold is one edit in `exercises.ts` plus `npm run catalog -w dependencies`. CI fails if the second step is forgotten.
