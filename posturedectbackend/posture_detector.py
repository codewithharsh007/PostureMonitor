import cv2
import mediapipe as mp
import numpy as np
import time
import base64
from typing import Optional


class PostureDetector:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5, min_tracking_confidence=0.5
        )

        # ---------- TUNABLE THRESHOLDS ----------
        self.NECK_FORWARD_THRESHOLD_X = 0.025
        self.NECK_FORWARD_THRESHOLD_Z = 0.010
        self.SPINE_ANGLE_THRESHOLD = 15.0
        self.LEAN_THRESHOLD = 8.0
        self.HEAD_TILT_THRESHOLD = 0.06
        self.VISIBILITY_THRESHOLD = 0.60

        # ---------- Per-user state (reset per instance) ----------
        self.smoothing_alpha = 0.25
        self.smoothed_score = 100.0
        self.bad_posture_start_time = None
        self.bad_posture_duration = 0.0
        self.is_bad_posture = False
        self.grace_period = 7.0
        self.last_good_posture_time = 0.0
        self.last_notification_time = 0.0
        self.notification_cooldown = 30.0
        self._last_log = 0.0

    # ── Core analysis — your original logic, untouched ────────────
    def analyze_posture(self, landmarks) -> dict:
        lm = landmarks

        def pt(landmark):
            p = lm[landmark.value]
            return (
                np.array([p.x, p.y]),
                float(getattr(p, "visibility", 0.0)),
                float(getattr(p, "z", 0.0)),
            )

        (l_sh, ls_vis, l_sh_z), (r_sh, rs_vis, r_sh_z) = (
            pt(self.mp_pose.PoseLandmark.LEFT_SHOULDER),
            pt(self.mp_pose.PoseLandmark.RIGHT_SHOULDER),
        )
        (l_hp, lh_vis, l_hp_z), (r_hp, rh_vis, r_hp_z) = (
            pt(self.mp_pose.PoseLandmark.LEFT_HIP),
            pt(self.mp_pose.PoseLandmark.RIGHT_HIP),
        )
        (l_er, le_vis, l_er_z), (r_er, re_vis, r_er_z) = (
            pt(self.mp_pose.PoseLandmark.LEFT_EAR),
            pt(self.mp_pose.PoseLandmark.RIGHT_EAR),
        )
        (nose_xy, n_vis, nose_z) = pt(self.mp_pose.PoseLandmark.NOSE)

        mid_shoulder = (l_sh + r_sh) / 2.0
        mid_hip = (l_hp + r_hp) / 2.0
        shoulder_width = max(abs(l_sh[0] - r_sh[0]), 1e-3)

        # Neck
        neck_forward_x = round(
            float(abs(nose_xy[0] - mid_shoulder[0]) / shoulder_width), 4
        )
        shoulder_z = (l_sh_z + r_sh_z) / 2.0
        neck_forward_z = round(float(nose_z - shoulder_z), 4)
        neck_bad = (neck_forward_x > self.NECK_FORWARD_THRESHOLD_X) or (
            neck_forward_z > self.NECK_FORWARD_THRESHOLD_Z
        )

        # Spine
        spine_vec = mid_shoulder - mid_hip
        vertical = np.array([0.0, -1.0])
        denom = (np.linalg.norm(spine_vec) * np.linalg.norm(vertical)) + 1e-9
        cos_val = np.clip(np.dot(spine_vec, vertical) / denom, -1.0, 1.0)
        spine_angle = round(float(np.degrees(np.arccos(cos_val))), 2)
        spine_bad = spine_angle > self.SPINE_ANGLE_THRESHOLD

        # Lean
        shoulder_height_diff = float(abs(l_sh[1] - r_sh[1]))
        lean_angle = round(
            float(np.degrees(np.arctan2(shoulder_height_diff, shoulder_width))), 2
        )
        leaning = lean_angle > self.LEAN_THRESHOLD
        leaning_direction = None
        if leaning:
            leaning_direction = "LEFT" if l_sh[1] > r_sh[1] else "RIGHT"

        # Head tilt
        head_tilt_val = abs(l_er[1] - r_er[1])
        head_tilt = head_tilt_val > self.HEAD_TILT_THRESHOLD

        # Score
        raw_score = 100
        if neck_bad:
            raw_score -= 7
        if spine_bad:
            raw_score -= 50
        if leaning:
            raw_score -= 40
        if head_tilt:
            raw_score -= 40
        raw_score = max(0, raw_score)

        # Smoothing
        self.smoothed_score = (self.smoothing_alpha * raw_score) + (
            (1.0 - self.smoothing_alpha) * self.smoothed_score
        )
        score = int(round(self.smoothed_score))

        # Bad posture timing with grace
        current_time = time.time()
        current_is_bad = score < 65

        if current_is_bad:
            if not self.is_bad_posture:
                within_grace = (
                    current_time - self.last_good_posture_time
                ) <= self.grace_period
                if within_grace and self.bad_posture_duration > 0:
                    self.bad_posture_start_time = (
                        current_time - self.bad_posture_duration
                    )
                else:
                    self.bad_posture_start_time = current_time
                    self.bad_posture_duration = 0.0
                self.is_bad_posture = True
            else:
                self.bad_posture_duration = current_time - self.bad_posture_start_time
        else:
            if self.is_bad_posture:
                self.last_good_posture_time = current_time
            self.is_bad_posture = False
            self.bad_posture_duration = 0.0

        # Should fire notification?
        should_notify = False
        notify_msg = ""
        if (
            self.is_bad_posture
            and self.bad_posture_duration > self.notification_cooldown
        ):
            if current_time - self.last_notification_time > self.notification_cooldown:
                self.last_notification_time = current_time
                should_notify = True
                notify_msg = f"Bad posture for {int(self.bad_posture_duration)}s!"
                if neck_bad:
                    notify_msg += " Neck forward."
                if spine_bad:
                    notify_msg += " Spine misaligned."
                if leaning:
                    notify_msg += f" Leaning {leaning_direction}."
                if head_tilt:
                    notify_msg += " Head tilted."

        return {
            "timestamp": float(current_time),
            "posture_score": score,
            "neck_bad": bool(neck_bad),
            "spine_bad": bool(spine_bad),
            "leaning": bool(leaning),
            "leaning_direction": leaning_direction,
            "head_tilt": bool(head_tilt),
            "neck_forward_x": float(neck_forward_x),
            "neck_forward_z": float(neck_forward_z),
            "spine_angle_val": float(spine_angle),
            "lean_angle_val": float(lean_angle),
            "bad_posture_duration": float(
                self.bad_posture_duration if self.is_bad_posture else 0.0
            ),
            "should_notify": should_notify,
            "notify_msg": notify_msg,
        }

    # ── New method — receives base64 frame from browser ───────────
    def analyze_frame(self, base64_jpeg: str) -> Optional[dict]:
        try:
            img_bytes = base64.b64decode(base64_jpeg)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if image is None:
                return None

            # Resize to max 480p for speed
            h, w = image.shape[:2]
            if w > 640:
                scale = 640 / w
                image = cv2.resize(image, (640, int(h * scale)))

            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.pose.process(rgb)

            if not results.pose_landmarks:
                return None

            return self.analyze_posture(results.pose_landmarks.landmark)

        except Exception as e:
            print(f"[PostureDetector] analyze_frame error: {e}")
            return None
