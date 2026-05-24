import cv2
import numpy as np
import mediapipe as mp
import os

class EyeStrainAnalyzer:
    def __init__(self, pitch_threshold_deg=38.0, roll_threshold_deg=15.0,
                 distance_threshold_ratio=0.4, ear_threshold=0.2,
                 model_path=None):
        """
        Args:
            pitch_threshold_deg: forward head tilt above which = bad posture (default 38°)
            roll_threshold_deg: side head tilt (absolute) above which = poor posture (default 15°)
            distance_threshold_ratio: face width / frame width, above which = too close
            ear_threshold: Eye Aspect Ratio below which eye is considered closed
            model_path: path to face_landmarker.task model file
        """
        self.pitch_threshold = pitch_threshold_deg
        self.roll_threshold = roll_threshold_deg
        self.distance_threshold = distance_threshold_ratio
        self.ear_threshold = ear_threshold
        self._frame_count = 0

        # Locate model file
        if model_path is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(script_dir, "face_landmarker.task")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"face_landmarker.task not found at: {model_path}\n"
                "Download it from: https://storage.googleapis.com/mediapipe-models/"
                "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            )

        VisionTaskRunningMode = mp.tasks.vision.RunningMode
        FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
        BaseOptions = mp.tasks.BaseOptions

        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.face_landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)

    def _eye_aspect_ratio(self, landmarks, eye_indices):
        points = np.array([[landmarks[i].x, landmarks[i].y] for i in eye_indices])
        vert1 = np.linalg.norm(points[1] - points[5])
        vert2 = np.linalg.norm(points[2] - points[4])
        horiz = np.linalg.norm(points[0] - points[3])
        if horiz == 0:
            return 0.25
        return (vert1 + vert2) / (2.0 * horiz)

    def _get_eyes_status(self, landmarks):
        LEFT_EYE  = [33, 160, 158, 133, 153, 144]
        RIGHT_EYE = [362, 385, 387, 263, 373, 380]
        left_ear  = self._eye_aspect_ratio(landmarks, LEFT_EYE)
        right_ear = self._eye_aspect_ratio(landmarks, RIGHT_EYE)
        eyes_closed = (left_ear < self.ear_threshold) and (right_ear < self.ear_threshold)
        return left_ear, right_ear, eyes_closed

    def _estimate_head_pitch(self, landmarks, image_shape):
        h, w = image_shape[:2]
        nose_tip  = landmarks[1]
        left_eye  = landmarks[33]
        right_eye = landmarks[263]
        eye_y_avg   = (left_eye.y + right_eye.y) / 2.0
        delta_y_px  = (nose_tip.y - eye_y_avg) * h
        eye_dist_px = abs(left_eye.x - right_eye.x) * w
        if eye_dist_px < 1e-6:
            return 0.0
        ref_len_px = eye_dist_px * 0.6
        return np.degrees(np.arctan2(delta_y_px, ref_len_px))

    def _estimate_head_roll(self, landmarks, image_shape):
        left_eye_outer  = landmarks[33]
        right_eye_outer = landmarks[263]
        dx = right_eye_outer.x - left_eye_outer.x
        dy = right_eye_outer.y - left_eye_outer.y
        return np.degrees(np.arctan2(dy, dx))

    def _estimate_face_width_ratio(self, landmarks, image_shape):
        left_cheek  = landmarks[234].x
        right_cheek = landmarks[454].x
        return right_cheek - left_cheek

    def process_frame(self, frame_bgr):
        import time
        self._frame_count += 1

        output = {
            'face_detected': False,
            'head_pitch_deg': 0.0,
            'head_roll_deg': 0.0,
            'face_width_ratio': 0.0,
            'posture_ok': True,
            'roll_ok': True,
            'distance_ok': True,
            'left_ear': 0.0,
            'right_ear': 0.0,
            'eyes_closed': False,
        }

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        timestamp_ms = int(time.time() * 1000)
        results = self.face_landmarker.detect_for_video(mp_image, timestamp_ms)

        if not results.face_landmarks:
            return output

        landmarks = results.face_landmarks[0]   # list of NormalizedLandmark
        output['face_detected'] = True
        output['head_pitch_deg']    = self._estimate_head_pitch(landmarks, frame_bgr.shape)
        output['head_roll_deg']     = self._estimate_head_roll(landmarks, frame_bgr.shape)
        output['face_width_ratio']  = self._estimate_face_width_ratio(landmarks, frame_bgr.shape)

        output['posture_ok'] = (
            output['head_pitch_deg'] < self.pitch_threshold and
            abs(output['head_roll_deg']) < self.roll_threshold
        )
        output['roll_ok']     = abs(output['head_roll_deg']) < self.roll_threshold
        output['distance_ok'] = output['face_width_ratio'] < self.distance_threshold

        left_ear, right_ear, eyes_closed = self._get_eyes_status(landmarks)
        output['left_ear']    = left_ear
        output['right_ear']   = right_ear
        output['eyes_closed'] = eyes_closed

        return output

    def close(self):
        self.face_landmarker.close()