"""Tests for turning Arc's plan into the camera app's routine: python3 -m unittest test_arc_routine."""

import ast
import math
import re
import unittest
from pathlib import Path

import arc_routine
from arc_routine import ARC_CATALOG, PlanError, align_catalog, arc_thresholds, build_routine, routine_spec, validate_plan

PLAN = {"exercise": "elbow_flexion", "side": "right", "sets": 3, "reps": 8, "restSeconds": 45}


class ValidatePlanTest(unittest.TestCase):
    def test_accepts_an_arc_plan(self):
        self.assertEqual(validate_plan(PLAN), PLAN)

    def test_refuses_anything_outside_the_plan_schema(self):
        bad = [
            {**PLAN, "exercise": "squat; rm -rf /"},
            {**PLAN, "side": "both"},
            {**PLAN, "sets": 0},
            {**PLAN, "reps": 51},
            {**PLAN, "restSeconds": 5},
            {**PLAN, "sets": "3"},
            {**PLAN, "reps": True},
            {k: v for k, v in PLAN.items() if k != "side"},
            "not a plan",
        ]
        for plan in bad:
            with self.assertRaises(PlanError, msg=plan):
                validate_plan(plan)


class RoutineSpecTest(unittest.TestCase):
    def test_elbow_flexion_is_the_camera_apps_bicep_curl_on_the_chosen_side(self):
        spec = routine_spec(PLAN)
        self.assertEqual(spec["catalog_id"], "1")
        self.assertEqual(spec["side"], "right")
        self.assertEqual((spec["sets"], spec["reps"]), (3, 8))

    def test_shoulder_abduction_is_the_lateral_raise(self):
        spec = routine_spec({**PLAN, "exercise": "shoulder_abduction", "side": "left"})
        self.assertEqual(spec["catalog_id"], "4")
        self.assertEqual(spec["side"], "left")

    def test_seated_knee_extension_tracks_hip_knee_and_ankle_mirrored_like_the_catalog(self):
        spec = routine_spec({**PLAN, "exercise": "seated_knee_extension"})
        definition = spec["definition"]
        # The camera image is mirrored: the user's right leg is MediaPipe's LEFT hip, knee and ankle.
        self.assertEqual(definition["right_indices"], (23, 25, 27))
        self.assertEqual(definition["left_indices"], (24, 26, 28))
        self.assertTrue(definition["invert_logic"])  # a rep counts when the knee straightens
        self.assertLess(definition["flex_threshold"], definition["extend_threshold"])


def movements_function(name: str):
    """One of movements.py's own functions, compiled on its own (the module imports OpenCV)."""
    tree = ast.parse((Path(__file__).parent / "movements.py").read_text())
    node = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == name)
    node.decorator_list = []
    scope: dict = {"math": math}
    exec(compile(ast.Module(body=[node], type_ignores=[]), "movements.py", "exec"), scope)
    return scope[name]


def camera_reps(angles, flex_threshold, extend_threshold, invert_logic, **_):
    """Reps as movements.py's process_reps counts them: armed past one threshold, counted at the other."""
    armed, reps = False, 0
    for angle in angles:
        if (angle < flex_threshold) if invert_logic else (angle > extend_threshold):
            armed = True
        if armed and ((angle > extend_threshold) if invert_logic else (angle < flex_threshold)):
            armed, reps = False, reps + 1
    return reps


def camera_angles(exercise, metrics):
    """The angles the camera app reads for a run of Arc's numbers for the movement."""
    return [180 - m if ARC_CATALOG[exercise]["metric"] == "bend" else m for m in metrics]


def catalog_names() -> dict[str, str]:
    """The camera app's catalog ids and names, read from movements.py's source (it imports OpenCV)."""
    source = (Path(__file__).parent / "movements.py").read_text()
    return dict(re.findall(r'"(\d+)": \{\s*"name": "([^"]+)"', source))


