# Arc camera app

The computer-vision side of Arc: a Python app that watches the webcam, measures the joint angle with MediaPipe pose landmarks, counts reps against flex/extend thresholds and times rest.

```bash
cd computer-vision
uv sync          # Python 3.12, mediapipe, opencv into .venv
uv run main.py   # opens the webcam window
```

`main.py` starts `ExerciseTracker` from `movements.py`.

## Starting from a plan

`uv run main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45` starts straight into an Arc plan with no prompts; `arc_routine.py` maps Arc's movements onto this app's catalog (elbow flexion: Bicep Curls; shoulder abduction: Lateral Raise; seated knee extension: defined there, hip, knee and ankle). With no flags, `uv run main.py` builds the routine interactively. Tests: `python3 -m unittest`.

The web app now records in the browser itself (MediaPipe's JavaScript pose model, root README section 4b), so users need neither Python nor this app; this app remains the computer-vision team's tool.

Next step (backlog story C4): when a session finishes, send it to the API as described in the root README, section 4, using `POST /api/sessions` with the `x-api-key` header, so it shows up on the dashboard at getarc.health.
