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
        max_rest_limit=8.0,
        invert_logic=False,  # Set True for movements like Lateral Raise where lifting increases angle
    ):
        """Configuration for a routine exercise.

        indices: (Point_A, Point_B_Vertex, Point_C)
        """
        self.name = name
        self.indices = primary_joint_indices
        self.flex_threshold = flex_threshold
        self.extend_threshold = extend_threshold
        self.target_reps = target_reps
        self.max_rest_limit = max_rest_limit
        self.invert_logic = invert_logic

        # Live State
        self.reps_completed = 0
        self.current_stage = "down"  # 'up' or 'down'
        self.min_angle = 180.0
        self.max_angle = 0.0

        # Detailed Rep Metrics
        self.rep_logs = []
        self.rep_start_time = None
        self.last_rep_completion_time = time.time()
        self.current_rep_min = 180.0
        self.current_rep_max = 0.0

    def evaluate_rep_quality(self, min_ang, max_ang):
        """Calculates form quality score based on range of motion thresholds."""
        if self.invert_logic:
            # For Lateral Raises: Check maximum lift height and lowest starting position
            extend_delta = self.extend_threshold - max_ang
            flex_delta = min_ang - self.flex_threshold
        else:
            # Standard flexion workouts (Bicep curls, Squats)
            flex_delta = min_ang - self.flex_threshold
            extend_delta = self.extend_threshold - max_ang

        if flex_delta <= 10 and extend_delta <= 10:
            return "PERFECT", (0, 255, 0)
        elif flex_delta <= 20 and extend_delta <= 20:
            return "GOOD", (0, 255, 255)
        else:
            return "INCOMPLETE ROM", (0, 0, 255)


