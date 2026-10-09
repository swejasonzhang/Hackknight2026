# Arc camera app

The computer-vision side of Arc: a Python app that watches the webcam, measures the joint angle with MediaPipe pose landmarks, counts reps against flex/extend thresholds and times rest.

```bash
cd computer-vision
uv sync          # Python 3.12, mediapipe, opencv into .venv
uv run main.py   # opens the webcam window
```

`main.py` starts `ExerciseTracker` from `movements.py`.

Next step (backlog story C4): when a session finishes, send it to the API as described in the root README, section 4, using `POST /api/sessions` with the `x-api-key` header, so it shows up on the dashboard at getarc.health.
