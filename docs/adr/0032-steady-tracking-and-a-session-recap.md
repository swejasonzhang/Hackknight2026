# ADR-0032: Steady tracking, a true 0° on the landing page, and a session recap

- Date: 2026-10-11
- Status: accepted; amends ADR-0023 (browser tracking) and ADR-0024 (Arc's reads)

## Context

Jason raised three problems on 2026-10-11:

- "The tracking of the body part keeps on jittering, for example within right bicep curls; it's very chaotic in terms of tracking."
- "Within the landing page, the degree never hit 0 when it should."
- "Arc's read should be a summary in English of that specific session that took place."

The causes, traced in the code:

- **The jitter.**
  - The camera overlay was drawn from the pose model's raw landmarks every frame. Only the angle went through a filter, so the joint marker and its arc shook by a few pixels.
  - The model was MediaPipe's lite variant, the noisiest.
  - A landmark's visibility hovers near the 0.5 cut-off as the hand passes the body, so tracking blinked on and off.
  - The angle was measured on the flat picture. In a curl done facing the phone, the forearm swings toward the lens and shortens to a stub on the picture. A few pixels of shake then swing its angle across the whole range: one test frame reads 36°, the next 144°.
  - A movement with no side (a squat) could flick between the two legs from frame to frame.
- **The landing gauge.** The hero's rep loop was hard-coded to rest at 18°. A straight arm is 0° of elbow flexion, the movement's own `restDeg`.
- **The read.**
  - Gemini was given the member's goals and asked for coaching, and was never told to write English.
  - It was not given what made the session that session: the time, the weight, the plan against what was done, and the reps that did not count and why.
  - The offline template was short.
  - The report page also kept its read across a move from one session's report to another's.

## Decision

- **Steady landmarks** (`frontend/src/record/steady.ts`):
  - Every landmark is smoothed before anything reads or draws it, with a One Euro filter per landmark and axis, in the picture and in space. The filter holds still when the limb is still and follows quickly when it moves.
  - Visibility is eased, so one doubtful frame keeps the joint.
  - A frame where the model found nobody is bridged for 250 ms.
  - Tests use the simulated person plus camera-like noise. Held still, the elbow angle shakes about a third as much. A curl's top is still reached within a few degrees. A whole shaky set counts every rep and refuses none for form.
- **The full model, and angles in space.**
  - The recorder loads MediaPipe's full pose model.
  - `readJoint` measures the angle from the model's world landmarks, in metres. A curl facing the camera then reads true, and the same few pixels of shake move it by under 3°. A tilt (the ab twist's shoulder line) stays on the picture, where level is.
  - A two-sided movement keeps the side it is on until the other is seen clearly better.
- **The landing hero** rests at the curl's own rest, 0°. It counts reps at the real counter's entry and exit angles (90° and 40°). A test checks every rep of the loop starts and ends at 0°.
- **The session read is a recap of that one session, in English.**
  - Gemini gets the session's own facts: the movement and side, the time, the weight, the sets and reps against the plan, the best and mean rep, each set's peaks and the range it lost, and the reps not counted with their reasons. It also gets the previous and first sessions for one clause of comparison.
  - The member's limits are passed only to shape the next step. Their goals are left out.
  - A reply is used only if it reads as English and names the session's best rep or its rep count. Otherwise Arc's own recap of the same facts is used.
  - Reads are versioned (`SESSION_READ_VERSION`), so a session read the old way is read again when its report opens.
  - The report keys the read by session.

## Consequences

- The full model is about 9 MB against the lite model's 5.5, loaded once per visit to the record page, and it costs more each frame. Laptops and recent phones keep up. If an older phone cannot, the next step is to choose the model by the device's speed.
- World landmarks come from a single camera, so their depth is an estimate. They are still steadier for an arm moving toward the lens than the flat picture, which carries no depth at all. The angle for the dashboard is the same metric as before; side on, the two agree.
- The simulator moves in the picture's plane, so its angles in space are its picture's angles, and every movement still counts end to end through the camera path.
- Real-camera checks still need a device: the tests stand in with recorded-style noise, not a webcam.
