# ADR-0017: Track the body in the browser

- Date: 2026-10-10
- Status: accepted (supersedes ADR-0015 and the launcher in ADR-0016; amends ADR-0004); amended by ADR-0023 (each set is saved as it finishes); ADR-0021 took the rep thresholds from the camera app's catalog

## Context

Recording a session needed the Python camera app and a local launcher on the user's computer: Python, `uv sync`, and `uv run launcher.py` before the dashboard button worked. Jason judged that a poor experience and decided to track the body in the browser. ADR-0004 had made the web app a viewer, with the camera app as the only writer.

## Decision

- **Recording lives at `/record`, opened by the dashboard's "Start recording".** The camera starts as soon as the page opens; the browser asks for permission once. MediaPipe Pose Landmarker (`@mediapipe/tasks-vision` 1.0.1, the lite model) runs on the device, on the GPU when available and the CPU otherwise. Counting begins as soon as the movement's three joints are in view.
- **Measurement reuses the shared engine.** Each exercise's landmarks, metric conversion, thresholds and minimum rep time come from `dependencies/src/engine/exercises.ts`. Smoothing uses the One Euro filter, and reps come from the hysteresis rep counter.
  - `record/angle.ts` reads the joint on the real picture: it corrects for the video's aspect ratio and refuses landmarks below 0.5 visibility.
  - `record/recorder.ts` waits until the joint has been in view for 600 ms. It then runs the plan's sets and rests by itself and finishes after the last set, or early with the unfinished set marked as ended early. It stores whole-millisecond times.
- **Sessions are saved as the signed-in user.** A recorded session goes through `POST /api/sessions`, which already accepted a user's own profiles and recomputes fatigue and the summary on the server. The report opens after saving. The video never leaves the device; only the angle of each rep is stored.
- **What runs where.** The WebAssembly runtime ships with the app, so its version always matches the library; it is code-split and loads only on `/record`. The model file loads from MediaPipe's model storage. In development, `/record?simulate` swaps the camera for a pretend person doing reps, so the whole path can be tested in a headless browser.
- **The launcher is removed.** The Python app stays as the computer-vision team's tool and can still start from a plan's flags (ADR-0016).

## Consequences

- No install for users. Any laptop, desktop or phone with a camera and a current browser can record, which also closes the gap where camera-app sessions never reached the dashboard (backlog C4) for browser recordings.
- Two implementations now measure movement: the Python app and the browser. The browser uses the engine's thresholds; agreeing them with the computer-vision team is an open item.
- The camera needs a secure page: https in production, localhost in development. A phone opening the dev server by LAN IP gets a clear message instead.
