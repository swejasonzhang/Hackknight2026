import os
import sys
import time

from arc_routine import align_catalog, build_routine, plan_from_arguments, routine_spec
from arc_upload import UploadError, post_session, session_from_export, upload_target


def main(argv=None):
    # With a plan (`--exercise elbow_flexion --side right --sets 3 --reps 8 --rest 45`, Arc's plan
    # fields), start straight into it with no prompts; without one, build the routine interactively.
    args = sys.argv[1:] if argv is None else argv
    plan = plan_from_arguments(args)
    # With `--profile <id>` and CV_API_KEY set, the finished session goes to Arc (MongoDB).
    target = upload_target(args, os.environ) if plan else None

    from movements import ExerciseTracker, RoutineExercise

    # Reps count at Arc's thresholds either way, the same angles as in the browser.
    align_catalog(ExerciseTracker.get_exercise_by_id)

    if plan is None:
        app = ExerciseTracker()
    else:
        routine = build_routine(routine_spec(plan), ExerciseTracker.get_exercise_by_id, RoutineExercise)
        app = ExerciseTracker(routine=routine, default_rest_duration=float(plan["restSeconds"]))
    started = time.time()
    app.run()

    if target:
        session = session_from_export(app.export_session_data_for_db(), plan, target["profileId"], started)
        if session is None:
            print("No rep was counted, so nothing was sent to Arc.")
            return
        try:
            stored = post_session(session, target["apiUrl"], target["apiKey"])
            print(f"Saved to Arc: session {stored.get('id')}, {sum(len(s['reps']) for s in session['sets'])} reps.")
        except UploadError as err:
            print(err)


if __name__ == "__main__":
    main()
