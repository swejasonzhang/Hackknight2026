# ADR-0028: Reps count only with good form, and the camera shows a movement indicator

- Date: 2026-10-10
- Status: accepted; amends ADR-0017 and ADR-0024, replaces the white skeleton from PR #32

## Context

Jason asked for four things:
- "Gemini counts the reps when there is the correct form."
- "The camera within the browser shouldn't have the white lines... should only have an indicator showing the movement."
- "Range of motion should be limited based on the exercise."
- "The arm is lifted past the shoulder."

Until now:
- **Counting.** A rep counted once the angle reached the movement's threshold and came back. A swinging curl counted the same as a strict one. A rep under the tempo floor vanished silently.
- **The camera view.** It drew MediaPipe's whole skeleton in white.
- **The figure's range.** It could swing a curl to 180° and raise an arm straight overhead in a lateral raise.

## Decision

- **Good form decides what counts.** Each movement lists what it must keep while a rep is under way (`FORM_CHECKS`):
  - A part that stays still: the upper arm in curls and tricep extensions, the trunk against swinging in curls, raises and presses, the back in a row, the chest in a lunge, the thigh in a knee extension.
  - A limb that stays straight: the arm in raises.
  - Movements that use the whole body (deadlift, squat, crunch, twist, pec fly) are judged on depth and tempo alone.

  `FormWatch` checks every frame of a rep against the pose at its start and skips any check whose landmarks the model cannot see. A rep that breaks a check, or is quicker than the movement's floor, is not counted. Arc says why at once ("That one didn't count: keep your upper arm still."). The set keeps the refused reps with their reasons (`rejected`). Arc's read of the set says how many did not count and why, and leads with the fix; Gemini gets the same facts.
- **Judged on the device, worded by Arc.** The checks run in the browser on the pose landmarks, frame by frame. Sending video to Gemini would break the promise that the video never leaves the device, and could not keep up with a rep. Gemini still speaks for Arc about the set: it is told which reps were refused and why.
- **One indicator, no skeleton.** The camera shows only the working joint:
  - an arc from the limb to where it should go now (the goal on the way up, the start on the way down), ending in an arrow;
  - the goal as a tick, the arc turning green at the goal;
  - a label with what to do and the angle, mirrored back so it reads the right way.

  On a phone the set, rep and angle ride on the camera too.
- **Every movement stops at its own range.** `maxDeg` is the furthest the movement goes: a curl at 150°, a lateral raise at 105°, a front raise at 110°. The 3D figure never goes past it. A goal must sit between where a rep starts counting and that end (`goalRange`). The week editor and `PUT`/`PATCH` on plans and weeks refuse a goal outside it.

## Consequences

- The checks are tuned leniently (25° for the upper arm, 15° for swinging, 140° for a straight arm) so landmark jitter does not refuse good reps. The simulated person's reps all count, in every movement on both sides, which the tests check.
- The Python camera app still counts with its own rules; aligning them is backlog D7.
- Older sessions and the camera app's uploads have no `rejected`. It is optional everywhere.
