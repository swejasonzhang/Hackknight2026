import sys

from arc_routine import build_routine, plan_from_arguments, routine_spec


def main(argv=None):
    # With a plan (`--exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45`, as the
    # dashboard's launcher sends), start straight into it with no prompts; without one, build the
    # routine interactively as before.
    plan = plan_from_arguments(sys.argv[1:] if argv is None else argv)

    from movements import ExerciseTracker, RoutineExercise

    if plan is None:
        app = ExerciseTracker()
    else:
        routine = build_routine(routine_spec(plan), ExerciseTracker.get_exercise_by_id, RoutineExercise)
        app = ExerciseTracker(routine=routine, default_rest_duration=float(plan["restSeconds"]))
    app.run()


if __name__ == "__main__":
    main()
