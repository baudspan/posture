import asyncio
import json
import sys
import threading
import time
from pathlib import Path

import cv2
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from eyestrain_ml import EyeStrainAnalyzer

try:
    import winsound
except ImportError:
    winsound = None


app = FastAPI(title="Posture Guard Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

POSE_IDS = [0, 11, 12, 13, 14, 23, 24]
SKELETON_EDGES = [
    [0, 11],
    [0, 12],
    [11, 12],
    [11, 13],
    [12, 14],
    [11, 23],
    [12, 24],
    [23, 24],
]

ALERT_COOLDOWN_SEC = 5
ALERT_TONES = {
    "posture": (880, 300),
    "distance": (880, 300),
    "blink": (440, 200),
    "break": (660, 500),
}


def play_beep(alert_type="posture"):
    frequency, duration_ms = ALERT_TONES.get(alert_type, ALERT_TONES["posture"])

    def _play():
        if winsound is not None:
            winsound.Beep(frequency, duration_ms)
        else:
            print("\a", end="", flush=True)

    threading.Thread(target=_play, daemon=True).start()


class BlinkTracker:
    def __init__(self, window_sec=60):
        self.window_sec = window_sec
        self.timestamps = []
        self.count = 0
        self.last_closed = False

    def update(self, eyes_closed):
        now = time.time()
        if eyes_closed and not self.last_closed:
            self.timestamps.append(now)
            self.count += 1

        self.last_closed = eyes_closed
        self.timestamps = [t for t in self.timestamps if now - t <= self.window_sec]

    def rate_per_min(self):
        if len(self.timestamps) < 2:
            return 0.0

        duration_min = (self.timestamps[-1] - self.timestamps[0]) / 60
        if duration_min <= 0:
            return 0.0

        return round(min(len(self.timestamps) / duration_min, 60.0), 1)

    def status(self):
        rate = self.rate_per_min()
        if rate < 8:
            return "Very Low"
        if rate < 12:
            return "Low"
        return "Normal"


class PostureBackend:
    def __init__(self):
        self.analyzer = EyeStrainAnalyzer(
            pitch_threshold_deg=30,
            distance_threshold_ratio=0.4,
            ear_threshold=0.3,
        )
        self.pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.blinks = BlinkTracker()
        self.frame_index = 0
        self.started_at = time.time()
        self.break_interval_sec = 20 * 60
        self.calibrating = False
        self.calibration_started_at = 0
        self.paused = False
        self.sound_alerts_enabled = True
        self.last_alert_at = {
            "posture": 0,
            "distance": 0,
            "blink": 0,
            "break": 0,
        }

    def handle_action(self, action):
        if action == "start_calibration":
            self.calibrating = True
            self.calibration_started_at = time.time()
        elif action == "pause":
            self.paused = True
        elif action == "resume":
            self.paused = False
        elif action == "end_session":
            self.__init__()

    def maybe_beep(self, alert_type):
        if not self.sound_alerts_enabled:
            return

        now = time.time()
        if now - self.last_alert_at.get(alert_type, 0) < ALERT_COOLDOWN_SEC:
            return

        self.last_alert_at[alert_type] = now
        play_beep(alert_type)

    def pose_metrics(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)

        landmarks = []
        shoulder_score = 90
        neck_score = 85
        hunch_score = 88
        head_offset_norm = 0.0
        active_issues = []

        if not results.pose_landmarks:
            return shoulder_score, neck_score, hunch_score, head_offset_norm, active_issues, landmarks

        lm = results.pose_landmarks.landmark

        for idx in POSE_IDS:
            point = lm[idx]
            landmarks.append({"id": idx, "x": round(point.x, 4), "y": round(point.y, 4)})

        nose = lm[0]
        left_shoulder = lm[11]
        right_shoulder = lm[12]
        left_hip = lm[23]
        right_hip = lm[24]

        shoulder_y_diff = abs(left_shoulder.y - right_shoulder.y)
        shoulder_score = max(0, min(100, round(100 - shoulder_y_diff * 500)))

        shoulder_mid_x = (left_shoulder.x + right_shoulder.x) / 2
        shoulder_mid_y = (left_shoulder.y + right_shoulder.y) / 2
        hip_mid_y = (left_hip.y + right_hip.y) / 2

        head_offset_norm = round(nose.x - shoulder_mid_x, 3)
        neck_forward = max(0, nose.y - shoulder_mid_y)
        torso_collapse = max(0, shoulder_mid_y - hip_mid_y + 0.32)

        neck_score = max(0, min(100, round(100 - abs(head_offset_norm) * 700 - neck_forward * 120)))
        hunch_score = max(0, min(100, round(100 - torso_collapse * 220)))

        if shoulder_score < 60:
            active_issues.append("Shoulder imbalance")
        if neck_score < 60:
            active_issues.append("Neck strain")
        if hunch_score < 60:
            active_issues.append("Hunching forward")
        if head_offset_norm < -0.06:
            active_issues.append("Leaning left")
        if head_offset_norm > 0.06:
            active_issues.append("Leaning right")

        return shoulder_score, neck_score, hunch_score, head_offset_norm, active_issues, landmarks

    def calibration_state(self):
        if not self.calibrating:
            return "idle", 0

        elapsed = time.time() - self.calibration_started_at
        progress = min(100, round((elapsed / 3) * 100))

        if progress >= 100:
            self.calibrating = False
            return "complete", 100

        return "in_progress", progress

    def process(self, frame):
        self.frame_index += 1

        face = self.analyzer.process_frame(frame)
        self.blinks.update(face["eyes_closed"])

        shoulder_score, neck_score, hunch_score, head_offset_norm, active_issues, skeleton = self.pose_metrics(frame)

        if face["head_pitch_deg"] > 30:
            active_issues.append("Slouching")
            self.maybe_beep("posture")
        if face["face_width_ratio"] > 0.4:
            active_issues.append("Too close to screen")
            self.maybe_beep("distance")

        face_width_ratio = round(float(face["face_width_ratio"]), 3)
        if face_width_ratio >= 0.4:
            distance_status = "TOO_CLOSE"
        elif face_width_ratio < 0.2:
            distance_status = "TOO_FAR"
        else:
            distance_status = "GOOD"

        calibration_status, calibration_progress = self.calibration_state()
        elapsed = int(time.time() - self.started_at)
        break_countdown = max(0, self.break_interval_sec - elapsed % self.break_interval_sec)

        if self.blinks.status() == "Very Low" and elapsed > 30:
            self.maybe_beep("blink")
        if break_countdown <= 1:
            self.maybe_beep("break")

        left_ear = round(float(face["left_ear"]), 3)
        right_ear = round(float(face["right_ear"]), 3)

        return {
            "timestamp": time.time(),
            "frame_index": self.frame_index,
            "face_detected": bool(face["face_detected"]),
            "head_pitch_deg": round(float(face["head_pitch_deg"]), 1),
            "face_width_ratio": face_width_ratio,
            "distance_status": distance_status,
            "left_ear": left_ear,
            "right_ear": right_ear,
            "ear_avg": round((left_ear + right_ear) / 2, 3),
            "eyes_closed": bool(face["eyes_closed"]),
            "blink_count_session": self.blinks.count,
            "blink_rate_per_min": self.blinks.rate_per_min(),
            "blink_status": self.blinks.status(),
            "calibration_status": calibration_status,
            "calibration_progress": calibration_progress,
            "session_elapsed_sec": elapsed,
            "break_countdown_sec": break_countdown,
            "shoulder_score": shoulder_score,
            "neck_score": neck_score,
            "hunch_score": hunch_score,
            "head_offset_norm": head_offset_norm,
            "active_issues": list(dict.fromkeys(active_issues)),
            "skeleton_landmarks": skeleton,
            "skeleton_edges": SKELETON_EDGES,
        }


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    backend = PostureBackend()
    cap = cv2.VideoCapture(0)

    try:
        while True:
            try:
                message = await asyncio.wait_for(ws.receive_text(), timeout=0.001)
                data = json.loads(message)
                backend.handle_action(data.get("action", ""))
            except asyncio.TimeoutError:
                pass
            except json.JSONDecodeError:
                pass

            if backend.paused:
                await asyncio.sleep(0.2)
                continue

            ok, frame = cap.read()
            if not ok:
                await ws.send_json({"error": "camera_unavailable"})
                await asyncio.sleep(1)
                continue

            await ws.send_json(backend.process(frame))
            await asyncio.sleep(0.2)

    except WebSocketDisconnect:
        pass
    finally:
        cap.release()
