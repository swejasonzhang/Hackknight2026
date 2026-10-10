"""Deterministic stats computed from raw rep data, used to ground Gemini's reasoning.

Expected session shape (a stand-in for the backend's SessionDto until this is wired
to real data - see ai-coach/README.md):
{
    "sets": [
        {
            "set_number": int,
            "reps": [{"rep_number": int, "peak_rom_degrees": float, "tempo_seconds": float}, ...],
        },
        ...
    ],
}
"""

from ai_coach.models import FatigueSetSummary


def _pct_change(first: float, last: float) -> float:
    if first == 0:
        return 0.0
    return (first - last) / first * 100


def compute_set_fatigue(set_doc: dict) -> FatigueSetSummary:
    reps = set_doc["reps"]
    rom_values = [r["peak_rom_degrees"] for r in reps]
    tempo_values = [r["tempo_seconds"] for r in reps]

    rom_decline_pct = _pct_change(rom_values[0], rom_values[-1])
    tempo_slowdown_pct = -_pct_change(tempo_values[0], tempo_values[-1])

    # Weighted blend: ROM decline matters more than tempo slowdown. Clip to [0, 100].
    fatigue_score = max(0.0, min(100.0, rom_decline_pct * 0.6 + tempo_slowdown_pct * 0.4))

    return FatigueSetSummary(
        set_number=set_doc["set_number"],
        rep_count=len(reps),
        first_rom_degrees=rom_values[0],
        last_rom_degrees=rom_values[-1],
        rom_decline_pct=round(rom_decline_pct, 1),
        first_tempo_seconds=tempo_values[0],
        last_tempo_seconds=tempo_values[-1],
        tempo_slowdown_pct=round(tempo_slowdown_pct, 1),
        fatigue_score=round(fatigue_score, 1),
    )


def compute_session_fatigue(session_doc: dict) -> list[FatigueSetSummary]:
    return [compute_set_fatigue(s) for s in session_doc["sets"]]
