import json
import math
import time
import cv2
import mediapipe as mp
import numpy as np


class RoutineExercise:

    def __init__(
        self,
        name,
        primary_joint_indices,
        flex_threshold=50.0,
        extend_threshold=150.0,
        target_reps=5,
        target_sets=1,
        max_rest_limit=8.0,
        invert_logic=False,
        max_allowed_extension=175.0,  # Threshold for bad form / hyper-extension penalty
    ):
        """Configuration for a routine exercise.

        indices: (Point_A, Point_B_Vertex, Point_C)
        """
        self.name = name
        self.indices = primary_joint_indices
        self.flex_threshold = flex_threshold
        self.extend_threshold = extend_threshold
        self.target_reps = target_reps
        self.target_sets = target_sets
        self.max_rest_limit = max_rest_limit
        self.invert_logic = invert_logic
        self.max_allowed_extension = max_allowed_extension

        # Live State
        self.reps_completed = 0
        self.current_set = 1
        self.current_stage = "up"  # Set to 'up' so starting bent doesn't auto-trigger reps
        self.min_angle = 180.0
        self.max_angle = 0.0

        # Detailed Rep Metrics
        self.rep_logs = []
        self.rep_start_time = None
        self.last_rep_completion_time = time.time()
        self.current_rep_min = 180.0
        self.current_rep_max = 0.0

        # Dynamic Green Line Best Form Tracking
        self.best_peak_angle = 180.0 if not self.invert_logic else 0.0
        self.best_endpoint_coords = None  # Stores (vertex_point, endpoint) in pixel coords

    def evaluate_rep_quality(self, min_ang, max_ang):
        """Calculates live visual feedback score for data logs only."""
        if max_ang > self.max_allowed_extension:
            return "POOR FORM (OVER-EXTENSION)", (0, 0, 255)

        if self.invert_logic:
            target_extension = self.extend_threshold
            target_flexion = self.flex_threshold

            achieved_extension = max_ang
            achieved_flexion = min_ang

            extension_shortfall = max(0.0, target_extension - achieved_extension)
            flexion_shortfall = max(0.0, achieved_flexion - target_flexion)
        else:
            target_flexion = self.flex_threshold
            target_extension = self.extend_threshold

            achieved_flexion = min_ang
            achieved_extension = max_ang

            flexion_shortfall = max(0.0, achieved_flexion - target_flexion)
            extension_shortfall = max(0.0, target_extension - achieved_extension)

        total_error = flexion_shortfall + extension_shortfall

        if total_error <= 10.0:
            return "PERFECT", (0, 255, 0)
        elif total_error <= 25.0:
            return "GOOD", (0, 255, 255)
        elif total_error <= 45.0:
            return "INCOMPLETE ROM", (0, 165, 255)
        else:
            return "POOR FORM", (0, 0, 255)


