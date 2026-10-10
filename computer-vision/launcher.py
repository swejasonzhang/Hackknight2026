"""Arc camera launcher: lets the dashboard open the camera app on this computer.

Run it once, in a terminal, on the laptop or desktop with the webcam:

    cd computer-vision
    uv run launcher.py        # or: python3 launcher.py

It listens on http://127.0.0.1:8765, this computer only. The dashboard's "Open the camera app"
button asks it to start the camera app in a new terminal window; the camera app then asks for the
routine there and opens the webcam window. Only standard-library Python, no extra dependencies.

What it accepts, and from whom:
  GET  /status   is the launcher running (any Arc page, or curl)
  POST /open     open the camera app; only from an Arc page (checked by the Origin header) that
                 also sends "X-Arc-Launcher: 1", which forces the browser's CORS preflight, so no
                 other website can trigger it. It runs one fixed command and nothing it is sent,
                 and at most once every few seconds.
Add more allowed origins with ARC_LAUNCHER_ORIGINS (comma separated); change the port with
ARC_LAUNCHER_PORT (the web app reads VITE_CAMERA_LAUNCHER_URL to match).
"""

from __future__ import annotations

import json
import os
import platform
import shlex
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent
DEFAULT_PORT = 8765
ALLOWED_ORIGINS = {
    "https://getarc.health",
    "https://www.getarc.health",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *[o.strip() for o in os.environ.get("ARC_LAUNCHER_ORIGINS", "").split(",") if o.strip()],
}
HEADER = "X-Arc-Launcher"


def camera_command(here: Path = HERE, which: Callable[[str], str | None] = shutil.which, exists: Callable[[Path], bool] = Path.exists) -> list[str]:
    """How to start the camera app: uv if installed, else the project's virtualenv, else python3."""
    if which("uv"):
        return ["uv", "run", "main.py"]
    for venv_python in (here / ".venv" / "bin" / "python", here / ".venv" / "Scripts" / "python.exe"):
        if exists(venv_python):
            return [str(venv_python), "main.py"]
    return ["python" if platform.system() == "Windows" else "python3", "main.py"]


def open_camera_app(here: Path = HERE) -> None:
    """Start the camera app in a new terminal window, where it can ask for the routine."""
    command = camera_command(here)
    system = platform.system()
    if system == "Darwin":
        line = f"cd {shlex.quote(str(here))} && {shlex.join(command)}"
        script = line.replace("\\", "\\\\").replace('"', '\\"')
        subprocess.Popen(["osascript", "-e", f'tell application "Terminal" to do script "{script}"', "-e", 'tell application "Terminal" to activate'])
        return
    if system == "Windows":
        line = f'cd /d "{here}" && ' + subprocess.list2cmdline(command)
        subprocess.Popen(["cmd", "/c", "start", "Arc camera", "cmd", "/k", line])
        return
    line = f"cd {shlex.quote(str(here))} && {shlex.join(command)}; exec bash"
    for terminal in (["x-terminal-emulator", "-e"], ["gnome-terminal", "--"], ["konsole", "-e"], ["xterm", "-e"]):
        if shutil.which(terminal[0]):
            subprocess.Popen([*terminal, "bash", "-lc", line])
            return
    raise RuntimeError("No terminal emulator found to open the camera app in.")


def make_server(port: int = DEFAULT_PORT, opener: Callable[[], None] = open_camera_app, cooldown: float = 5.0, origins: set[str] = ALLOWED_ORIGINS) -> ThreadingHTTPServer:
    """The launcher's HTTP server, bound to 127.0.0.1 (port 0 picks a free one, for tests)."""
    lock = threading.Lock()
    last_open = [float("-inf")]

    class Handler(BaseHTTPRequestHandler):
        server_version = "ArcCameraLauncher/1"

        def _origin(self) -> str | None:
            return self.headers.get("Origin")

        def _send(self, status: int, body: dict | None = None, extra: dict[str, str] | None = None) -> None:
            data = json.dumps(body).encode() if body is not None else b""
            self.send_response(status)
            origin = self._origin()
            if origin in origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            if body is not None:
                self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if data:
                self.wfile.write(data)

        def do_OPTIONS(self) -> None:  # noqa: N802 (http.server naming)
            if self._origin() not in origins:
                self._send(403, {"error": "origin not allowed"})
                return
            self._send(
                204,
                None,
                {
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": f"{HEADER}, Content-Type",
                    "Access-Control-Allow-Private-Network": "true",
                    "Access-Control-Max-Age": "600",
                },
            )

        def do_GET(self) -> None:  # noqa: N802
            if self.path != "/status":
                self._send(404, {"error": "not found"})
                return
            origin = self._origin()
            if origin is not None and origin not in origins:
                self._send(403, {"error": "origin not allowed"})
                return
            self._send(200, {"ok": True, "app": "arc-camera-launcher", "version": 1})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/open":
                self._send(404, {"error": "not found"})
                return
            if self._origin() not in origins or self.headers.get(HEADER) != "1":
                self._send(403, {"error": "only Arc's pages can open the camera app"})
                return
            with lock:
                now = time.monotonic()
                if now - last_open[0] < cooldown:
                    self._send(429, {"error": "the camera app is already opening"})
                    return
                last_open[0] = now
            try:
                opener()
            except Exception as err:  # report it to the page rather than crash the launcher
                self._send(500, {"error": str(err)})
                return
            print(f"Opened the camera app (asked by {self._origin()}).", flush=True)
            self._send(202, {"opened": True})

        def log_message(self, format: str, *args: object) -> None:  # keep the terminal quiet
            return

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main() -> None:
    port = int(os.environ.get("ARC_LAUNCHER_PORT", DEFAULT_PORT))
    server = make_server(port=port)
    print(f"Arc camera launcher on http://127.0.0.1:{port}. Leave this window open, then press")
    print('"Open the camera app" on the dashboard. Ctrl+C stops the launcher.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nLauncher stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
