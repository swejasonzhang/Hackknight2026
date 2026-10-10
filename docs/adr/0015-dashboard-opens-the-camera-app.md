# ADR-0015: The dashboard opens the camera app through a local launcher

- Date: 2026-10-10
- Status: superseded by ADR-0017 (the web app tracks the body in the browser; the launcher is removed)

## Context

Jason asked for a dashboard button that opens an instance of the computer vision, with text explaining it. The camera app in `computer-vision/` is a Python desktop program. It asks for the routine at a terminal prompt, then opens an OpenCV window on the webcam. A web page, and getarc.health especially, cannot start a program on the visitor's computer. Rebuilding pose tracking in the browser would duplicate the computer-vision team's app and reverse ADR-0004, which keeps the web app a viewer.

## Decision

- **A launcher on the computer with the webcam.** `computer-vision/launcher.py` is standard-library Python. Run it once and it listens on `127.0.0.1:8765`. `POST /open` opens the camera app in a new terminal window, where its routine prompts work. It uses Terminal on macOS, `cmd` on Windows, and the first terminal emulator found on Linux. It runs one fixed command: `uv run main.py`, else the project's `.venv` Python, else `python3 main.py`.
- **Only Arc's pages can use it.** The `Origin` must be one of Arc's sites, and the request must carry `X-Arc-Launcher: 1`. The custom header forces a CORS preflight, which the launcher answers with `Access-Control-Allow-Private-Network: true` only for those sites, so a request from another website is refused. It ignores anything in the request body and opens at most once every five seconds. It listens on 127.0.0.1 only, so nothing on the network can reach it.
- **The dashboard panel.** "Record a session" sits at the top of the readout column. It shows a lamp with the launcher's state (connected, or not running), a paragraph on what the camera app does, and **Open the camera app**. When the launcher is missing, the panel shows its start command and a **Check again** button, and it checks again whenever the tab regains focus. On a phone it explains that the camera app runs on a laptop or desktop, and shows no button.

## Consequences

- Chrome and Firefox treat `http://127.0.0.1` as a secure context, so an `https://getarc.health` page can reach the launcher. Safari may block the request as mixed content, in which case the panel reports the launcher as not running.
- The camera app still does not send finished sessions to the API (backlog story C4). Until it does, a session recorded this way does not reach the dashboard.
- CI now also runs the launcher's Python tests.
