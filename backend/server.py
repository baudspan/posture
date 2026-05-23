import asyncio
import base64
import json
import math
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import websockets

try:
    import winsound
except ImportError:
    winsound = None


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


HOST = "localhost"
PORT = 8765
FRAME_INTERVAL_SEC = 0.2
BREAK_INTERVAL_SEC = 20 * 60
DEFAULT_ALERT_COOLDOWN_SEC = 5

SKELETON_EDGES = [
    [0, 11], [0, 12],
    [11, 12],
    [11, 13], [12, 14],
    [11, 23], [12, 24],
    [23, 24],
]

ALERT_TONES = {
    "posture": (880, 300),
    "distance": (880, 300),
    "blink": (440, 200),
    "break": (660, 500),
}


@dataclass
class SessionState:
    frame_index: int = 0
    started_at: float = field(default_factory=time.time)
    break_started_at: float = field(default_factory=time.time)
    blink_count: int = 0
    previous_eyes_closed: bool = False
    calibration_status: str = "idle"
    calibration_progress: int = 0
    paused: bool = False
    pitch_threshold_deg: float = 30.0
    distance_threshold_ratio: float = 0.4
    ear_threshold: float = 0.3
    break_interval_sec: int = BREAK_INTERVAL_SEC
    sound_alerts_enabled: bool = True
    alert_cooldown_sec: int = DEFAULT_ALERT_COOLDOWN_SEC
    last_posture_alert_at: float = 0
    last_distance_alert_at: float = 0
    last_blink_alert_at: float = 0
    last_break_alert_at: float = 0

    def reset(self) -> None:
        now = time.time()
        self.frame_index = 0
        self.started_at = now
        self.break_started_at = now
        self.blink_count = 0
        self.previous_eyes_closed = False
        self.calibration_status = "idle"
        self.calibration_progress = 0
        self.paused = False
        self.last_posture_alert_at = 0
        self.last_distance_alert_at = 0
        self.last_blink_alert_at = 0
        self.last_break_alert_at = 0


