from pydantic import BaseModel


class FatigueSetSummary(BaseModel):
    """Per-set stats fed to Gemini as grounding. Mirrors the shape of
    @arc/dependencies' FatigueEstimate/SessionSummary in the backend, but is not
    wired to it yet - see ai-coach/README.md."""

    set_number: int
    rep_count: int
    first_rom_degrees: float
    last_rom_degrees: float
    rom_decline_pct: float
    first_tempo_seconds: float
    last_tempo_seconds: float
    tempo_slowdown_pct: float
    fatigue_score: float  # 0-100, higher = more fatigued
