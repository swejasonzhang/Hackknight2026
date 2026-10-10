"""Tests for sending a camera-app session to Arc: python3 -m unittest test_arc_upload."""

import json
import re
import unittest
from pathlib import Path

import arc_upload
from arc_routine import EXERCISES
from arc_upload import UploadError, post_session, session_from_export, upload_target

PLAN = {"exercise": "elbow_flexion", "side": "right", "sets": 2, "reps": 3, "restSeconds": 45}
STARTED = 1_760_000_000.0  # seconds, as time.time() gives


def rep(set_number, number, min_angle, max_angle, duration=2.0, rest=2.5):
    return {"set": set_number, "rep": number, "min_angle": min_angle, "max_angle": max_angle, "duration": duration, "rest_time": rest, "score": "GOOD"}


def export(reps, name="Bicep Curls (Right)"):
    return {"timestamp": STARTED + 120, "exercises": [{"exercise_name": name, "target_sets": 2, "target_reps": 3, "overall_min_angle": 30, "overall_max_angle": 170, "reps": reps}]}


def exercise_blocks():
    """Each Arc exercise's settings, read from dependencies/src/engine/exercises.ts."""
    source = (Path(__file__).parent.parent / "dependencies/src/engine/exercises.ts").read_text()
    blocks = {}
    for match in re.finditer(r"\n  (\w+): \{\n    id: '(\w+)'([\s\S]*?)\n  \},", source):
        body = match.group(3)
        blocks[match.group(2)] = {
            "metric": re.search(r"metricFromInnerAngle: (\w+)", body).group(1),
            "targetDeg": float(re.search(r"targetDeg: ([\d.]+)", body).group(1)),
        }
    return blocks


class SessionFromExportTest(unittest.TestCase):
    def test_a_curl_becomes_arcs_session_with_sets_reps_and_whole_millisecond_times(self):
        reps = [rep(1, 1, 40, 170), rep(1, 2, 45, 170), rep(1, 3, 50, 168), rep(2, 1, 42, 170), rep(2, 2, 48, 169)]
        session = session_from_export(export(reps), PLAN, "p1", STARTED)
        self.assertEqual(session["profileId"], "p1")
        self.assertEqual((session["exercise"], session["side"]), ("elbow_flexion", "right"))
        self.assertEqual(session["plan"], {"sets": 2, "reps": 3, "restSeconds": 45, "targetDeg": 140})
        self.assertTrue(session["complete"])
        self.assertEqual([s["setNumber"] for s in session["sets"]], [1, 2])
        # A curl counts flexion: 180 minus the smallest elbow angle of the rep.
        self.assertEqual([r["peakDeg"] for r in session["sets"][0]["reps"]], [140, 135, 130])
        self.assertEqual([r["index"] for r in session["sets"][1]["reps"]], [1, 2])
        # The second set came up one rep short of the plan.
        self.assertEqual([s["endedEarly"] for s in session["sets"]], [False, True])
        times = [t for s in session["sets"] for r in s["reps"] for t in (r["startedAt"], r["endedAt"])]
        self.assertTrue(all(isinstance(t, int) for t in times))
        self.assertEqual(times, sorted(times))
        self.assertEqual(session["sets"][0]["reps"][0]["durationMs"], 2000)
        # The plan's rest sits between the sets.
        gap = session["sets"][1]["reps"][0]["startedAt"] - session["sets"][0]["reps"][-1]["endedAt"]
        self.assertGreaterEqual(gap, 45_000)
        self.assertGreaterEqual(session["endedAt"], times[-1])
        self.assertEqual(session["startedAt"], int(STARTED * 1000))

    def test_a_straightening_movement_counts_its_largest_angle(self):
        knee = {**PLAN, "exercise": "seated_knee_extension"}
        session = session_from_export(export([rep(1, 1, 95, 172)], "Seated Knee Extension (Right)"), knee, "p1", STARTED)
        self.assertEqual(session["sets"][0]["reps"][0]["peakDeg"], 172)
        self.assertEqual(session["plan"]["targetDeg"], 175)

    def test_nothing_to_send_without_a_rep(self):
        self.assertIsNone(session_from_export(export([]), PLAN, "p1", STARTED))
        self.assertIsNone(session_from_export({"timestamp": STARTED, "exercises": []}, PLAN, "p1", STARTED))

    def test_every_exercise_measures_and_aims_as_arc_defines_it(self):
        blocks = exercise_blocks()
        self.assertEqual(set(blocks), set(EXERCISES))
        for exercise, block in blocks.items():
            self.assertEqual(arc_upload.METRIC[exercise], block["metric"], exercise)
            self.assertEqual(arc_upload.TARGET_DEG[exercise], block["targetDeg"], exercise)


class PostSessionTest(unittest.TestCase):
    def test_posts_json_to_the_sessions_route_with_the_key_in_a_header_never_the_url(self):
        sent = {}

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps({"id": "s1"}).encode()

        def opener(request, timeout):
            sent["url"] = request.full_url
            sent["method"] = request.get_method()
            sent["headers"] = {k.lower(): v for k, v in request.header_items()}
            sent["body"] = json.loads(request.data)
            return Response()

        result = post_session({"profileId": "p1"}, "https://api.getarc.health", "secret-key", opener=opener)
        self.assertEqual(result["id"], "s1")
        self.assertEqual(sent["url"], "https://api.getarc.health/api/sessions")
        self.assertEqual(sent["method"], "POST")
        self.assertEqual(sent["headers"]["x-api-key"], "secret-key")
        self.assertEqual(sent["headers"]["content-type"], "application/json")
        self.assertNotIn("secret-key", sent["url"])
        self.assertEqual(sent["body"], {"profileId": "p1"})

    def test_never_sends_the_key_over_plain_http_except_to_this_computer(self):
        with self.assertRaises(UploadError):
            post_session({}, "http://api.getarc.health", "secret-key", opener=lambda *a, **k: None)
        for local in ("http://localhost:8787", "http://127.0.0.1:8787"):
            self.assertTrue(arc_upload.safe_url(local), local)


class UploadTargetTest(unittest.TestCase):
    def test_needs_a_profile_and_the_camera_app_key(self):
        env = {"CV_API_KEY": "k"}
        self.assertEqual(upload_target(["--exercise", "squat", "--profile", "p1"], env), {"profileId": "p1", "apiUrl": "https://api.getarc.health", "apiKey": "k"})
        self.assertEqual(upload_target(["--profile", "p1"], {**env, "ARC_API_URL": "http://localhost:8787"})["apiUrl"], "http://localhost:8787")
        self.assertIsNone(upload_target(["--exercise", "squat"], env))
        self.assertIsNone(upload_target(["--profile", "p1"], {}))


if __name__ == "__main__":
    unittest.main()