class ExerciseTracker:

    # MediaPipe Landmark Indices
    NOSE = 0
    LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
    LEFT_ELBOW, RIGHT_ELBOW = 13, 14
    LEFT_WRIST, RIGHT_WRIST = 15, 16
    LEFT_HIP, RIGHT_HIP = 23, 24
    LEFT_KNEE, RIGHT_KNEE = 25, 26
    LEFT_ANKLE, RIGHT_ANKLE = 27, 28

    EXERCISE_CATEGORIES = {
        "ARMS": {
            "1": {
                "name": "Bicep Curls",
                "type": "arm_dual",
                "right_indices": (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
                "left_indices": (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
                "flex_threshold": 40.0,
                "extend_threshold": 150.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 175.0,
            },
            "2": {
                "name": "Tricep Extension (Down)",
                "type": "arm_dual",
                "right_indices": (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
                "left_indices": (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
                "flex_threshold": 60.0,
                "extend_threshold": 140.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 180.0,
            },
        },
        "SHOULDERS": {
            "3": {
                "name": "Shoulder Press",
                "type": "standard",
                "indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW),
                "flex_threshold": 80.0,
                "extend_threshold": 160.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 180.0,
            },
            "4": {
                "name": "Lateral Raise",
                "type": "arm_dual",
                "right_indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW),
                "left_indices": (RIGHT_HIP, RIGHT_SHOULDER, RIGHT_ELBOW),
                "flex_threshold": 25.0,
                "extend_threshold": 85.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 110.0,
            },
            "5": {
                "name": "Front Raise",
                "type": "arm_dual",
                "right_indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_WRIST),
                "left_indices": (RIGHT_HIP, RIGHT_SHOULDER, RIGHT_WRIST),
                "flex_threshold": 25.0,
                "extend_threshold": 135.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 160.0,
            },
        },
        "CHEST": {
            "6": {
                "name": "Chest Press",
                "type": "standard",
                "indices": (LEFT_WRIST, LEFT_ELBOW, LEFT_SHOULDER),
                "flex_threshold": 70.0,
                "extend_threshold": 155.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 175.0,
            },
            "7": {
                "name": "Pec Fly",
                "type": "standard",
                "indices": (LEFT_WRIST, LEFT_SHOULDER, RIGHT_WRIST),
                "flex_threshold": 25.0,
                "extend_threshold": 75.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 105.0,
            },
        },
        "BACK": {
            "8": {
                "name": "Lat Pulldown",
                "type": "standard",
                "indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW),
                "flex_threshold": 70.0,
                "extend_threshold": 155.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 175.0,
            },
            "9": {
                "name": "Bent-Over Rows",
                "type": "standard",
                "indices": (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
                "flex_threshold": 70.0,
                "extend_threshold": 150.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 175.0,
            },
            "10": {
                "name": "Deadlift",
                "type": "standard",
                "indices": (LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE),
                "flex_threshold": 130.0,
                "extend_threshold": 165.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 180.0,
            },
        },
        "LEGS": {
            "11": {
                "name": "Squats",
                "type": "standard",
                "indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
                "flex_threshold": 90.0,
                "extend_threshold": 160.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 180.0,
            },
            "12": {
                "name": "Lunges",
                "type": "leg_dual",
                "right_indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
                "left_indices": (RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE),
                "flex_threshold": 95.0,
                "extend_threshold": 165.0,
                "default_reps": 5,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 180.0,
            },
        },
        "CORE": {
            "13": {
                "name": "Ab Twist",
                "type": "twist",
                "indices": (LEFT_SHOULDER, RIGHT_SHOULDER, 0),
                "flex_threshold": 2.5,
                "extend_threshold": 8.5,
                "default_reps": 10,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 40.0,
            },
            "14": {
                "name": "Crunches",
                "type": "standard",
                "indices": (LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE),
                "flex_threshold": 135.0,
                "extend_threshold": 165.0,
                "default_reps": 8,
                "default_sets": 1,
                "invert_logic": False,
                "max_allowed_extension": 180.0,
            },
        },
    }

    def __init__(self, routine=None, default_rest_duration=10.0, grace_period_duration=3.0):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.mp_drawing = mp.solutions.drawing_utils

        if routine is None:
            rest_input = input("Enter default rest timer duration in seconds (default 10s): ").strip()
            if rest_input.isdigit() and int(rest_input) >= 0:
                default_rest_duration = float(rest_input)

        self.routine = routine if routine is not None else self.build_custom_routine()
        self.current_index = 0
        self.waiting_for_ready = False
        self.warning_status = ("NORMAL", (0, 255, 0))

        self.rest_duration = default_rest_duration
        self.rest_timer_end = None
        self.in_rest_period = False

        self.grace_duration = grace_period_duration
        self.grace_period_end = None
        self.in_grace_period = False

    @classmethod
    def get_exercise_by_id(cls, ex_id):
        """Finds an exercise definition by key across all sections."""
        for cat, items in cls.EXERCISE_CATEGORIES.items():
            if ex_id in items:
                return items[ex_id]
        return None

    @classmethod
    def build_custom_routine(cls):
        print("\n" + "=" * 50)
        print("    CUSTOM WORKOUT ROUTINE BUILDER")
        print("=" * 50)
        print(" [0] Cancel / Finish building routine")
        print(" [all] Add ALL exercises (with both Left & Right variations for bilateral movements)")

        for category, exercises in cls.EXERCISE_CATEGORIES.items():
            print(f"\n--- {category} ---")
            for key, ex in exercises.items():
                print(f" [{key}] {ex['name']}")

        routine = []
        adding = True

        while adding:
            choice = input("\nSelect exercise number to add (or '0' to finish, 'all' for all): ").strip().lower()

            if choice == "0":
                print("Finishing routine builder...")
                break

            if choice == "all":
                univ_reps = input("Enter universal target reps per set (default 5): ").strip()
                target_reps = int(univ_reps) if univ_reps.isdigit() and int(univ_reps) > 0 else 5

                univ_sets = input("Enter universal target sets (default 1): ").strip()
                target_sets = int(univ_sets) if univ_sets.isdigit() and int(univ_sets) > 0 else 1

                for cat, exercises in cls.EXERCISE_CATEGORIES.items():
                    for key, ex_data in exercises.items():
                        max_ext = ex_data.get("max_allowed_extension", 180.0)
                        ex_type = ex_data.get("type")

                        if ex_type in ["arm_dual", "leg_dual"]:
                            routine.append(
                                RoutineExercise(
                                    name=f"{ex_data['name']} (Right)",
                                    primary_joint_indices=ex_data["right_indices"],
                                    flex_threshold=ex_data["flex_threshold"],
                                    extend_threshold=ex_data["extend_threshold"],
                                    target_reps=target_reps,
                                    target_sets=target_sets,
                                    invert_logic=ex_data["invert_logic"],
                                    max_allowed_extension=max_ext,
                                )
                            )
                            routine.append(
                                RoutineExercise(
                                    name=f"{ex_data['name']} (Left)",
                                    primary_joint_indices=ex_data["left_indices"],
                                    flex_threshold=ex_data["flex_threshold"],
                                    extend_threshold=ex_data["extend_threshold"],
                                    target_reps=target_reps,
                                    target_sets=target_sets,
                                    invert_logic=ex_data["invert_logic"],
                                    max_allowed_extension=max_ext,
                                )
                            )
                        else:
                            routine.append(
                                RoutineExercise(
                                    name=ex_data["name"],
                                    primary_joint_indices=ex_data["indices"],
                                    flex_threshold=ex_data["flex_threshold"],
                                    extend_threshold=ex_data["extend_threshold"],
                                    target_reps=target_reps,
                                    target_sets=target_sets,
                                    invert_logic=ex_data["invert_logic"],
                                    max_allowed_extension=max_ext,
                                )
                            )
                print(f"--> Added ALL exercises with both sides included ({target_sets} set(s) of {target_reps} reps each).")
                break

            ex_data = cls.get_exercise_by_id(choice)

            if not ex_data:
                print("Invalid choice. Please select a valid number, '0' to finish, or 'all'.")
                continue

            max_ext = ex_data.get("max_allowed_extension", 180.0)
            ex_type = ex_data.get("type")

            if ex_type in ["arm_dual", "leg_dual"]:
                side_label = "Arm/Side" if ex_type == "arm_dual" else "Leg/Side"
                print(f"\nSelect {side_label} Option for {ex_data['name']}:")
                print(" [1] Right Side")
                print(" [2] Left Side")
                print(" [3] Both Sides (Sequential)")
                arm_choice = input("Option choice (1/2/3): ").strip()

                reps_input = input(
                    f"Enter target reps per set for {ex_data['name']} (default {ex_data['default_reps']}): "
                ).strip()
                target_reps = (
                    int(reps_input)
                    if reps_input.isdigit() and int(reps_input) > 0
                    else ex_data["default_reps"]
                )

                sets_input = input(
                    f"Enter target sets for {ex_data['name']} (default {ex_data['default_sets']}): "
                ).strip()
                target_sets = (
                    int(sets_input)
                    if sets_input.isdigit() and int(sets_input) > 0
                    else ex_data["default_sets"]
                )

                if arm_choice == "1":
                    routine.append(
                        RoutineExercise(
                            name=f"{ex_data['name']} (Right)",
                            primary_joint_indices=ex_data["right_indices"],
                            flex_threshold=ex_data["flex_threshold"],
                            extend_threshold=ex_data["extend_threshold"],
                            target_reps=target_reps,
                            target_sets=target_sets,
                            invert_logic=ex_data["invert_logic"],
                            max_allowed_extension=max_ext,
                        )
                    )
                    print(f"--> Added {ex_data['name']} (Right Side) ({target_sets} sets of {target_reps} reps)")
                elif arm_choice == "2":
                    routine.append(
                        RoutineExercise(
                            name=f"{ex_data['name']} (Left)",
                            primary_joint_indices=ex_data["left_indices"],
                            flex_threshold=ex_data["flex_threshold"],
                            extend_threshold=ex_data["extend_threshold"],
                            target_reps=target_reps,
                            target_sets=target_sets,
                            invert_logic=ex_data["invert_logic"],
                            max_allowed_extension=max_ext,
                        )
                    )
                    print(f"--> Added {ex_data['name']} (Left Side) ({target_sets} sets of {target_reps} reps)")
                else:
                    routine.append(
                        RoutineExercise(
                            name=f"{ex_data['name']} (Right)",
                            primary_joint_indices=ex_data["right_indices"],
                            flex_threshold=ex_data["flex_threshold"],
                            extend_threshold=ex_data["extend_threshold"],
                            target_reps=target_reps,
                            target_sets=target_sets,
                            invert_logic=ex_data["invert_logic"],
                            max_allowed_extension=max_ext,
                        )
                    )
                    routine.append(
                        RoutineExercise(
                            name=f"{ex_data['name']} (Left)",
                            primary_joint_indices=ex_data["left_indices"],
                            flex_threshold=ex_data["flex_threshold"],
                            extend_threshold=ex_data["extend_threshold"],
                            target_reps=target_reps,
                            target_sets=target_sets,
                            invert_logic=ex_data["invert_logic"],
                            max_allowed_extension=max_ext,
                        )
                    )
                    print(
                        f"--> Added {ex_data['name']} for Both Sides ({target_sets} sets of {target_reps} reps each)"
                    )

            else:
                reps_input = input(
                    f"Enter target reps per set for {ex_data['name']} (default {ex_data['default_reps']}): "
                ).strip()
                target_reps = (
                    int(reps_input)
                    if reps_input.isdigit() and int(reps_input) > 0
                    else ex_data["default_reps"]
                )

                sets_input = input(
                    f"Enter target sets for {ex_data['name']} (default {ex_data['default_sets']}): "
                ).strip()
                target_sets = (
                    int(sets_input)
                    if sets_input.isdigit() and int(sets_input) > 0
                    else ex_data["default_sets"]
                )

                routine.append(
                    RoutineExercise(
                        name=ex_data["name"],
                        primary_joint_indices=ex_data["indices"],
                        flex_threshold=ex_data["flex_threshold"],
                        extend_threshold=ex_data["extend_threshold"],
                        target_reps=target_reps,
                        target_sets=target_sets,
                        invert_logic=ex_data["invert_logic"],
                        max_allowed_extension=max_ext,
                    )
                )
                print(f"--> Added {ex_data['name']} ({target_sets} sets of {target_reps} reps) to routine.")

            more = input("\nAdd another exercise? (y/N): ").strip().lower()
            if more != "y":
                adding = False

        if not routine:
            print("No exercises selected. Loading default routine.")
            return cls._get_default_routine(cls)

        print(f"\nRoutine created with {len(routine)} exercise(s). Starting workout...\n")
        return routine

    def _get_default_routine(self):
        # The catalog's thresholds (Arc's, once main.py has aligned it), so the fallback counts like the rest.
        curl, tricep, squat = (self.get_exercise_by_id(i) for i in ("1", "2", "11"))
        return [
            RoutineExercise(
                "Bicep Curls (Right)",
                (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=curl["flex_threshold"],
                extend_threshold=curl["extend_threshold"],
                target_reps=3,
                target_sets=2,
                invert_logic=curl["invert_logic"],
                max_allowed_extension=175.0,
            ),
            RoutineExercise(
                "Tricep Extension (Down) (Right)",
                (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=tricep["flex_threshold"],
                extend_threshold=tricep["extend_threshold"],
                target_reps=3,
                target_sets=2,
                invert_logic=tricep["invert_logic"],
                max_allowed_extension=180.0,
            ),
            RoutineExercise(
                "Squats",
                (self.LEFT_HIP, self.LEFT_KNEE, self.LEFT_ANKLE),
                flex_threshold=squat["flex_threshold"],
                extend_threshold=squat["extend_threshold"],
                target_reps=3,
                target_sets=2,
                invert_logic=squat["invert_logic"],
                max_allowed_extension=180.0,
            ),
        ]

    @staticmethod
    def calculate_angle(a, b, c):
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(
            a[1] - b[1], a[0] - b[0]
        )
        angle = np.abs(radians * 180.0 / np.pi)
        if angle > 180.0:
            angle = 360 - angle
        return angle

    @staticmethod
    def calculate_torso_twist_angle(left_shoulder, right_shoulder):
        dx = right_shoulder[0] - left_shoulder[0]
        dy = right_shoulder[1] - left_shoulder[1]
        radians = math.atan2(dy, dx)
        angle = abs(radians * 180.0 / math.pi)
        # The tilt off the level either way (0-90), as Arc measures it: in the mirrored frame the
        # right shoulder can sit left of the left one, which reads a level line as 180.
        return 180.0 - angle if angle > 90.0 else angle

    def advance_set_or_exercise(self):
        """Advances to the next set or moves to the next exercise once all sets are complete."""
        active_exercise = self.routine[self.current_index]
        active_exercise.current_stage = "up"
        if active_exercise.current_set < active_exercise.target_sets:
            active_exercise.current_set += 1
            active_exercise.reps_completed = 0
            active_exercise.last_rep_completion_time = time.time()
            self.start_grace_period()
        else:
            self.current_index += 1
            if self.current_index < len(self.routine):
                self.routine[self.current_index].current_stage = "up"
                self.routine[self.current_index].last_rep_completion_time = time.time()
                self.start_grace_period()

    def check_fatigue_and_stalls(self, current_exercise):
        now = time.time()
        time_since_last_rep = round(now - current_exercise.last_rep_completion_time, 1)

        if time_since_last_rep > current_exercise.max_rest_limit:
            self.warning_status = (
                f"STALL WARNING! Rest: {int(time_since_last_rep)}s",
                (0, 0, 255),
            )
            return time_since_last_rep

        if len(current_exercise.rep_logs) >= 2:
            durations = [log["duration"] for log in current_exercise.rep_logs]
            if current_exercise.invert_logic:
                peak_angles = [log["max_angle"] for log in current_exercise.rep_logs]
            else:
                peak_angles = [log["min_angle"] for log in current_exercise.rep_logs]
            rom_std_dev = np.std(peak_angles)

            recent_duration = durations[-1]
            avg_duration = sum(durations[:-1]) / len(durations[:-1])

            if rom_std_dev > 12.0:
                self.warning_status = ("FATIGUE ALERT: Inconsistent ROM!", (0, 165, 255))
                return time_since_last_rep
            elif recent_duration > avg_duration * 1.5:
                self.warning_status = ("FATIGUE ALERT: Speed Slowing!", (0, 165, 255))
                return time_since_last_rep

        self.warning_status = (f"Rest: {int(time_since_last_rep)}s", (200, 200, 200))
        return time_since_last_rep

    def process_reps(self, current_exercise, angle, p2_px=None, p3_px=None):
        current_exercise.min_angle = min(current_exercise.min_angle, angle)
        current_exercise.max_angle = max(current_exercise.max_angle, angle)

        current_exercise.current_rep_min = min(current_exercise.current_rep_min, angle)
        current_exercise.current_rep_max = max(current_exercise.current_rep_max, angle)

        time_since_last = self.check_fatigue_and_stalls(current_exercise)

        # Standard flexion movements
        if not current_exercise.invert_logic:
            if angle < current_exercise.best_peak_angle:
                current_exercise.best_peak_angle = angle
                if p2_px is not None and p3_px is not None:
                    current_exercise.best_endpoint_coords = (
                        tuple(map(int, p2_px)),
                        tuple(map(int, p3_px)),
                    )

            if angle > current_exercise.extend_threshold:
                if current_exercise.current_stage != "down":
                    current_exercise.current_stage = "down"
                    current_exercise.rep_start_time = time.time()
                    current_exercise.current_rep_min = angle
                    current_exercise.current_rep_max = angle

            if (
                angle < current_exercise.flex_threshold
                and current_exercise.current_stage == "down"
            ):
                now = time.time()
                current_exercise.current_stage = "up"
                current_exercise.reps_completed += 1

                rep_duration = (
                    round(now - current_exercise.rep_start_time, 2)
                    if current_exercise.rep_start_time
                    else 0.0
                )

                current_exercise.evaluate_rep_quality(
                    current_exercise.current_rep_min, current_exercise.current_rep_max
                )

                current_exercise.rep_logs.append(
                    {
                        "set": current_exercise.current_set,
                        "rep": current_exercise.reps_completed,
                        "min_angle": int(current_exercise.current_rep_min),
                        "max_angle": int(current_exercise.current_rep_max),
                        "duration": rep_duration,
                        "rest_time": time_since_last,
                    }
                )

                current_exercise.last_rep_completion_time = now
                current_exercise.current_rep_min = 180.0
                current_exercise.current_rep_max = 0.0

                if current_exercise.reps_completed >= current_exercise.target_reps:
                    self.start_rest_period()

        # Inverted logic movements
        else:
            if angle > current_exercise.best_peak_angle:
                current_exercise.best_peak_angle = angle
                if p2_px is not None and p3_px is not None:
                    current_exercise.best_endpoint_coords = (
                        tuple(map(int, p2_px)),
                        tuple(map(int, p3_px)),
                    )

            if angle < current_exercise.flex_threshold:
                if current_exercise.current_stage != "down":
                    current_exercise.current_stage = "down"
                    current_exercise.rep_start_time = time.time()
                    current_exercise.current_rep_min = angle
                    current_exercise.current_rep_max = angle

            if (
                angle > current_exercise.extend_threshold
                and current_exercise.current_stage == "down"
            ):
                now = time.time()
                current_exercise.current_stage = "up"
                current_exercise.reps_completed += 1

                rep_duration = (
                    round(now - current_exercise.rep_start_time, 2)
                    if current_exercise.rep_start_time
                    else 0.0
                )

                current_exercise.evaluate_rep_quality(
                    current_exercise.current_rep_min, current_exercise.current_rep_max
                )

                current_exercise.rep_logs.append(
                    {
                        "set": current_exercise.current_set,
                        "rep": current_exercise.reps_completed,
                        "min_angle": int(current_exercise.current_rep_min),
                        "max_angle": int(current_exercise.current_rep_max),
                        "duration": rep_duration,
                        "rest_time": time_since_last,
                    }
                )

                current_exercise.last_rep_completion_time = now
                current_exercise.current_rep_min = 180.0
                current_exercise.current_rep_max = 0.0

                if current_exercise.reps_completed >= current_exercise.target_reps:
                    self.start_rest_period()

    def start_rest_period(self):
        self.waiting_for_ready = True
        if self.rest_duration > 0:
            self.in_rest_period = True
            self.rest_timer_end = time.time() + self.rest_duration
        else:
            self.in_rest_period = False

    def start_grace_period(self):
        if self.grace_duration > 0:
            self.in_grace_period = True
            self.grace_period_end = time.time() + self.grace_duration
        else:
            self.in_grace_period = False

    def export_session_data_for_db(self, output_filename="workout_session.json"):
        payload = {"timestamp": time.time(), "exercises": []}
        for ex in self.routine:
            ex_data = {
                "exercise_name": ex.name,
                "target_sets": ex.target_sets,
                "target_reps": ex.target_reps,
                "overall_min_angle": ex.min_angle,
                "overall_max_angle": ex.max_angle,
                "reps": ex.rep_logs,
            }
            payload["exercises"].append(ex_data)

        with open(output_filename, "w") as f:
            json.dump(payload, f, indent=4)

        print(f"\n[INFO] Workout data successfully saved to '{output_filename}'")
        return payload

    def print_workout_summary(self):
        print("\n" + "=" * 70)
        print("               DETAILED WORKOUT ANALYSIS LOG")
        print("=" * 70)
        for ex in self.routine:
            print(f"\n[Exercise]: {ex.name} (Sets: {ex.target_sets} | Reps/Set: {ex.target_reps})")
            if not ex.rep_logs:
                print("   No reps recorded.")
                continue

            durations = [l["duration"] for l in ex.rep_logs]
            avg_duration = round(sum(durations) / len(durations), 2)

            for log in ex.rep_logs:
                speed_diff = round(log["duration"] - avg_duration, 2)
                pace_str = f"+{speed_diff}s slower" if speed_diff > 0 else f"{speed_diff}s faster"

                print(
                    f"   Set {log['set']} Rep {log['rep']}: "
                    f"ROM={log['min_angle']}°-{log['max_angle']}° | "
                    f"Time={log['duration']}s ({pace_str}) | "
                    f"Rest Prior={log['rest_time']}s"
                )
        print("=" * 70 + "\n")

    def run(self, camera_index=0):
        cap = cv2.VideoCapture(camera_index)

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        window_title = "FormPulse AI"
        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_title, 1280, 720)

        print("\nControls:")
        print("  [SPACE] - Start / Next Set or Exercise")
        print("  [t]     - Adjust Rest Timer (+5s / Reset)")
        print("  [g]     - Toggle Grace Period (0s / 3s / 5s)")
        print("  [n]     - Skip to Next Exercise")
        print("  [p]     - Return to Previous Exercise")
        print("  [+]     - Increase Target Reps")
        print("  [-]     - Decrease Target Reps")
        print("  [r]     - Reset Current Rep Count")
        print("  [q]     - Quit Program\n")

        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                continue

            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            results = self.pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            key = cv2.waitKey(1) & 0xFF
            now = time.time()

            if self.in_rest_period and self.rest_timer_end:
                if now >= self.rest_timer_end:
                    self.in_rest_period = False
                    self.waiting_for_ready = False
                    self.advance_set_or_exercise()

            if self.in_grace_period and self.grace_period_end:
                if now >= self.grace_period_end:
                    self.in_grace_period = False

            if key == ord("q"):
                break
            elif key == ord(" "):
                if self.waiting_for_ready or self.in_rest_period:
                    self.waiting_for_ready = False
                    self.in_rest_period = False
                    self.advance_set_or_exercise()
                else:
                    self.start_grace_period()
            elif key == ord("t"):
                timer_options = [0.0, 10.0, 30.0, 60.0]
                idx = (timer_options.index(self.rest_duration) + 1) % len(timer_options) if self.rest_duration in timer_options else 0
                self.rest_duration = timer_options[idx]
                print(f"Rest Timer set to: {int(self.rest_duration)}s")
            elif key == ord("g"):
                grace_options = [0.0, 3.0, 5.0]
                idx = (grace_options.index(self.grace_duration) + 1) % len(grace_options) if self.grace_duration in grace_options else 0
                self.grace_duration = grace_options[idx]
                print(f"Grace Period set to: {int(self.grace_duration)}s")
            elif key == ord("n"):
                self.waiting_for_ready = False
                self.in_rest_period = False
                if self.current_index < len(self.routine) - 1:
                    self.current_index += 1
                    self.routine[self.current_index].last_rep_completion_time = time.time()
                    self.start_grace_period()
            elif key == ord("p"):
                self.waiting_for_ready = False
                self.in_rest_period = False
                if self.current_index > 0:
                    self.current_index -= 1
                    self.routine[self.current_index].last_rep_completion_time = time.time()
                    self.start_grace_period()
            elif key == ord("+") or key == ord("="):
                if self.current_index < len(self.routine):
                    self.routine[self.current_index].target_reps += 1
            elif key == ord("-"):
                if self.current_index < len(self.routine):
                    self.routine[self.current_index].target_reps = max(
                        1, self.routine[self.current_index].target_reps - 1
                    )
            elif key == ord("r"):
                if self.current_index < len(self.routine):
                    self.routine[self.current_index].reps_completed = 0
                    self.routine[self.current_index].last_rep_completion_time = time.time()
                    self.waiting_for_ready = False
                    self.in_rest_period = False
                    self.start_grace_period()

            if self.current_index >= len(self.routine):
                cv2.putText(
                    frame,
                    "WORKOUT ROUTINE COMPLETE!",
                    (w // 6, h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.4,
                    (0, 255, 0),
                    3,
                )
                cv2.imshow(window_title, frame)
                if key == ord("q"):
                    break
                continue

            active_exercise = self.routine[self.current_index]

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark

                if active_exercise.name == "Ab Twist":
                    ls = [landmarks[self.LEFT_SHOULDER].x * w, landmarks[self.LEFT_SHOULDER].y * h]
                    rs = [landmarks[self.RIGHT_SHOULDER].x * w, landmarks[self.RIGHT_SHOULDER].y * h]
                    angle = self.calculate_torso_twist_angle(ls, rs)
                    p1, p2, p3 = None, None, None
                else:
                    p1_idx, p2_idx, p3_idx = active_exercise.indices
                    p1 = [landmarks[p1_idx].x * w, landmarks[p1_idx].y * h]
                    p2 = [landmarks[p2_idx].x * w, landmarks[p2_idx].y * h]
                    p3 = [landmarks[p3_idx].x * w, landmarks[p3_idx].y * h]
                    angle = self.calculate_angle(p1, p2, p3)

                if not self.waiting_for_ready and not self.in_rest_period and not self.in_grace_period:
                    self.process_reps(active_exercise, angle, p2_px=p2, p3_px=p3)

                # --- SPATIAL PACING GUIDES ---
                cycle_time = 2.5
                progress = 0.5 + 0.5 * math.sin(now * (2 * math.pi / cycle_time))

                ex_name = active_exercise.name

                if active_exercise.name == "Ab Twist":
                    center_x, center_y = int(w // 2), int(h // 3)
                    direction_sign = 1 if math.sin(now * math.pi) > 0 else -1
                    target_x = int(center_x + 80 * direction_sign * progress)
                    cv2.arrowedLine(frame, (center_x, center_y), (target_x, center_y), (255, 0, 0), 4, tipLength=0.3)
                    cv2.putText(frame, "ALTERNATE TWIST", (center_x - 75, center_y - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
                elif p2 is not None:
                    base_x, base_y = int(p2[0]), int(p2[1])

                    if "Squats" in ex_name:
                        target_y = int(base_y + 140 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y), (base_x, target_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & DEPTH", (base_x - 55, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Lunges" in ex_name:
                        side_dir = 30 if "Right" in ex_name else -30
                        target_y = int(base_y + 120 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y), (base_x + side_dir, target_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & STEP", (base_x - 45, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Shoulder Press" in ex_name or "Front Raise" in ex_name:
                        label_txt = "PACE & RAISE" if "Front Raise" in ex_name else "PACE & PRESS"
                        target_y = int(base_y - 20 - 100 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y + 40), (base_x, target_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, label_txt, (base_x - 50, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Lateral Raise" in ex_name:
                        side_offset = 70 if "Right" in ex_name else -70
                        target_x = int(base_x + side_offset * progress)
                        cv2.arrowedLine(frame, (base_x, base_y), (target_x, base_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & RAISE", (base_x - 50, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Chest Press" in ex_name:
                        target_x = int(base_x + 100 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y), (target_x, base_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & PRESS", (base_x - 50, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Pec Fly" in ex_name:
                        left_x, right_x = base_x - 120 + int(60 * progress), base_x + 120 - int(60 * progress)
                        cv2.arrowedLine(frame, (left_x - 40, base_y), (left_x, base_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.arrowedLine(frame, (right_x + 40, base_y), (right_x, base_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & SQUEEZE", (base_x - 65, base_y - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Lat Pulldown" in ex_name:
                        target_y = int(base_y - 60 + 100 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y - 60), (base_x, target_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & PULL", (base_x - 45, base_y - 75), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif "Crunches" in ex_name:
                        target_y = int(base_y + 65 - 100 * progress)
                        cv2.arrowedLine(frame, (base_x, base_y + 65), (base_x, target_y), (255, 0, 0), 4, tipLength=0.3)
                        cv2.putText(frame, "PACE & CURL", (base_x - 45, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)
                    elif p3 is not None:
                        v_x = p3[0] - base_x
                        v_y = p3[1] - base_y
                        guide_x = int(base_x + v_x * progress)
                        guide_y = int(base_y + v_y * progress)
                        cv2.arrowedLine(frame, (base_x, base_y), (guide_x, guide_y), (255, 0, 0), 4, tipLength=0.25)
                        cv2.putText(frame, "PACE PATH", (base_x - 35, base_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 0, 0), 2)

                # --- HUD OVERLAY (FORM RATING TEXT REMOVED) ---
                overlay = frame.copy()
                cv2.rectangle(overlay, (20, 20), (540, 275), (0, 0, 0), -1)
                alpha = 0.6
                frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

                cv2.putText(
                    frame,
                    f"Exercise: {active_exercise.name}",
                    (35, 55),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (255, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Set: {active_exercise.current_set}/{active_exercise.target_sets}",
                    (35, 90),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (0, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Reps: {active_exercise.reps_completed}/{active_exercise.target_reps}",
                    (35, 125),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.85,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Angle: {int(angle)} deg",
                    (35, 160),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (255, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Session ROM: {int(active_exercise.min_angle)}-{int(active_exercise.max_angle)} deg",
                    (35, 195),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Status: {self.warning_status[0]}",
                    (35, 230),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    self.warning_status[1],
                    2,
                )
                cv2.putText(
                    frame,
                    f"Rest Config: {int(self.rest_duration)}s | Grace: {int(self.grace_duration)}s",
                    (35, 260),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (180, 180, 180),
                    1,
                )

                if self.in_rest_period and self.rest_timer_end:
                    remaining_rest = max(0, int(self.rest_timer_end - now))
                    cv2.rectangle(
                        frame,
                        (w // 8, h // 2 - 60),
                        (7 * w // 8, h // 2 + 60),
                        (20, 20, 20),
                        -1,
                    )
                    cv2.putText(
                        frame,
                        f"REST TIMER: {remaining_rest}s Remaining",
                        (w // 8 + 30, h // 2 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1.0,
                        (0, 255, 255),
                        2,
                    )
                    cv2.putText(
                        frame,
                        "Press [SPACE] to Skip Rest and Begin Next Set/Exercise",
                        (w // 8 + 30, h // 2 + 35),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (200, 200, 200),
                        1,
                    )

                elif self.in_grace_period and self.grace_period_end:
                    remaining_grace = max(0, round(self.grace_period_end - now, 1))
                    cv2.rectangle(
                        frame,
                        (w // 8, h // 2 - 50),
                        (7 * w // 8, h // 2 + 50),
                        (0, 50, 100),
                        -1,
                    )
                    cv2.putText(
                        frame,
                        f"GET READY! Starting in {remaining_grace}s...",
                        (w // 8 + 40, h // 2 + 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.9,
                        (0, 255, 255),
                        2,
                    )

                elif self.waiting_for_ready:
                    cv2.rectangle(
                        frame,
                        (w // 8, h // 2 - 50),
                        (7 * w // 8, h // 2 + 50),
                        (0, 0, 0),
                        -1,
                    )
                    cv2.putText(
                        frame,
                        "SET COMPLETE! Press [SPACE] to Start Rest/Next Set",
                        (w // 8 + 20, h // 2 + 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 255),
                        2,
                    )

                cv2.putText(
                    frame,
                    "[SPACE]Start  [T]imer  [G]race  [N]ext  [P]rev  [+]Reps  [-]Reps  [R]eset",
                    (20, h - 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (255, 255, 255),
                    2,
                )

            cv2.imshow(window_title, frame)

        cap.release()
        cv2.destroyAllWindows()
        self.print_workout_summary()
        self.export_session_data_for_db()


if __name__ == "__main__":
    from arc_routine import align_catalog

    # Count at Arc's thresholds, the same angles as in the browser (as main.py does).
    align_catalog(ExerciseTracker.get_exercise_by_id)
    tracker = ExerciseTracker()
    tracker.run()