import cv2
import numpy as np
import mediapipe as mp

class EyeStrainAnalyzer:
    def __init__(self, pitch_threshold_deg=30.0, distance_threshold_ratio=0.4, ear_threshold=0.2):
        """
        Args:
            pitch_threshold_deg: head tilt above which = bad posture (default 30°)
            distance_threshold_ratio: face width / frame width, above which = too close
            ear_threshold: Eye Aspect Ratio below which eye is considered closed (default 0.2)
        """
        self.pitch_threshold = pitch_threshold_deg
        self.distance_threshold = distance_threshold_ratio
        self.ear_threshold = ear_threshold
        
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
    
    def _eye_aspect_ratio(self, landmarks, eye_indices):
        """
        Calculate EAR for one eye given its 6 landmark indices.
        eye_indices: list of 6 indices in order: 
            p1, p2, p3, p4, p5, p6 (see MediaPipe face mesh)
        Returns float (0 = closed, ~0.25 = open)
        """
        # Get coordinates
        points = []
        for idx in eye_indices:
            point = landmarks.landmark[idx]
            points.append([point.x, point.y])
        points = np.array(points)
        
        # Vertical distances
        # p2 and p6 (indices 1 and 5 in our list)
        vert1 = np.linalg.norm(points[1] - points[5])
        # p3 and p5 (indices 2 and 4)
        vert2 = np.linalg.norm(points[2] - points[4])
        # Horizontal distance (p1 and p4, indices 0 and 3)
        horiz = np.linalg.norm(points[0] - points[3])
        
        if horiz == 0:
            return 0.25  # fallback
        
        ear = (vert1 + vert2) / (2.0 * horiz)
        return ear
    
    def _get_eyes_status(self, landmarks):
        """
        Returns (left_ear, right_ear, eyes_closed)
        eyes_closed is True if both EAR < threshold, else False.
        """
        # Left eye landmarks (indices from MediaPipe)
        LEFT_EYE = [33, 160, 158, 133, 153, 144]   # approximate order
        RIGHT_EYE = [362, 385, 387, 263, 373, 380]
        
        left_ear = self._eye_aspect_ratio(landmarks, LEFT_EYE)
        right_ear = self._eye_aspect_ratio(landmarks, RIGHT_EYE)
        ear = (left_ear + right_ear) / 2.0
        eyes_closed = (left_ear < self.ear_threshold) and (right_ear < self.ear_threshold)
        return left_ear, right_ear, eyes_closed
    
    def _estimate_head_pitch(self, landmarks, image_shape):
        """Same as before, using nose tip and eyes."""
        h, w = image_shape[:2]
        nose_tip = landmarks.landmark[1]
        left_eye = landmarks.landmark[33]
        right_eye = landmarks.landmark[263]
        
        eye_y_avg = (left_eye.y + right_eye.y) / 2.0
        delta_y_px = (nose_tip.y - eye_y_avg) * h
        eye_dist_px = abs(left_eye.x - right_eye.x) * w
        if eye_dist_px < 1e-6:
            return 0.0
        ref_len_px = eye_dist_px * 0.6
        pitch_rad = np.arctan2(delta_y_px, ref_len_px)
        return np.degrees(pitch_rad)
    
    def _estimate_face_width_ratio(self, landmarks, image_shape):
        w = image_shape[1]
        left_cheek = landmarks.landmark[234].x
        right_cheek = landmarks.landmark[454].x
        return (right_cheek - left_cheek)
    
    def process_frame(self, frame_bgr):
        """
        Returns dict with:
            - face_detected (bool)
            - head_pitch_deg (float)
            - face_width_ratio (float)
            - posture_ok (bool)
            - distance_ok (bool)
            - left_ear (float)
            - right_ear (float)
            - eyes_closed (bool)   # true if both eyes closed
        """
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(frame_rgb)
        
        output = {
            'face_detected': False,
            'head_pitch_deg': 0.0,
            'face_width_ratio': 0.0,
            'posture_ok': True,
            'distance_ok': True,
            'left_ear': 0.0,
            'right_ear': 0.0,
            'eyes_closed': False
        }
        
        if not results.multi_face_landmarks:
            return output
        
        landmarks = results.multi_face_landmarks[0]
        output['face_detected'] = True
        output['head_pitch_deg'] = self._estimate_head_pitch(landmarks, frame_bgr.shape)
        output['face_width_ratio'] = self._estimate_face_width_ratio(landmarks, frame_bgr.shape)
        output['posture_ok'] = output['head_pitch_deg'] < self.pitch_threshold
        output['distance_ok'] = output['face_width_ratio'] < self.distance_threshold
        
        # Eye metrics
        left_ear, right_ear, eyes_closed = self._get_eyes_status(landmarks)
        output['left_ear'] = left_ear
        output['right_ear'] = right_ear
        output['eyes_closed'] = eyes_closed
        
        return output