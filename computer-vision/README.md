# Arc camera app

The computer-vision side of Arc: a Python app that watches the webcam, measures the joint angle with MediaPipe pose landmarks, counts reps against flex/extend thresholds and times rest.

```bash
cd computer-vision
uv sync          # Python 3.12, mediapipe, opencv into .venv
uv run main.py   # opens the webcam window
```

`main.py` starts `ExerciseTracker` from `movements.py`.

## Starting from a plan

`uv run main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45` starts straight into an Arc plan with no prompts. `arc_routine.py` maps each of Arc's fifteen movement ids onto this app's catalog: all fourteen catalog exercises, once each (`elbow_flexion` is Bicep Curls, `shoulder_abduction` Lateral Raise, `squat` Squats and so on), plus the seated knee extension, defined there on the hip, knee and ankle. One-sided exercises follow `--side`; whole-body ones use the catalog's own landmarks. With no flags, `uv run main.py` builds the routine interactively.

## Saving the session to Arc

Add `--profile <profile id>` and set `CV_API_KEY` (the API's shared key) to send the finished session to Arc, where it lands in MongoDB beside the browser's and shows on the dashboard:

```bash
CV_API_KEY=… uv run main.py --exercise squat --side right --sets 3 --reps 8 --rest 60 --profile <profile id>
```

`arc_upload.py` turns this app's own export into Arc's session (reps grouped by set, times rebuilt from each rep's duration and the time since the rep before, the plan's rest between sets, each peak converted to Arc's number for the movement and its goal from Arc's catalog) and posts it to `POST /api/sessions` with the key in the `x-api-key` header. It goes to `https://api.getarc.health` unless `ARC_API_URL` says otherwise; plain HTTP is allowed only to this computer (`http://localhost:8787` for a local API). Profile ids come from `GET /api/profiles` with the same key.

Tests: `python3 -m unittest` (plan mapping in `test_arc_routine.py`, the upload in `test_arc_upload.py`; CI runs both).

The web app also records in the browser itself (MediaPipe's JavaScript pose model, root README section 4b), drawing the same white skeleton this app draws, so members need neither Python nor this app; this app remains the computer-vision team's tool and saves to the same place.
