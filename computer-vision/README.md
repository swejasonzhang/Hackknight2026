# Arc camera app

The computer-vision side of Arc: a Python app that watches the webcam, measures the joint angle with MediaPipe pose landmarks, counts reps against flex/extend thresholds and times rest.

```bash
cd computer-vision
uv sync          # Python 3.12, mediapipe, opencv into .venv
uv run main.py   # opens the webcam window
```

`main.py` starts `ExerciseTracker` from `movements.py`.

## Opening it from the dashboard

`launcher.py` lets the dashboard's **Open the camera app** button start this app on this computer:

```bash
uv run launcher.py   # or python3 launcher.py; standard library only, leave it running
```

It listens on `http://127.0.0.1:8765`, accepts requests only from Arc's own pages carrying an `X-Arc-Launcher: 1` header, and starts `main.py` straight into the profile's plan, with no prompts: `main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45`. `arc_routine.py` maps Arc's movements onto this app's catalog (elbow flexion: Bicep Curls; shoulder abduction: Lateral Raise; seated knee extension: defined there, hip, knee and ankle). Output goes to `camera.log`. With no flags, `uv run main.py` still builds the routine interactively. Tests: `python3 -m unittest`.

Next step (backlog story C4): when a session finishes, send it to the API as described in the root README, section 4, using `POST /api/sessions` with the `x-api-key` header, so it shows up on the dashboard at getarc.health.
