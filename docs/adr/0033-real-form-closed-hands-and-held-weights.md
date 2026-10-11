# ADR-0033: Real form: closed hands, held weights, and movements as done in a gym

- Date: 2026-10-11
- Status: accepted; amends ADR-0030 (the body) and ADR-0029 (the pec fly's rest angle in the shared catalog)

## Context

Jason raised three problems on 2026-10-11:

- "Some exercises require the hand to be closed as to simulate holding weights."
- "Other exercises seem a little wonky based on real movement and placement. For example the pec fly's start position and end position are entirely incorrect."
- "There are some displays of exercises where the end range is outside the target angle, therefore resulting in the ROM being inaccurate since it would be impossible to reach the target ROM."

An audit of all fifteen movements, at rest, at the goal and at the end of the range, found:

- **Hands.** Every figure's hands were open, curl or press alike.
- **Pec fly.** It started with the arms already half closed. At the end the sweep ran past the point where the hands meet, so the arms crossed over the face.
- **Bent-over row.** It lifted the elbow far above the back.
- **Ab twist.** It leaned the whole body sideways like a side bend, because the tracker measures the shoulder line's tilt.
- **Stale goals.** A goal saved before a movement's range was narrowed (a front raise at 135° against today's 110° end) could never be reached. The member was always told they fell short of it.

## Decision

- **Closed hands, baked from the rig.**
  - `bake.mjs` curls each finger with MakeHuman's own finger bones and skin weights: the knuckle about 75°, the middle joint 90°, the tip 48°, and the thumb a little. That closes the hand round a handle about 3.5 cm across.
  - It stores how far each of the 3,012 finger vertices moves, per sex, and where the handle sits in the closed hand: its centre and its line across the palm.
  - The app blends the closed hand in per movement (`Grip`): 1 round a weight, 0.55 for hands clasped together, 0.18 for a relaxed hand.
- **What each hand holds** (`body/hold.ts`):
  - **A dumbbell:** the curl, lateral and front raises, the press, the row and the deadlift.
  - **A cable's handle:** the triceps pushdown, the chest press and the fly.
  - **A bar across both hands:** the lat pulldown.
  - **Nothing:** the squat, the lunge, the knee extension, the crunch and the twist.
  - A one-arm movement holds its weight in the working hand only, and the other hand relaxes.
  - The weight follows the hand bone exactly.
  - The figures in "Your body, as trained" and a challenge's finish stand with relaxed, empty hands.
- **Wrists turn to hold it right.**
  - Each movement names its handle's line: across the body (the press, the front raise, the deadlift, the bar), pointing forward (a neutral grip: the row, the lateral raise, the hammer curl), or upright (the fly's handles).
  - `skinMatrices` turns the hand about the forearm to that line, and the forearm half as far, as a wrist turns. The wrist and elbow stay where the pose puts them.
- **Movements as done in a gym:**
  - **The pec fly** opens wide, near level with the shoulders, and closes until the hands meet on the body's midline in front of the chest, never past it. The arms drop from shoulder to chest height as they close. Its rest angle is now 15° (was 40°) so the figure starts wide open. The camera app's catalog was regenerated, and the counting thresholds are unchanged.
  - **The bent-over row** drives the elbow back along the body while the forearm bends toward the hip. The elbow never rises above the shoulder, and the elbow's bend is still exactly the reading.
  - **The ab twist** turns the upper body about the upright, up to 50°, as well as leaning, like a woodchop. The lean is solved so the shoulder line, seen face on, tilts by exactly the reading. The trunk's front turns with it in the skinning (`twist`).
- **Goals inside reach** (`reachableGoal`). Plans and weeks serve every goal inside its movement's goal range, so a goal saved before a range was narrowed is brought to the movement's end. The gauge already drew its goal tick no further than the end.
- **Fixed in #45 on the way:** the pec fly is read on the picture, not in 3D. Its reading runs across the body (both wrists through one shoulder), and its thresholds are set on the picture.

## Consequences

- `body.bin` grows by about 40 KB for the closed hand.
- Hands are posed per movement, not per moment: a hand does not open and close within a rep.
- The crunch's goal (55°) still asks for a strong curl with near-straight legs. Its thresholds are shared with the camera app, so changing them is left for a decision with the CV team.
