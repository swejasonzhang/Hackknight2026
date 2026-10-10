# ADR-0016: The camera app starts straight into the plan, with no prompts

- Date: 2026-10-10
- Status: partly superseded by ADR-0017 (the launcher is removed; `main.py` still starts from a plan with these flags); amended by ADR-0021 (all fourteen catalog movements mapped) and ADR-0023 (`--profile` sends the session to Arc)

## Context

ADR-0015 opened the camera app in a new terminal window, where it asked for the routine: exercise, side, reps, sets and rest. Jason asked that recording a session never wait for an input, and just start when the button is clicked.

## Decision

- **The dashboard sends the plan.** It sends the selected profile's active plan: exercise, side, sets, reps and rest. Without a saved plan, it sends the exercise on screen, right side, 3 × 8 with 45 s rest. The panel shows that line before the press.
- **The launcher checks it and starts the app directly.** `arc_routine.validate_plan` checks every field against Arc's plan schema: the exercise and side from fixed lists, and sets 1–10, reps 1–50, rest 10–600 as whole numbers. Anything else gets a 400. The launcher then runs `main.py --exercise … --side … --sets … --reps … --rest …` with no terminal and stdin closed, so it can never wait for input. Output goes to `camera.log`.
- **`main.py` builds the routine from those flags.** It maps elbow flexion to the catalog's Bicep Curls and shoulder abduction to Lateral Raise. Seated knee extension, which the catalog lacks, is defined alongside: hip, knee and ankle, mirrored like the catalog, with a rep counted when the knee straightens past 160°. A routine passed in skips every prompt, counting starts as the webcam opens, and rests advance on their own timer. With no flags, `main.py` still builds a routine interactively.

## Consequences

- The camera app's own code (`movements.py`) is unchanged. `main.py` gained the flags, and `arc_routine.py` is pure Python with its own tests.
- The plan's goal angle does not change the camera app's thresholds. Those stay the computer-vision team's calibration.