class CatalogTest(unittest.TestCase):
    def test_every_arc_exercise_maps_onto_the_camera_app(self):
        names = catalog_names()
        self.assertEqual(len(arc_routine.EXERCISES), 15)
        mapped = [arc_routine.CATALOG_IDS[e] for e in arc_routine.EXERCISES if e in arc_routine.CATALOG_IDS]
        # All fourteen catalog movements, each once; the knee extension is defined alongside.
        self.assertEqual(sorted(mapped, key=int), sorted(names, key=int))
        self.assertEqual(set(arc_routine.EXERCISES) - set(arc_routine.CATALOG_IDS), {"seated_knee_extension"})

    def test_the_names_match_the_catalog(self):
        names = catalog_names()
        expected = {
            "elbow_flexion": "Bicep Curls",
            "tricep_extension": "Tricep Extension (Down)",
            "shoulder_press": "Shoulder Press",
            "shoulder_abduction": "Lateral Raise",
            "front_raise": "Front Raise",
            "chest_press": "Chest Press",
            "pec_fly": "Pec Fly",
            "lat_pulldown": "Lat Pulldown",
            "bent_over_row": "Bent-Over Rows",
            "deadlift": "Deadlift",
            "squat": "Squats",
            "lunge": "Lunges",
            "ab_twist": "Ab Twist",
            "crunch": "Crunches",
        }
        for exercise, name in expected.items():
            self.assertEqual(names[arc_routine.CATALOG_IDS[exercise]], name, exercise)


class BuildRoutineTest(unittest.TestCase):
    CATALOG = {
        "1": {"name": "Bicep Curls", "type": "arm_dual", "right_indices": (11, 13, 15), "left_indices": (12, 14, 16), "flex_threshold": 40.0, "extend_threshold": 150.0, "invert_logic": False, "max_allowed_extension": 175.0},
    }

    CATALOG["11"] = {"name": "Squats", "type": "standard", "indices": (23, 25, 27), "flex_threshold": 90.0, "extend_threshold": 160.0, "invert_logic": False, "max_allowed_extension": 180.0}

    def build(self, plan):
        return build_routine(routine_spec(plan), self.CATALOG.get, lambda **kwargs: kwargs)

    CATALOG["5"] = {"name": "Front Raise", "type": "arm_dual", "right_indices": (23, 11, 13), "left_indices": (24, 12, 14), "flex_threshold": 25.0, "extend_threshold": 135.0, "invert_logic": True, "max_allowed_extension": 160.0}

    def test_builds_one_exercise_from_the_catalog_with_the_plans_sets_and_reps(self):
        [exercise] = self.build(PLAN)
        self.assertEqual(exercise["name"], "Bicep Curls (Right)")
        self.assertEqual(exercise["primary_joint_indices"], (11, 13, 15))
        self.assertEqual((exercise["target_sets"], exercise["target_reps"]), (3, 8))
        # Arc's thresholds, not the catalog's 40/150: armed with the elbow open past 140 degrees
        # (40 of bend), counted once it closes under 90 (90 of bend).
        self.assertEqual((exercise["flex_threshold"], exercise["extend_threshold"], exercise["invert_logic"]), (90.0, 140.0, False))

    def test_a_front_raise_counts_at_arcs_angles_not_135(self):
        [exercise] = self.build({**PLAN, "exercise": "front_raise"})
        self.assertEqual((exercise["flex_threshold"], exercise["extend_threshold"], exercise["invert_logic"]), (30.0, 80.0, True))
        # The catalog's own form limit stays.
        self.assertEqual(exercise["max_allowed_extension"], 160.0)

    def test_a_whole_body_movement_uses_the_catalogs_own_landmarks_on_either_side(self):
        for side in ("right", "left"):
            [exercise] = self.build({**PLAN, "exercise": "squat", "side": side})
            self.assertEqual(exercise["name"], "Squats")
            self.assertEqual(exercise["primary_joint_indices"], (23, 25, 27))

    def test_builds_the_knee_extension_without_the_catalog(self):
        [exercise] = self.build({**PLAN, "exercise": "seated_knee_extension", "side": "left"})
        self.assertEqual(exercise["name"], "Seated Knee Extension (Left)")
        self.assertEqual(exercise["primary_joint_indices"], (24, 26, 28))


