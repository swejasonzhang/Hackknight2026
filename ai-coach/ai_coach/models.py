from enum import Enum

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


class TrainingGoal(str, Enum):
    STRENGTH = "strength"
    HYPERTROPHY = "hypertrophy"
    ENDURANCE = "endurance"


class ActivityLevel(str, Enum):
    MODERATE = "moderate"  # daily exercise, or intense exercise 3-4x/week
    INTENSE = "intense"  # intense exercise 6-7x/week
    VERY_INTENSE = "very_intense"  # very intense exercise or a highly physical job


class SurveyAnswers(BaseModel):
    usage_frequency: str  # free text, e.g. "3 times a week"
    purpose: str  # free text, e.g. "rehab after knee surgery"
    goal: TrainingGoal
    height_cm: float
    weight_kg: float
    activity_level: ActivityLevel


class TrainingPlan(BaseModel):
    goal: TrainingGoal
    sets_min: int
    sets_max: int
    reps_min: int
    reps_max: int
    rest_seconds_min: int
    rest_seconds_max: int
    weight_guidance: str
