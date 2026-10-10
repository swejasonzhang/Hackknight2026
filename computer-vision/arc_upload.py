"""Send a finished camera-app session to Arc, so it is stored in MongoDB with the browser's.

`main.py --exercise squat --side right --sets 3 --reps 8 --rest 45 --profile <profile id>`, with
`CV_API_KEY` set (and `ARC_API_URL` to aim somewhere other than https://api.getarc.health), posts
the session to `POST /api/sessions` when the routine ends. `session_from_export` turns the app's
own export (`ExerciseTracker.export_session_data_for_db`) into Arc's session body; the server
recomputes fatigue and the summary from the reps. Standard library only, so it is tested without
OpenCV or a network.
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from typing import Any, Callable
from urllib.parse import urlparse

# How each Arc exercise turns the joint angle into its number (dependencies/src/engine/exercises.ts):
# "bend" movements count 180 minus the smallest angle of the rep, "inner" ones the largest angle.
METRIC = {
    "elbow_flexion": "bend",
    "tricep_extension": "inner",
    "shoulder_press": "inner",
    "shoulder_abduction": "inner",
    "front_raise": "inner",
    "chest_press": "inner",
    "pec_fly": "bend",
    "lat_pulldown": "bend",
    "bent_over_row": "bend",
    "deadlift": "inner",
    "squat": "bend",
    "lunge": "bend",
    "seated_knee_extension": "inner",
    "crunch": "bend",
    "ab_twist": "inner",
}
# Each exercise's default goal angle, as Arc defines it.
TARGET_DEG = {
    "elbow_flexion": 140.0,
    "tricep_extension": 170.0,
    "shoulder_press": 170.0,
    "shoulder_abduction": 90.0,
    "front_raise": 135.0,
    "chest_press": 170.0,
    "pec_fly": 160.0,
    "lat_pulldown": 120.0,
    "bent_over_row": 115.0,
    "deadlift": 175.0,
    "squat": 100.0,
    "lunge": 90.0,
    "seated_knee_extension": 175.0,
    "crunch": 55.0,
    "ab_twist": 30.0,
}
DEFAULT_API_URL = "https://api.getarc.health"
# Zero fatigue in the body; the server always recomputes it from the reps.
NO_FATIGUE = {"index": 0, "romDecay": 0, "tempoDrift": 0, "romDropDeg": 0, "sampleReps": 0}


class UploadError(RuntimeError):
    """The session could not be sent."""


def _ms(seconds: float) -> int:
    return int(round(seconds * 1000))


def session_from_export(export: dict, plan: dict, profile_id: str, started_at: float) -> dict | None:
    """Arc's session body from the camera app's export for a routine started from `plan`, or None without a rep.

    The app logs each rep's set, smallest and largest angle, duration and the time since the rep
    before; rep times are rebuilt from those (in milliseconds since the epoch), with the plan's
    rest between sets.
    """
    exercises = export.get("exercises") or []
    logs = exercises[0].get("reps") if exercises else None
    if not logs:
        return None
    exercise = plan["exercise"]
    bend = METRIC[exercise] == "bend"
    sets: dict[int, list[dict]] = {}
    clock = started_at
    previous_set = None
    for log in logs:
        set_number = int(log["set"])
        duration = max(0.0, float(log.get("duration") or 0))
        gap = max(duration, float(log.get("rest_time") or 0))
        if previous_set is not None and set_number != previous_set:
            gap += plan["restSeconds"]  # the app restarts its rep clock after each rest
        ended = clock + (duration if previous_set is None else gap)
        clock = ended
        previous_set = set_number
        peak = 180 - float(log["min_angle"]) if bend else float(log["max_angle"])
        reps = sets.setdefault(set_number, [])
        reps.append({"index": len(reps) + 1, "peakDeg": round(peak, 1), "startedAt": _ms(ended - duration), "endedAt": _ms(ended), "durationMs": _ms(duration)})
    set_records = [
        {
            "setNumber": number,
            "reps": reps,
            "fatigue": NO_FATIGUE,
            "startedAt": reps[0]["startedAt"],
            "endedAt": reps[-1]["endedAt"],
            "endedEarly": len(reps) < plan["reps"],
        }
        for number, reps in sorted(sets.items())
    ]
    last = set_records[-1]["endedAt"]
    load = {"loadKg": plan["loadKg"]} if plan.get("loadKg") is not None else {}
    return {
        "profileId": profile_id,
        "exercise": exercise,
        "side": plan["side"],
        "startedAt": _ms(started_at),
        "endedAt": max(last, _ms(float(export.get("timestamp") or 0))),
        "plan": {"sets": plan["sets"], "reps": plan["reps"], "restSeconds": plan["restSeconds"], "targetDeg": TARGET_DEG[exercise]},
        "sets": set_records,
        "complete": True,
        **load,
    }


def safe_url(api_url: str) -> bool:
    """HTTPS, or plain HTTP only to this computer: the key never crosses a network in the clear."""
    parsed = urlparse(api_url)
    return parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"))


def post_session(session: dict, api_url: str, api_key: str, opener: Callable[..., Any] = urllib.request.urlopen) -> dict:
    """POST the session to Arc with the camera app's key in the x-api-key header; returns the stored session."""
    if not safe_url(api_url):
        raise UploadError("ARC_API_URL must be https (or http to localhost)")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/sessions",
        data=json.dumps(session).encode(),
        headers={"content-type": "application/json", "x-api-key": api_key},
        method="POST",
    )
    try:
        with opener(request, timeout=20) as response:
            return json.loads(response.read())
    except UploadError:
        raise
    except Exception as err:  # network, HTTP or JSON trouble: say what, never the key
        raise UploadError(f"Arc did not take the session: {err}") from None


def upload_target(argv: list[str], env: dict) -> dict | None:
    """Where to send the session: the profile from --profile, the key from CV_API_KEY; None unless both are there."""
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--profile")
    args, _ = parser.parse_known_args(argv)
    key = env.get("CV_API_KEY")
    if not args.profile or not key:
        return None
    return {"profileId": args.profile, "apiUrl": env.get("ARC_API_URL") or DEFAULT_API_URL, "apiKey": key}
