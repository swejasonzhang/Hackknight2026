"""Tests for turning Arc's plan into the camera app's routine: python3 -m unittest test_arc_routine."""

import unittest

import arc_routine
from arc_routine import PlanError, build_routine, routine_spec, validate_plan

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


class BuildRoutineTest(unittest.TestCase):
    CATALOG = {
        "1": {"name": "Bicep Curls", "type": "arm_dual", "right_indices": (11, 13, 15), "left_indices": (12, 14, 16), "flex_threshold": 40.0, "extend_threshold": 150.0, "invert_logic": False, "max_allowed_extension": 175.0},
    }

    def build(self, plan):
        return build_routine(routine_spec(plan), self.CATALOG.get, lambda **kwargs: kwargs)

    def test_builds_one_exercise_from_the_catalog_with_the_plans_sets_and_reps(self):
        [exercise] = self.build(PLAN)
        self.assertEqual(exercise["name"], "Bicep Curls (Right)")
        self.assertEqual(exercise["primary_joint_indices"], (11, 13, 15))
        self.assertEqual((exercise["target_sets"], exercise["target_reps"]), (3, 8))
        self.assertEqual(exercise["flex_threshold"], 40.0)

    def test_builds_the_knee_extension_without_the_catalog(self):
        [exercise] = self.build({**PLAN, "exercise": "seated_knee_extension", "side": "left"})
        self.assertEqual(exercise["name"], "Seated Knee Extension (Left)")
        self.assertEqual(exercise["primary_joint_indices"], (24, 26, 28))


class CommandLineTest(unittest.TestCase):
    def test_plan_arguments_round_trip(self):
        args = arc_routine.plan_arguments(PLAN)
        self.assertEqual(args, ["--exercise", "elbow_flexion", "--side", "right", "--sets", "3", "--reps", "8", "--rest", "45"])
        self.assertEqual(arc_routine.plan_from_arguments(args), PLAN)

    def test_no_arguments_means_the_interactive_builder(self):
        self.assertIsNone(arc_routine.plan_from_arguments([]))


if __name__ == "__main__":
    unittest.main()
