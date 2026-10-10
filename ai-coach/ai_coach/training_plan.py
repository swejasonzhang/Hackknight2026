"""Maps a training goal to concrete sets/reps/rest ranges. Deterministic on purpose -
these numbers come from the product spec, not from the model, so they're exact every time."""

from ai_coach.models import TrainingGoal, TrainingPlan

_PLANS: dict[TrainingGoal, TrainingPlan] = {
    TrainingGoal.STRENGTH: TrainingPlan(
        goal=TrainingGoal.STRENGTH,
        sets_min=2,
        sets_max=4,
        reps_min=2,
        reps_max=6,
        rest_seconds_min=120,
        rest_seconds_max=300,
        weight_guidance=(
            "Go heavy. Strength work is low reps with real load - if you're hitting "
            "the top of the rep range with room to spare, go up in weight next time."
        ),
    ),
    TrainingGoal.HYPERTROPHY: TrainingPlan(
        goal=TrainingGoal.HYPERTROPHY,
        sets_min=3,
        sets_max=5,
        reps_min=8,
        reps_max=12,
        rest_seconds_min=60,
        rest_seconds_max=180,
        weight_guidance=(
            "Moderate weight, taken close to muscle fatigue. If every set is easily "
            "clearing 12 reps, go up in weight; if you can't reach 8, go down."
        ),
    ),
    TrainingGoal.ENDURANCE: TrainingPlan(
        goal=TrainingGoal.ENDURANCE,
        sets_min=2,
        sets_max=4,
        reps_min=13,
        reps_max=25,
        rest_seconds_min=30,
        rest_seconds_max=60,
        weight_guidance=(
            "Go light. Endurance is about reps, not load - if you can't hit the top "
            "of the rep range with good form, drop the weight rather than push through."
        ),
    ),
}


def build_training_plan(goal: TrainingGoal) -> TrainingPlan:
    return _PLANS[goal]
