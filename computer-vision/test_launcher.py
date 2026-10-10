"""Tests for the camera launcher: python3 -m unittest test_launcher (run from computer-vision/)."""

import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import launcher

ALLOWED = "https://getarc.health"
PLAN = {"exercise": "elbow_flexion", "side": "right", "sets": 3, "reps": 8, "restSeconds": 45}


def request(url, method="GET", headers=None, body=None):
    data = json.dumps(body).encode() if body is not None else (b"" if method == "POST" else None)
    headers = {**(headers or {}), **({"Content-Type": "application/json"} if body is not None else {})}
    req = urllib.request.Request(url, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, dict(res.headers), res.read()
    except urllib.error.HTTPError as err:
        return err.code, dict(err.headers), err.read()


class LauncherServerTest(unittest.TestCase):
    def setUp(self):
        self.opened = []
        self.server = launcher.make_server(port=0, opener=self.opened.append, cooldown=60)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_listens_on_this_computer_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_status_answers_arc_pages(self):
        status, headers, body = request(f"{self.base}/status", headers={"Origin": ALLOWED})
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ALLOWED)
        self.assertEqual(json.loads(body)["app"], "arc-camera-launcher")

    def test_preflight_allows_arc_pages_to_reach_this_computer(self):
        status, headers, _ = request(
            f"{self.base}/open",
            method="OPTIONS",
            headers={"Origin": ALLOWED, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-arc-launcher", "Access-Control-Request-Private-Network": "true"},
        )
        self.assertEqual(status, 204)
        self.assertEqual(headers.get("Access-Control-Allow-Private-Network"), "true")
        self.assertIn("X-Arc-Launcher", headers.get("Access-Control-Allow-Headers", ""))

    def test_opens_the_camera_app_straight_into_the_plan_for_an_arc_page(self):
        status, _, body = request(f"{self.base}/open", method="POST", headers={"Origin": ALLOWED, "X-Arc-Launcher": "1"}, body=PLAN)
        self.assertEqual(status, 202)
        self.assertEqual(json.loads(body)["opened"], True)
        self.assertEqual(self.opened, [PLAN])

    def test_refuses_a_plan_arc_could_not_have_sent(self):
        for body in ({**PLAN, "exercise": "anything"}, {**PLAN, "reps": "8; open -a Calculator"}, None):
            status, _, _ = request(f"{self.base}/open", method="POST", headers={"Origin": ALLOWED, "X-Arc-Launcher": "1"}, body=body)
            self.assertEqual(status, 400, body)
        self.assertEqual(self.opened, [])

    def test_refuses_other_sites_and_requests_without_the_header(self):
        for headers in ({"Origin": "https://evil.example", "X-Arc-Launcher": "1"}, {"Origin": ALLOWED}, {"X-Arc-Launcher": "1"}):
            status, _, _ = request(f"{self.base}/open", method="POST", headers=headers, body=PLAN)
            self.assertEqual(status, 403, headers)
        status, _, _ = request(f"{self.base}/open", method="OPTIONS", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)
        self.assertEqual(self.opened, [])

    def test_does_not_open_twice_in_a_row(self):
        headers = {"Origin": ALLOWED, "X-Arc-Launcher": "1"}
        self.assertEqual(request(f"{self.base}/open", method="POST", headers=headers, body=PLAN)[0], 202)
        self.assertEqual(request(f"{self.base}/open", method="POST", headers=headers, body=PLAN)[0], 429)
        self.assertEqual(self.opened, [PLAN])


class CommandTest(unittest.TestCase):
    def test_prefers_uv_then_the_project_venv_then_python3(self):
        here = Path("/tmp/arc-camera")
        self.assertEqual(launcher.camera_command(here, which=lambda name: "/usr/bin/uv" if name == "uv" else None, exists=lambda p: False), ["uv", "run", "main.py"])
        venv_python = here / ".venv" / "bin" / "python"
        self.assertEqual(launcher.camera_command(here, which=lambda name: None, exists=lambda p: p == venv_python), [str(venv_python), "main.py"])
        self.assertEqual(launcher.camera_command(here, which=lambda name: None, exists=lambda p: False), ["python3", "main.py"])


    def test_starts_the_camera_app_with_the_plan_and_no_prompts(self):
        here = Path("/tmp/arc-camera")
        command = launcher.launch_command(PLAN, here, which=lambda name: "/usr/bin/uv" if name == "uv" else None, exists=lambda p: False)
        self.assertEqual(command, ["uv", "run", "main.py", "--exercise", "elbow_flexion", "--side", "right", "--sets", "3", "--reps", "8", "--rest", "45"])


if __name__ == "__main__":
    unittest.main()