class ExerciseTracker:

    # MediaPipe Landmark Indices
    LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
    LEFT_ELBOW, RIGHT_ELBOW = 13, 14
    LEFT_WRIST, RIGHT_WRIST = 15, 16
    LEFT_HIP, RIGHT_HIP = 23, 24
    LEFT_KNEE, RIGHT_KNEE = 25, 26
    LEFT_ANKLE, RIGHT_ANKLE = 27, 28

    EXERCISE_LIBRARY = {
        "1": {
            "name": "Bicep Curls (Right)", # Tracks right arm as left, probably due to camera inversion
            "indices": (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
            "flex_threshold": 40.0,
            "extend_threshold": 150.0,
            "default_reps": 5,
            "invert_logic": False,
        },
        "2": {
            "name": "Bicep Curls (Left)", # Again, arm tracking is switched
            "indices": (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
            "flex_threshold": 40.0,
            "extend_threshold": 150.0,
            "default_reps": 5,
            "invert_logic": False,
        },
        "3": {
            "name": "Shoulder Press",
            "indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW),
            "flex_threshold": 80.0,
            "extend_threshold": 160.0,
            "default_reps": 5,
            "invert_logic": True,
        },
        "4": {
            "name": "Squats",
            "indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
            "flex_threshold": 90.0,
            "extend_threshold": 160.0,
            "default_reps": 5,
            "invert_logic": False,
        },
        "5": {
            "name": "Lateral Raise",
            "indices": (LEFT_HIP, LEFT_SHOULDER, LEFT_ELBOW),
            "flex_threshold": 25.0,
            "extend_threshold": 85.0,
            "default_reps": 5,
            "invert_logic": True,  # Angle increases as arm is raised parallel to shoulder
        },
        "6": {
            "name": "Tricep Extension (Overhead)",
            "indices": (LEFT_HIP, LEFT_ELBOW, LEFT_WRIST),  # Vertex at Elbow measured from Hip
            "flex_threshold": 70.0,
            "extend_threshold": 155.0,
            "default_reps": 5,
            "invert_logic": True,  # Arm extends upward reaching ~160 deg
        },
        "7": {
            "name": "Lunges",
            "indices": (LEFT_HIP, LEFT_KNEE, LEFT_ANKLE),
            "flex_threshold": 95.0,
            "extend_threshold": 165.0,
            "default_reps": 5,
            "invert_logic": False,
        },
    }

    def __init__(self, routine=None):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.mp_drawing = mp.solutions.drawing_utils

        self.routine = routine if routine is not None else self.build_custom_routine()
        self.current_index = 0
        self.waiting_for_ready = False
        self.last_rep_feedback = ("READY", (255, 255, 255))
        self.warning_status = ("NORMAL", (0, 255, 0))

    @classmethod
    def build_custom_routine(cls):
        print("\n" + "=" * 50)
        print("    CUSTOM WORKOUT ROUTINE BUILDER")
        print("=" * 50)
        print("Available Exercises:")
        for key, ex in cls.EXERCISE_LIBRARY.items():
            print(f" [{key}] {ex['name']}")

        routine = []
        adding = True

        while adding:
            choice = input("\nSelect exercise number to add: ").strip()
            if choice not in cls.EXERCISE_LIBRARY:
                print("Invalid choice. Please select a valid number.")
                continue

            ex_data = cls.EXERCISE_LIBRARY[choice]

            reps_input = input(
                f"Enter target reps for {ex_data['name']} (default {ex_data['default_reps']}): "
            ).strip()
            target_reps = int(reps_input) if reps_input.isdigit() and int(reps_input) > 0 else ex_data["default_reps"]

            exercise = RoutineExercise(
                name=ex_data["name"],
                primary_joint_indices=ex_data["indices"],
                flex_threshold=ex_data["flex_threshold"],
                extend_threshold=ex_data["extend_threshold"],
                target_reps=target_reps,
                invert_logic=ex_data["invert_logic"],
            )
            routine.append(exercise)
            print(f"--> Added {exercise.name} ({target_reps} reps) to routine.")

            more = input("Add another exercise? (y/N): ").strip().lower()
            if more != "y":
                adding = False

        if not routine:
            print("No exercises selected. Loading default routine.")
            return cls._get_default_routine(cls)

        print(f"\nRoutine created with {len(routine)} exercises. Starting workout...\n")
        return routine

    def _get_default_routine(self):
        return [
            RoutineExercise(
                "Lateral Raise",
                (self.LEFT_HIP, self.LEFT_SHOULDER, self.LEFT_ELBOW),
                flex_threshold=25.0,
                extend_threshold=85.0,
                target_reps=3,
                invert_logic=True,
            ),
            RoutineExercise(
                "Tricep Extension (Overhead)",
                (self.LEFT_HIP, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=70.0,
                extend_threshold=155.0,
                target_reps=3,
                invert_logic=True,
            ),
            RoutineExercise(
                "Bicep Curls (Left)",
                (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST),
                flex_threshold=40.0,
                extend_threshold=150.0,
                target_reps=3,
                invert_logic=False,
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

    def check_fatigue_and_stalls(self, current_exercise):
        now = time.time()
        time_since_last_rep = round(now - current_exercise.last_rep_completion_time, 1)

        # Prolonged stall check
        if time_since_last_rep > current_exercise.max_rest_limit:
            self.warning_status = (
                f"STALL WARNING! Rest: {int(time_since_last_rep)}s",
                (0, 0, 255),
            )
            return time_since_last_rep

        # ROM Variance and Pace Degradation
        if len(current_exercise.rep_logs) >= 2:
            durations = [log["duration"] for log in current_exercise.rep_logs]
            if current_exercise.invert_logic:
                peak_angles = [log["max_angle"] for log in current_exercise.rep_logs]
                rom_std_dev = np.std(peak_angles)
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

        # --- STATE MACHINE FOR EXTENSION-BASED MOVEMENTS (Lateral Raise, Overhead Tricep) ---
        if current_exercise.invert_logic:
            # Arm lowered at rest
            if angle < current_exercise.flex_threshold:
                if current_exercise.current_stage != "down":
                    current_exercise.current_stage = "down"
                    current_exercise.rep_start_time = time.time()
                    current_exercise.current_rep_min = angle
                    current_exercise.current_rep_max = angle

            # Arm raised overhead / laterally to peak extension
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
                    self.waiting_for_ready = True

        # --- STATE MACHINE FOR FLEXION-BASED MOVEMENTS (Bicep Curl, Squat) ---
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
                    self.waiting_for_ready = True

    def print_workout_summary(self):
        print("\n" + "=" * 70)
        print("               DETAILED WORKOUT ANALYSIS LOG")
        print("=" * 70)
        for ex in self.routine:
            print(f"\n[Exercise]: {ex.name} (Target: {ex.target_reps} | Done: {ex.reps_completed})")
            if not ex.rep_logs:
                print("   No reps recorded.")
                continue

            durations = [l["duration"] for l in ex.rep_logs]
            avg_duration = round(sum(durations) / len(durations), 2)

            for log in ex.rep_logs:
                speed_diff = round(log["duration"] - avg_duration, 2)
                pace_str = f"+{speed_diff}s slower" if speed_diff > 0 else f"{speed_diff}s faster"

                print(
                    f"   Rep {log['rep']}: Form={log['score']} | "
                    f"ROM={log['min_angle']}°- {log['max_angle']}° | "
                    f"Time={log['duration']}s ({pace_str}) | "
                    f"Rest Prior={log['rest_time']}s"
                )
        print("=" * 70 + "\n")

    def run(self, camera_index=0):
        cap = cv2.VideoCapture(camera_index)

        # Set high camera capture resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        # Create resizable display window
        window_title = "FormPulse AI"
        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_title, 1280, 720)

        print("\nControls:")
        print("  [SPACE] - Confirm Ready for Next Workout")
        print("  [n] - Skip to Next Exercise")
        print("  [p] - Return to Previous Exercise")
        print("  [+] - Increase Target Reps")
        print("  [-] - Decrease Target Reps")
        print("  [r] - Reset Current Rep Count")
        print("  [q] - Quit Program\n")

        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                continue

            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            results = self.pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            elif key == ord(" "):
                if self.waiting_for_ready:
                    self.waiting_for_ready = False
                    self.current_index += 1
                    if self.current_index < len(self.routine):
                        self.routine[self.current_index].last_rep_completion_time = time.time()
            elif key == ord("n"):
                self.waiting_for_ready = False
                if self.current_index < len(self.routine) - 1:
                    self.current_index += 1
                    self.routine[self.current_index].last_rep_completion_time = time.time()
            elif key == ord("p"):
                self.waiting_for_ready = False
                if self.current_index > 0:
                    self.current_index -= 1
                    self.routine[self.current_index].last_rep_completion_time = time.time()
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
                    self.routine[self.current_index].rep_logs.clear()
                    self.routine[self.current_index].last_rep_completion_time = time.time()
                    self.waiting_for_ready = False

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

                p1_idx, p2_idx, p3_idx = active_exercise.indices
                p1 = [landmarks[p1_idx].x * w, landmarks[p1_idx].y * h]
                p2 = [landmarks[p2_idx].x * w, landmarks[p2_idx].y * h]
                p3 = [landmarks[p3_idx].x * w, landmarks[p3_idx].y * h]

                angle = self.calculate_angle(p1, p2, p3)

                if not self.waiting_for_ready:
                    self.process_reps(active_exercise, angle)

                self.mp_drawing.draw_landmarks(
                    frame, results.pose_landmarks, self.mp_pose.POSE_CONNECTIONS
                )

                # --- Draw Semi-Transparent HUD Overlay ---
                overlay = frame.copy()
                cv2.rectangle(overlay, (20, 20), (520, 280), (0, 0, 0), -1)
                alpha = 0.6  # Transparency factor
                frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

                # Text Metrics Overlay
                cv2.putText(
                    frame,
                    f"Exercise: {active_exercise.name}",
                    (35, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (255, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Reps: {active_exercise.reps_completed}/{active_exercise.target_reps}",
                    (35, 100),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.85,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Angle: {int(angle)} deg",
                    (35, 140),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.75,
                    (255, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Session ROM: {int(active_exercise.min_angle)} - {int(active_exercise.max_angle)} deg",
                    (35, 180),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2,
                )
                cv2.putText(
                    frame,
                    f"Last Rep Form: {self.last_rep_feedback[0]}",
                    (35, 215),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    self.last_rep_feedback[1],
                    2,
                )
                cv2.putText(
                    frame,
                    f"Status: {self.warning_status[0]}",
                    (35, 250),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    self.warning_status[1],
                    2,
                )

                # Pause prompt when target reps are reached
                if self.waiting_for_ready:
                    cv2.rectangle(
                        frame,
                        (w // 8, h // 2 - 50),
                        (7 * w // 8, h // 2 + 50),
                        (0, 0, 0),
                        -1,
                    )
                    cv2.putText(
                        frame,
                        "SET COMPLETE! Press [SPACE] when Ready for Next Workout",
                        (w // 8 + 20, h // 2 + 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.75,
                        (0, 255, 255),
                        2,
                    )

                cv2.putText(
                    frame,
                    "[SPACE]Ready  [N]ext  [P]rev  [+]Reps  [-]Reps  [R]eset",
                    (20, h - 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
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