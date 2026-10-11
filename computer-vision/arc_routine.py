"""Turn an Arc plan into the camera app's routine, so the app can start without asking anything.

`main.py --exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45` (Arc's plan fields,
checked by `validate_plan` against the same limits as the web app) builds the routine with
`build_routine` and starts counting straight away. `plan_arguments` writes those flags for a
plan. Reps count at Arc's own thresholds (`arc_thresholds`, from arc_catalog.json), the same
angles the browser counts at, and `align_catalog` gives them to the interactive builder too. Pure
Python, no OpenCV or MediaPipe, so it is tested on its own. (The web app now tracks the body in
the browser itself; this is for running the Python app directly.)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable

# Arc's catalog: how each movement is measured, its rep thresholds and its goal, written from
# dependencies/src/engine/exercises.ts (`npm run catalog -w dependencies`), so the browser and
# this app count from one set of numbers.
ARC_CATALOG: dict[str, dict] = json.loads(Path(__file__).with_name("arc_catalog.json").read_text())["exercises"]

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


def arc_thresholds(exercise: str) -> dict:
    """The camera app's rep thresholds for one of Arc's movements, so it counts where the browser does.

    Arc counts a rep when its number for the movement climbs from `exitDeg` to `enterDeg`. This
    app reads the joint's inner angle: a rep is armed past `extend_threshold` and counts below
    `flex_threshold`, or the other way round with `invert_logic`. A "bend" number is 180 minus
    the angle, so its thresholds flip; an "inner" one (and the ab twist's shoulder tilt) is the
    angle itself, counted the inverted way.
    """
    arc = ARC_CATALOG[exercise]
    if arc["metric"] == "bend":
        return {"flex_threshold": 180.0 - arc["enterDeg"], "extend_threshold": 180.0 - arc["exitDeg"], "invert_logic": False}
    return {"flex_threshold": float(arc["exitDeg"]), "extend_threshold": float(arc["enterDeg"]), "invert_logic": True}

# Seated knee extension is not in the camera app's catalog; defined here the same way. As in the
# catalog, the camera image is mirrored, so the user's right side uses MediaPipe's LEFT landmarks.
KNEE_EXTENSION = {
    "name": "Seated Knee Extension",
    "type": "arm_dual",
    "right_indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
    "left_indices": (RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE),
    # A rep counts when the knee straightens past Arc's enter angle, from the shin hanging.
    **arc_thresholds("seated_knee_extension"),
    "max_allowed_extension": 185.0,
}

EXERCISES = (*CATALOG_IDS, "seated_knee_extension")
SIDES = ("right", "left")
# The same limits as Arc's plan schema (dependencies/src/api.ts, PlanInputSchema).
LIMITS = {"sets": (1, 10), "reps": (1, 50), "restSeconds": (10, 600)}
# The weight held, in kilograms, as Arc's session schema allows (CreateSessionSchema.loadKg).
LOAD_KG = (0, 500)


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
    if plan.get("loadKg") is not None:
        load = plan["loadKg"]
        if not isinstance(load, (int, float)) or isinstance(load, bool) or not LOAD_KG[0] <= load <= LOAD_KG[1]:
            raise PlanError(f"loadKg must be a number of kilograms from {LOAD_KG[0]} to {LOAD_KG[1]}")
        clean["loadKg"] = load
    return clean


def routine_spec(plan: dict) -> dict:
    """Which catalog exercise (or definition), which side, how many sets and reps."""
    plan = validate_plan(plan)
    spec: dict = {"exercise": plan["exercise"], "side": plan["side"], "sets": plan["sets"], "reps": plan["reps"]}
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
    # The catalog's landmarks and names, Arc's thresholds.
    data = {**data, **arc_thresholds(spec["exercise"])}
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


def align_catalog(lookup: Callable[[str], dict | None]) -> None:
    """Give the camera app's catalog Arc's thresholds in place, so a routine built interactively
    (no plan) counts like the browser too. `lookup` is ExerciseTracker.get_exercise_by_id."""
    for exercise, catalog_id in CATALOG_IDS.items():
        data = lookup(catalog_id)
        if data is not None:
            data.update(arc_thresholds(exercise))


def plan_arguments(plan: dict) -> list[str]:
    """Command-line arguments for main.py, from a validated plan (enums and whole numbers only)."""
    plan = validate_plan(plan)
    args = ["--exercise", plan["exercise"], "--side", plan["side"], "--sets", str(plan["sets"]), "--reps", str(plan["reps"]), "--rest", str(plan["restSeconds"])]
    return args + (["--weight", str(plan["loadKg"])] if "loadKg" in plan else [])


def plan_from_arguments(argv: list[str]) -> dict | None:
    """The plan main.py was started with, or None to build the routine interactively."""
    parser = argparse.ArgumentParser(description="Arc camera app")
    parser.add_argument("--exercise", choices=EXERCISES)
    parser.add_argument("--side", choices=SIDES, default="right")
    parser.add_argument("--sets", type=int, default=3)
    parser.add_argument("--reps", type=int, default=8)
    parser.add_argument("--rest", type=int, default=45)
    parser.add_argument("--weight", type=float, help="the weight held, in kilograms (0 for bodyweight); saved with the session")
    parser.add_argument("--profile", help="Arc profile id: send the finished session to Arc (see arc_upload.py)")
    args = parser.parse_args(argv)
    if args.exercise is None:
        return None
    plan = {"exercise": args.exercise, "side": args.side, "sets": args.sets, "reps": args.reps, "restSeconds": args.rest}
    if args.weight is not None:
        plan["loadKg"] = args.weight
    return validate_plan(plan)
