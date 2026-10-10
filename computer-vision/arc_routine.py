"""Turn an Arc plan into the camera app's routine, so the app can start without asking anything.

`main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45` (Arc's plan fields,
checked by `validate_plan` against the same limits as the web app) builds the routine with
`build_routine` and starts counting straight away. `plan_arguments` writes those flags for a
plan. Pure Python, no OpenCV or MediaPipe, so it is tested on its own. (The web app now tracks
the body in the browser itself; this is for running the Python app directly.)
"""

from __future__ import annotations

import argparse
from typing import Any, Callable

# Arc's movements, mapped onto the camera app's catalog in movements.py (all fourteen of it).
CATALOG_IDS = {
    "elbow_flexion": "1",  # Bicep Curls
    "tricep_extension": "2",  # Tricep Extension (Down)
    "shoulder_press": "3",  # Shoulder Press
    "shoulder_abduction": "4",  # Lateral Raise
    "front_raise": "5",  # Front Raise
    "chest_press": "6",  # Chest Press
    "pec_fly": "7",  # Pec Fly
    "lat_pulldown": "8",  # Lat Pulldown
    "bent_over_row": "9",  # Bent-Over Rows
    "deadlift": "10",  # Deadlift
    "squat": "11",  # Squats
    "lunge": "12",  # Lunges
    "ab_twist": "13",  # Ab Twist
    "crunch": "14",  # Crunches
}

# MediaPipe Pose landmark numbers (a fixed standard).
LEFT_HIP, RIGHT_HIP = 23, 24
LEFT_KNEE, RIGHT_KNEE = 25, 26
LEFT_ANKLE, RIGHT_ANKLE = 27, 28

# Seated knee extension is not in the camera app's catalog; defined here the same way. As in the
# catalog, the camera image is mirrored, so the user's right side uses MediaPipe's LEFT landmarks.
KNEE_EXTENSION = {
    "name": "Seated Knee Extension",
    "type": "arm_dual",
    "right_indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
    "left_indices": (RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE),
    "flex_threshold": 100.0,  # the shin hanging, knee near 90 degrees
    "extend_threshold": 160.0,  # the leg nearly straight
    "invert_logic": True,  # a rep counts when the knee angle rises past the extend threshold
    "max_allowed_extension": 185.0,
}

EXERCISES = (*CATALOG_IDS, "seated_knee_extension")
SIDES = ("right", "left")
# The same limits as Arc's plan schema (dependencies/src/api.ts, PlanInputSchema).
LIMITS = {"sets": (1, 10), "reps": (1, 50), "restSeconds": (10, 600)}


class PlanError(ValueError):
    """The plan is not one Arc could have sent."""


def validate_plan(plan: Any) -> dict:
    """The plan, checked field by field; raises PlanError for anything else."""
    if not isinstance(plan, dict):
        raise PlanError("plan must be an object")
    if plan.get("exercise") not in EXERCISES:
        raise PlanError(f"exercise must be one of {', '.join(EXERCISES)}")
    if plan.get("side") not in SIDES:
        raise PlanError("side must be right or left")
    clean = {"exercise": plan["exercise"], "side": plan["side"]}
    for key, (lo, hi) in LIMITS.items():
        value = plan.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or not lo <= value <= hi:
            raise PlanError(f"{key} must be a whole number from {lo} to {hi}")
        clean[key] = value
    return clean


def routine_spec(plan: dict) -> dict:
    """Which catalog exercise (or definition), which side, how many sets and reps."""
    plan = validate_plan(plan)
    spec: dict = {"side": plan["side"], "sets": plan["sets"], "reps": plan["reps"]}
    if plan["exercise"] in CATALOG_IDS:
        spec["catalog_id"] = CATALOG_IDS[plan["exercise"]]
    else:
        spec["definition"] = KNEE_EXTENSION
    return spec


def build_routine(spec: dict, lookup: Callable[[str], dict | None], make_exercise: Callable[..., Any]) -> list:
    """The routine for ExerciseTracker: `lookup` is ExerciseTracker.get_exercise_by_id and
    `make_exercise` is RoutineExercise (both passed in, so this module never imports OpenCV)."""
    data = lookup(spec["catalog_id"]) if "catalog_id" in spec else spec["definition"]
    if data is None:
        raise PlanError(f"the camera app has no exercise {spec.get('catalog_id')}")
    side = spec["side"]
    # One-sided movements follow the chosen side; whole-body ones use the catalog's own landmarks.
    sided = data.get("type") == "arm_dual"
    indices = data[f"{side}_indices"] if sided else data["indices"]
    return [
        make_exercise(
            name=f"{data['name']} ({side.capitalize()})" if sided else data["name"],
            primary_joint_indices=indices,
            flex_threshold=data["flex_threshold"],
            extend_threshold=data["extend_threshold"],
            target_reps=spec["reps"],
            target_sets=spec["sets"],
            invert_logic=data["invert_logic"],
            max_allowed_extension=data.get("max_allowed_extension", 180.0),
        )
    ]


def plan_arguments(plan: dict) -> list[str]:
    """Command-line arguments for main.py, from a validated plan (enums and whole numbers only)."""
    plan = validate_plan(plan)
    return ["--exercise", plan["exercise"], "--side", plan["side"], "--sets", str(plan["sets"]), "--reps", str(plan["reps"]), "--rest", str(plan["restSeconds"])]


def plan_from_arguments(argv: list[str]) -> dict | None:
    """The plan main.py was started with, or None to build the routine interactively."""
    parser = argparse.ArgumentParser(description="Arc camera app")
    parser.add_argument("--exercise", choices=EXERCISES)
    parser.add_argument("--side", choices=SIDES, default="right")
    parser.add_argument("--sets", type=int, default=3)
    parser.add_argument("--reps", type=int, default=8)
    parser.add_argument("--rest", type=int, default=45)
    args = parser.parse_args(argv)
    if args.exercise is None:
        return None
    return validate_plan({"exercise": args.exercise, "side": args.side, "sets": args.sets, "reps": args.reps, "restSeconds": args.rest})