class OpenCVEyeStrainAnalyzer:
    def __init__(self, pitch_threshold_deg: float = 30.0, distance_threshold_ratio: float = 0.4, ear_threshold: float = 0.3):
        self.pitch_threshold = pitch_threshold_deg
        self.distance_threshold = distance_threshold_ratio
        self.ear_threshold = ear_threshold
        cascade_dir = Path(cv2.data.haarcascades)
        self.face_cascades = [
            cv2.CascadeClassifier(str(cascade_dir / "haarcascade_frontalface_default.xml")),
            cv2.CascadeClassifier(str(cascade_dir / "haarcascade_frontalface_alt2.xml")),
            cv2.CascadeClassifier(str(cascade_dir / "haarcascade_profileface.xml")),
        ]
        self.eye_cascade = cv2.CascadeClassifier(str(cascade_dir / "haarcascade_eye.xml"))

    def process_frame(self, frame_bgr: Any) -> dict[str, Any]:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        frame_h, frame_w = gray.shape[:2]
        min_face_size = max(45, min(frame_w, frame_h) // 10)
        faces = []
        for cascade in self.face_cascades:
            detected = cascade.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(min_face_size, min_face_size),
            )
            faces.extend(detected)

        if len(faces) == 0:
            flipped = cv2.flip(gray, 1)
            for cascade in self.face_cascades:
                detected = cascade.detectMultiScale(
                    flipped,
                    scaleFactor=1.05,
                    minNeighbors=3,
                    minSize=(min_face_size, min_face_size),
                )
                for x, y, w, h in detected:
                    faces.append((frame_w - x - w, y, w, h))

        output = {
            "face_detected": False,
            "head_pitch_deg": 0.0,
            "face_width_ratio": 0.0,
            "head_offset_norm": 0.0,
            "posture_ok": True,
            "distance_ok": True,
            "left_ear": 0.27,
            "right_ear": 0.27,
            "eyes_closed": False,
        }

        if len(faces) == 0:
            return output

        x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
        face_width_ratio = w / max(frame_w, 1)
        face_center_x = x + w / 2
        head_offset_norm = (face_center_x - frame_w / 2) / max(frame_w, 1)

        upper_face = gray[y:y + max(1, h // 2), x:x + w]
        eyes = self.eye_cascade.detectMultiScale(
            upper_face,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(12, 8),
        )

        eyes_closed = len(eyes) < 2
        eye_center_y = y + h * 0.35
        if len(eyes) >= 2:
            two_eyes = sorted(eyes, key=lambda eye: eye[2] * eye[3], reverse=True)[:2]
            eye_center_y = y + sum(eye[1] + eye[3] / 2 for eye in two_eyes) / 2

        face_center_y = y + h / 2
        pitch = max(0.0, min(60.0, ((face_center_y - eye_center_y) / max(h, 1) - 0.16) * 160))
        ear = 0.08 if eyes_closed else 0.27

        output.update({
            "face_detected": True,
            "head_pitch_deg": pitch,
            "face_width_ratio": face_width_ratio,
            "head_offset_norm": head_offset_norm,
            "posture_ok": pitch < self.pitch_threshold,
            "distance_ok": face_width_ratio < self.distance_threshold,
            "left_ear": ear,
            "right_ear": ear,
            "eyes_closed": eyes_closed,
        })
        return output


def play_beep(alert_type: str) -> None:
    frequency, duration_ms = ALERT_TONES.get(alert_type, ALERT_TONES["posture"])

    def _play() -> None:
        if winsound is not None:
            winsound.Beep(frequency, duration_ms)
        else:
            print("\a", end="", flush=True)

    threading.Thread(target=_play, daemon=True).start()


def maybe_play_alert(state: SessionState, alert_type: str, now: float) -> None:
    if not state.sound_alerts_enabled:
        return

    attr = f"last_{alert_type}_alert_at"
    last_alert_at = getattr(state, attr)
    if now - last_alert_at < state.alert_cooldown_sec:
        return

    setattr(state, attr, now)
    play_beep(alert_type)


def get_distance_status(face_width_ratio: float) -> str:
    if face_width_ratio >= 0.4:
        return "TOO_CLOSE"
    if face_width_ratio < 0.2:
        return "TOO_FAR"
    return "GOOD"


def get_blink_status(blink_rate: float) -> str:
    if blink_rate < 8:
        return "Very Low"
    if blink_rate < 12:
        return "Low"
    return "Normal"


def make_skeleton(frame_index: int, head_offset_norm: float = 0.0) -> dict[str, Any]:
    t = frame_index * FRAME_INTERVAL_SEC
    breathe = math.sin(t) * 0.005
    head_x = 0.5 + head_offset_norm
    left_shoulder_y = 0.42 + breathe
    right_shoulder_y = 0.42 - breathe

    return {
        "landmarks": [
            {"id": 0, "x": head_x, "y": 0.22 + math.cos(t * 0.3) * 0.005},
            {"id": 11, "x": 0.40, "y": left_shoulder_y},
            {"id": 12, "x": 0.60, "y": right_shoulder_y},
            {"id": 13, "x": 0.36, "y": left_shoulder_y + 0.18},
            {"id": 14, "x": 0.64, "y": right_shoulder_y + 0.18},
            {"id": 23, "x": 0.43, "y": 0.75},
            {"id": 24, "x": 0.57, "y": 0.75},
        ],
        "edges": SKELETON_EDGES,
    }


def build_payload(state: SessionState, metrics: dict[str, Any]) -> dict[str, Any]:
    now = time.time()
    state.frame_index += 1

    if metrics["eyes_closed"] and not state.previous_eyes_closed:
        state.blink_count += 1
    state.previous_eyes_closed = metrics["eyes_closed"]

    elapsed_sec = max(0, int(now - state.started_at))
    blink_rate = round((state.blink_count / elapsed_sec) * 60, 1) if elapsed_sec > 10 else 14.5

    if state.calibration_status == "in_progress":
        state.calibration_progress = min(100, state.calibration_progress + 10)
        if state.calibration_progress >= 100:
            state.calibration_status = "complete"
    elif state.calibration_status == "complete":
        state.calibration_status = "idle"
        state.calibration_progress = 0

    face_detected = bool(metrics["face_detected"])
    pitch = float(metrics["head_pitch_deg"])
    face_width_ratio = float(metrics["face_width_ratio"])
    head_offset_norm = float(metrics.get("head_offset_norm", 0.0))

    neck_score = max(0, min(100, round(100 - abs(pitch) * 1.7)))
    hunch_score = max(0, min(100, round(100 - max(0, pitch - 10) * 2.0)))
    shoulder_score = 90 if face_detected else 0
    skeleton = make_skeleton(state.frame_index, head_offset_norm)

    active_issues = []
    if not face_detected:
        active_issues.append("Face not detected")
    if face_detected and pitch > state.pitch_threshold_deg:
        active_issues.append("Slouching")
        maybe_play_alert(state, "posture", now)
    if face_detected and face_width_ratio > state.distance_threshold_ratio:
        active_issues.append("Too close to screen")
        maybe_play_alert(state, "distance", now)
    if face_detected and head_offset_norm < -0.06:
        active_issues.append("Leaning left")
    if face_detected and head_offset_norm > 0.06:
        active_issues.append("Leaning right")
    if face_detected and blink_rate < 8:
        maybe_play_alert(state, "blink", now)

    break_countdown = state.break_interval_sec - int(now - state.break_started_at)
    if break_countdown <= 0:
        maybe_play_alert(state, "break", now)
        state.break_started_at = now
        break_countdown = state.break_interval_sec

    return {
        "timestamp": now,
        "frame_index": state.frame_index,
        "face_detected": face_detected,
        "head_pitch_deg": round(pitch, 1),
        "face_width_ratio": round(face_width_ratio, 3),
        "distance_status": get_distance_status(face_width_ratio),
        "left_ear": round(float(metrics["left_ear"]), 3),
        "right_ear": round(float(metrics["right_ear"]), 3),
        "ear_avg": round((float(metrics["left_ear"]) + float(metrics["right_ear"])) / 2, 3),
        "eyes_closed": bool(metrics["eyes_closed"]),
        "blink_count_session": state.blink_count,
        "blink_rate_per_min": blink_rate,
        "blink_status": get_blink_status(blink_rate),
        "calibration_status": state.calibration_status,
        "calibration_progress": state.calibration_progress,
        "session_elapsed_sec": elapsed_sec,
        "break_countdown_sec": max(0, break_countdown),
        "shoulder_score": shoulder_score,
        "neck_score": neck_score if face_detected else 0,
        "hunch_score": hunch_score if face_detected else 0,
        "head_offset_norm": round(head_offset_norm, 3),
        "active_issues": active_issues,
        "skeleton_landmarks": skeleton["landmarks"],
        "skeleton_edges": skeleton["edges"],
    }


def build_camera_unavailable_payload(state: SessionState) -> dict[str, Any]:
    now = time.time()
    state.frame_index += 1
    elapsed_sec = max(0, int(now - state.started_at))
    break_countdown = state.break_interval_sec - int(now - state.break_started_at)
    skeleton = make_skeleton(state.frame_index)

    return {
        "timestamp": now,
        "frame_index": state.frame_index,
        "face_detected": False,
        "head_pitch_deg": 0,
        "face_width_ratio": 0,
        "distance_status": "GOOD",
        "left_ear": 0,
        "right_ear": 0,
        "ear_avg": 0,
        "eyes_closed": False,
        "blink_count_session": state.blink_count,
        "blink_rate_per_min": 0,
        "blink_status": "Very Low",
        "calibration_status": state.calibration_status,
        "calibration_progress": state.calibration_progress,
        "session_elapsed_sec": elapsed_sec,
        "break_countdown_sec": max(0, break_countdown),
        "shoulder_score": 0,
        "neck_score": 0,
        "hunch_score": 0,
        "head_offset_norm": 0,
        "active_issues": ["Camera unavailable"],
        "skeleton_landmarks": skeleton["landmarks"],
        "skeleton_edges": skeleton["edges"],
    }


async def handle_actions(websocket: Any, state: SessionState) -> None:
    async for message in websocket:
        try:
            payload = json.loads(message)
            action = payload.get("action")
        except json.JSONDecodeError:
            continue

        if action == "startCalibration":
            state.calibration_status = "in_progress"
            state.calibration_progress = 0
        elif action == "pauseStream":
            state.paused = True
        elif action == "resumeStream":
            state.paused = False
        elif action == "endSessionStream":
            state.reset()
        elif action == "updateSettings":
            settings = payload.get("settings", {})
            if isinstance(settings.get("sound_alerts_enabled"), bool):
                state.sound_alerts_enabled = settings["sound_alerts_enabled"]
            if isinstance(settings.get("alert_cooldown_sec"), (int, float)):
                state.alert_cooldown_sec = max(1, int(settings["alert_cooldown_sec"]))
            if isinstance(settings.get("pitch_threshold_deg"), (int, float)):
                state.pitch_threshold_deg = float(settings["pitch_threshold_deg"])
            if isinstance(settings.get("distance_threshold_ratio"), (int, float)):
                state.distance_threshold_ratio = float(settings["distance_threshold_ratio"])
            if isinstance(settings.get("ear_threshold"), (int, float)):
                state.ear_threshold = float(settings["ear_threshold"])
            if isinstance(settings.get("break_interval_min"), (int, float)):
                state.break_interval_sec = max(1, int(settings["break_interval_min"])) * 60


def decode_frame(image: str) -> Any | None:
    if "," in image:
        image = image.split(",", 1)[1]

    try:
        frame_bytes = base64.b64decode(image)
    except (ValueError, TypeError):
        return None

    buffer = np.frombuffer(frame_bytes, dtype=np.uint8)
    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)


async def stream_metrics(websocket: Any) -> None:
    state = SessionState()
    analyzer = OpenCVEyeStrainAnalyzer()
    print("Frontend connected. Waiting for browser camera frames.")

    try:
        while True:
            message = await websocket.recv()
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                continue

            action = payload.get("action")
            if action == "startCalibration":
                state.calibration_status = "in_progress"
                state.calibration_progress = 0
            elif action == "pauseStream":
                state.paused = True
            elif action == "resumeStream":
                state.paused = False
            elif action == "endSessionStream":
                state.reset()
            elif action == "updateSettings":
                settings = payload.get("settings", {})
                if isinstance(settings.get("sound_alerts_enabled"), bool):
                    state.sound_alerts_enabled = settings["sound_alerts_enabled"]
                if isinstance(settings.get("alert_cooldown_sec"), (int, float)):
                    state.alert_cooldown_sec = max(1, int(settings["alert_cooldown_sec"]))
                if isinstance(settings.get("pitch_threshold_deg"), (int, float)):
                    state.pitch_threshold_deg = float(settings["pitch_threshold_deg"])
                if isinstance(settings.get("distance_threshold_ratio"), (int, float)):
                    state.distance_threshold_ratio = float(settings["distance_threshold_ratio"])
                if isinstance(settings.get("ear_threshold"), (int, float)):
                    state.ear_threshold = float(settings["ear_threshold"])
                if isinstance(settings.get("break_interval_min"), (int, float)):
                    state.break_interval_sec = max(1, int(settings["break_interval_min"])) * 60

            if payload.get("type") != "frame" or state.paused:
                continue

            frame = decode_frame(str(payload.get("image", "")))
            if frame is None:
                continue

            analyzer.pitch_threshold = state.pitch_threshold_deg
            analyzer.distance_threshold = state.distance_threshold_ratio
            analyzer.ear_threshold = state.ear_threshold
            await websocket.send(json.dumps(build_payload(state, analyzer.process_frame(frame))))
    finally:
        print("Frontend disconnected.")


async def main() -> None:
    print(f"Backend running at ws://{HOST}:{PORT}/ws")
    async with websockets.serve(stream_metrics, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Backend stopped.")
