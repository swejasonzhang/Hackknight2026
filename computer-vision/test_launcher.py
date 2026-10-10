"""Tests for the camera launcher: python3 -m unittest test_launcher (run from computer-vision/)."""

import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import launcher

ALLOWED = "https://getarc.health"


def request(url, method="GET", headers=None):
    req = urllib.request.Request(url, method=method, headers=headers or {}, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, dict(res.headers), res.read()
    except urllib.error.HTTPError as err:
        return err.code, dict(err.headers), err.read()


class LauncherServerTest(unittest.TestCase):
    def setUp(self):
        self.opened = []
        self.server = launcher.make_server(port=0, opener=lambda: self.opened.append(True), cooldown=60)
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

    def test_opens_the_camera_app_for_an_arc_page(self):
        status, _, body = request(f"{self.base}/open", method="POST", headers={"Origin": ALLOWED, "X-Arc-Launcher": "1"})
        self.assertEqual(status, 202)
        self.assertEqual(json.loads(body)["opened"], True)
        self.assertEqual(self.opened, [True])

    def test_refuses_other_sites_and_requests_without_the_header(self):
        for headers in ({"Origin": "https://evil.example", "X-Arc-Launcher": "1"}, {"Origin": ALLOWED}, {"X-Arc-Launcher": "1"}):
            status, _, _ = request(f"{self.base}/open", method="POST", headers=headers)
            self.assertEqual(status, 403, headers)
        status, _, _ = request(f"{self.base}/open", method="OPTIONS", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)
        self.assertEqual(self.opened, [])

    def test_does_not_open_twice_in_a_row(self):
        headers = {"Origin": ALLOWED, "X-Arc-Launcher": "1"}
        self.assertEqual(request(f"{self.base}/open", method="POST", headers=headers)[0], 202)
        self.assertEqual(request(f"{self.base}/open", method="POST", headers=headers)[0], 429)
        self.assertEqual(self.opened, [True])


class CommandTest(unittest.TestCase):
    def test_prefers_uv_then_the_project_venv_then_python3(self):
        here = Path("/tmp/arc-camera")
        self.assertEqual(launcher.camera_command(here, which=lambda name: "/usr/bin/uv" if name == "uv" else None, exists=lambda p: False), ["uv", "run", "main.py"])
        venv_python = here / ".venv" / "bin" / "python"
        self.assertEqual(launcher.camera_command(here, which=lambda name: None, exists=lambda p: p == venv_python), [str(venv_python), "main.py"])
        self.assertEqual(launcher.camera_command(here, which=lambda name: None, exists=lambda p: False), ["python3", "main.py"])


if __name__ == "__main__":
    unittest.main()
