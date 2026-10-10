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

    def evaluate_rep_quality(self, min_ang, max_ang):
        """Calculates form quality score based on absolute deviation from ROM targets."""
        # Detect hyper-extension / over-extension penalties
        if max_ang > self.max_allowed_extension:
            return "POOR FORM (OVER-EXTENSION)", (0, 0, 255)

        if self.invert_logic:
            # For inverted logic: Goal is getting peak angle above extend_threshold
            # and flexed angle below flex_threshold.
            target_extension = self.extend_threshold
            target_flexion = self.flex_threshold

            achieved_extension = max_ang
            achieved_flexion = min_ang

            # Calculate shortfall from target targets
            extension_shortfall = max(0.0, target_extension - achieved_extension)
            flexion_shortfall = max(0.0, achieved_flexion - target_flexion)

        else:
            # For standard logic: Goal is getting minimum angle below flex_threshold
            # and extended angle above extend_threshold.
            target_flexion = self.flex_threshold
            target_extension = self.extend_threshold

            achieved_flexion = min_ang
            achieved_extension = max_ang

            # Shortfall calculation: How far off from full contraction/extension?
            flexion_shortfall = max(0.0, achieved_flexion - target_flexion)
            extension_shortfall = max(0.0, target_extension - achieved_extension)

        total_error = flexion_shortfall + extension_shortfall

        # Strict Categorization
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

    # Exercise Definitions grouped into sections
    # Due to camera mirroring:
    # - User's Right side uses MediaPipe LEFT landmarks
    # - User's Left side uses MediaPipe RIGHT landmarks
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
                "flex_threshold": 25.0,   # Requires wrists to meet directly in front of chest
                "extend_threshold": 75.0,  # Arms open wide at sides
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
                "type": "standard",
                "indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
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
                "flex_threshold": 8.0,
                "extend_threshold": 22.0,
                "default_reps": 10,
                "default_sets": 1,
                "invert_logic": True,
                "max_allowed_extension": 60.0,
            },
            "14": {
                "name": "Crunches",
                "type": "standard",
                "indices": (LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE),
                "flex_threshold": 135.0,  # Torso curled up toward knees
                "extend_threshold": 165.0, # Lying flat on back
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

        # Prompt for default rest timer if building interactive routine
        if routine is None:
            rest_input = input("Enter default rest timer duration in seconds (default 10s): ").strip()
            if rest_input.isdigit() and int(rest_input) >= 0:
                default_rest_duration = float(rest_input)

        self.routine = routine if routine is not None else self.build_custom_routine()
        self.current_index = 0
        self.waiting_for_ready = False
        self.last_rep_feedback = ("READY", (255, 255, 255))
        self.warning_status = ("NORMAL", (0, 255, 0))

        # Rest Timer and Grace Period configuration
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

        for category, exercises in cls.EXERCISE_CATEGORIES.items():
            print(f"\n--- {category} ---")
            for key, ex in exercises.items():
                print(f" [{key}] {ex['name']}")

        routine = []
        adding = True

        while adding:
            choice = input("\nSelect exercise number to add: ").strip()
            ex_data = cls.get_exercise_by_id(choice)

            if not ex_data:
                print("Invalid choice. Please select a valid number.")
                continue

            max_ext = ex_data.get("max_allowed_extension", 180.0)

            if ex_data.get("type") == "arm_dual":
                print(f"\nSelect Arm/Side Option for {ex_data['name']}:")
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
        return [
            RoutineExercise(
                "Bicep Curls (Right)",
                (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=40.0,
                extend_threshold=150.0,
                target_reps=3,
                target_sets=2,
                invert_logic=False,
                max_allowed_extension=175.0,
            ),
            RoutineExercise(
                "Tricep Extension (Down) (Right)",
                (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=60.0,
                extend_threshold=140.0,
                target_reps=3,
                target_sets=2,
                invert_logic=True,
                max_allowed_extension=180.0,
            ),
            RoutineExercise(
                "Squats",
                (self.LEFT_HIP, self.LEFT_KNEE, self.LEFT_ANKLE),
                flex_threshold=90.0,
                extend_threshold=160.0,
                target_reps=3,
                target_sets=2,
                invert_logic=False,
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
        """Calculates rotation/tilt angle of the shoulder line relative to horizontal screen axis."""
        dx = right_shoulder[0] - left_shoulder[0]
        dy = right_shoulder[1] - left_shoulder[1]
        radians = math.atan2(dy, dx)
        angle = math.abs(radians * 180.0 / math.pi) if hasattr(math, 'abs') else abs(radians * 180.0 / math.pi)
        return angle

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

    def process_reps(self, current_exercise, angle):
        current_exercise.min_angle = min(current_exercise.min_angle, angle)
        current_exercise.max_angle = max(current_exercise.max_angle, angle)

        current_exercise.current_rep_min = min(current_exercise.current_rep_min, angle)
        current_exercise.current_rep_max = max(current_exercise.current_rep_max, angle)

        time_since_last = self.check_fatigue_and_stalls(current_exercise)

        # Inverted logic movements (e.g., Tricep Pushdowns: Flexes up, extends down)
        if current_exercise.invert_logic:
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

                score, color = current_exercise.evaluate_rep_quality(
                    current_exercise.current_rep_min, current_exercise.current_rep_max
                )
                self.last_rep_feedback = (score, color)

                current_exercise.rep_logs.append(
                    {
                        "set": current_exercise.current_set,
                        "rep": current_exercise.reps_completed,
                        "min_angle": int(current_exercise.current_rep_min),
                        "max_angle": int(current_exercise.current_rep_max),
                        "duration": rep_duration,
                        "rest_time": time_since_last,
                        "score": score,
                    }
                )

                current_exercise.last_rep_completion_time = now
                current_exercise.current_rep_min = 180.0
                current_exercise.current_rep_max = 0.0

                if current_exercise.reps_completed >= current_exercise.target_reps:
                    self.start_rest_period()

        # Flexion-based movements (e.g., Bicep Curls)
        else:
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

                score, color = current_exercise.evaluate_rep_quality(
                    current_exercise.current_rep_min, current_exercise.current_rep_max
                )
                self.last_rep_feedback = (score, color)

                current_exercise.rep_logs.append(
                    {
                        "set": current_exercise.current_set,
                        "rep": current_exercise.reps_completed,
                        "min_angle": int(current_exercise.current_rep_min),
                        "max_angle": int(current_exercise.current_rep_max),
                        "duration": rep_duration,
                        "rest_time": time_since_last,
                        "score": score,
                    }
                )

                current_exercise.last_rep_completion_time = now
                current_exercise.current_rep_min = 180.0
                current_exercise.current_rep_max = 0.0

                if current_exercise.reps_completed >= current_exercise.target_reps:
                    self.start_rest_period()

    def start_rest_period(self):
        """Triggers the rest period timer when a set completes."""
        self.waiting_for_ready = True
        if self.rest_duration > 0:
            self.in_rest_period = True
            self.rest_timer_end = time.time() + self.rest_duration
        else:
            self.in_rest_period = False

    def start_grace_period(self):
        """Starts a buffer delay after pressing space to avoid misreading initial positioning."""
        if self.grace_duration > 0:
            self.in_grace_period = True
            self.grace_period_end = time.time() + self.grace_duration
        else:
            self.in_grace_period = False

    def export_session_data_for_db(self):
        """Generates structured JSON object formatted for TigerDB storage and Gemini AI prompts."""
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
                    f"   Set {log['set']} Rep {log['rep']}: Form={log['score']} | "
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

            # Handle Rest Timer Expiration
            if self.in_rest_period and self.rest_timer_end:
                if now >= self.rest_timer_end:
                    self.in_rest_period = False
                    self.waiting_for_ready = False
                    self.advance_set_or_exercise()

            # Handle Grace Period Expiration
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

                # Special torso twist check vs standard 3-joint angle calculation
                if active_exercise.name == "Ab Twist":
                    ls = [landmarks[self.LEFT_SHOULDER].x * w, landmarks[self.LEFT_SHOULDER].y * h]
                    rs = [landmarks[self.RIGHT_SHOULDER].x * w, landmarks[self.RIGHT_SHOULDER].y * h]
                    angle = self.calculate_torso_twist_angle(ls, rs)
                else:
                    p1_idx, p2_idx, p3_idx = active_exercise.indices
                    p1 = [landmarks[p1_idx].x * w, landmarks[p1_idx].y * h]
                    p2 = [landmarks[p2_idx].x * w, landmarks[p2_idx].y * h]
                    p3 = [landmarks[p3_idx].x * w, landmarks[p3_idx].y * h]
                    angle = self.calculate_angle(p1, p2, p3)

                # Process reps ONLY if not waiting, resting, or in grace period
                if not self.waiting_for_ready and not self.in_rest_period and not self.in_grace_period:
                    self.process_reps(active_exercise, angle)

                self.mp_drawing.draw_landmarks(
                    frame, results.pose_landmarks, self.mp_pose.POSE_CONNECTIONS
                )

                # --- Draw Semi-Transparent HUD Overlay ---
                overlay = frame.copy()
                cv2.rectangle(overlay, (20, 20), (540, 310), (0, 0, 0), -1)
                alpha = 0.6
                frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

                # Text Metrics Overlay
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
                    f"Last Rep Form: {self.last_rep_feedback[0]}",
                    (35, 230),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    self.last_rep_feedback[1],
                    2,
                )
                cv2.putText(
                    frame,
                    f"Status: {self.warning_status[0]}",
                    (35, 260),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    self.warning_status[1],
                    2,
                )
                cv2.putText(
                    frame,
                    f"Rest Config: {int(self.rest_duration)}s | Grace: {int(self.grace_duration)}s",
                    (35, 290),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (180, 180, 180),
                    1,
                )

                # --- OVERLAY BANNER FOR REST TIMER / GRACE PERIOD / WAITING ---
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


if __name__ == "__main__":
    tracker = ExerciseTracker()
    tracker.run()