class ArcThresholdsTest(unittest.TestCase):
    def test_every_arc_movement_is_in_the_catalog_file(self):
        self.assertEqual(set(ARC_CATALOG), set(arc_routine.EXERCISES))

    def test_every_movement_counts_a_rep_exactly_where_the_browser_does(self):
        for exercise, arc in ARC_CATALOG.items():
            thresholds = arc_thresholds(exercise)
            rest, enter = arc["restDeg"], arc["enterDeg"]
            reached = camera_angles(exercise, [rest, enter + 1, rest, enter + 1, rest])
            short = camera_angles(exercise, [rest, enter - 1, rest])
            self.assertEqual(camera_reps(reached, **thresholds), 2, exercise)
            self.assertEqual(camera_reps(short, **thresholds), 0, exercise)

    def test_a_rep_needs_the_return_to_arcs_exit_angle_before_the_next(self):
        for exercise, arc in ARC_CATALOG.items():
            hovering = camera_angles(exercise, [arc["restDeg"], arc["enterDeg"] + 1, arc["exitDeg"] + 1, arc["enterDeg"] + 1])
            self.assertEqual(camera_reps(hovering, **arc_thresholds(exercise)), 1, exercise)

    def test_the_interactive_builder_gets_arcs_thresholds_too(self):
        catalog = {cid: {"name": e, "flex_threshold": 25.0, "extend_threshold": 135.0, "invert_logic": True} for e, cid in arc_routine.CATALOG_IDS.items()}
        align_catalog(catalog.get)
        for exercise, cid in arc_routine.CATALOG_IDS.items():
            self.assertEqual({k: catalog[cid][k] for k in ("flex_threshold", "extend_threshold", "invert_logic")}, arc_thresholds(exercise), exercise)
        self.assertEqual(catalog["5"]["extend_threshold"], 80.0)  # the front raise
        self.assertEqual((catalog["13"]["flex_threshold"], catalog["13"]["extend_threshold"]), (8.0, 22.0))  # the ab twist

    def test_the_knee_extension_counts_at_arcs_angles(self):
        knee = arc_routine.KNEE_EXTENSION
        self.assertEqual((knee["flex_threshold"], knee["extend_threshold"], knee["invert_logic"]), (110.0, 150.0, True))


class TwistAngleTest(unittest.TestCase):
    twist = staticmethod(movements_function("calculate_torso_twist_angle"))

    def test_a_level_shoulder_line_reads_zero_whichever_shoulder_is_on_the_left(self):
        self.assertAlmostEqual(self.twist((100, 200), (300, 200)), 0.0)
        self.assertAlmostEqual(self.twist((300, 200), (100, 200)), 0.0)

    def test_a_tilt_reads_the_same_either_way_as_arcs_shoulder_tilt(self):
        rise = 200 * math.tan(math.radians(20))
        for ls, rs in (((100, 200), (300, 200 - rise)), ((100, 200), (300, 200 + rise)), ((300, 200), (100, 200 - rise)), ((300, 200), (100, 200 + rise))):
            self.assertAlmostEqual(self.twist(ls, rs), 20.0, places=6)


class CommandLineTest(unittest.TestCase):
    def test_plan_arguments_round_trip(self):
        args = arc_routine.plan_arguments(PLAN)
        self.assertEqual(args, ["--exercise", "elbow_flexion", "--side", "right", "--sets", "3", "--reps", "8", "--rest", "45"])
        self.assertEqual(arc_routine.plan_from_arguments(args), PLAN)

    def test_the_weight_held_rides_along_and_must_be_sensible(self):
        weighted = {**PLAN, "loadKg": 12.5}
        args = arc_routine.plan_arguments(weighted)
        self.assertEqual(args[-2:], ["--weight", "12.5"])
        self.assertEqual(arc_routine.plan_from_arguments(args), weighted)
        for bad in (-1, 501, "heavy", True):
            with self.assertRaises(PlanError):
                validate_plan({**PLAN, "loadKg": bad})

    def test_a_profile_to_send_the_session_to_leaves_the_plan_alone(self):
        args = arc_routine.plan_arguments(PLAN) + ["--profile", "p1"]
        self.assertEqual(arc_routine.plan_from_arguments(args), PLAN)

    def test_no_arguments_means_the_interactive_builder(self):
        self.assertIsNone(arc_routine.plan_from_arguments([]))


if __name__ == "__main__":
    unittest.main()
