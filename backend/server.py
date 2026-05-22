import asyncio
import json
import math
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import websockets

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from eyestrain_ml import EyeStrainAnalyzer


HOST = "localhost"
PORT = 8765
FRAME_INTERVAL_SEC = 0.15
BREAK_INTERVAL_SEC = 20 * 60

SKELETON_EDGES = [
    [0, 11], [0, 12],
    [11, 12],
    [11, 13], [12, 14],
    [11, 23], [12, 24],
    [23, 24],
]


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


def make_skeleton(frame_index: int) -> dict[str, Any]:
    t = frame_index * FRAME_INTERVAL_SEC
    breathe = math.sin(t) * 0.005
    left_shoulder_y = 0.42 + breathe
    right_shoulder_y = 0.42 - breathe

    return {
        "landmarks": [
            {"id": 0, "x": 0.5 + math.sin(t * 0.5) * 0.01, "y": 0.22 + math.cos(t * 0.3) * 0.005},
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

    pitch = float(metrics["head_pitch_deg"])
    face_width_ratio = float(metrics["face_width_ratio"])
    neck_score = max(0, min(100, round(100 - abs(pitch) * 1.7)))
    hunch_score = max(0, min(100, round(100 - max(0, pitch - 10) * 2.0)))
    skeleton = make_skeleton(state.frame_index)

    active_issues = []
    if metrics["face_detected"] and pitch > 30:
        active_issues.append("Slouching")
    if metrics["face_detected"] and face_width_ratio > 0.4:
        active_issues.append("Too close to screen")

    break_countdown = BREAK_INTERVAL_SEC - int(now - state.break_started_at)
    if break_countdown <= 0:
        state.break_started_at = now
        break_countdown = BREAK_INTERVAL_SEC

    return {
        "timestamp": now,
        "frame_index": state.frame_index,
        "face_detected": bool(metrics["face_detected"]),
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
        "shoulder_score": 90,
        "neck_score": neck_score,
        "hunch_score": hunch_score,
        "head_offset_norm": 0.0,
        "active_issues": active_issues,
        "skeleton_landmarks": skeleton["landmarks"],
        "skeleton_edges": skeleton["edges"],
    }


async def handle_actions(websocket: Any, state: SessionState) -> None:
    async for message in websocket:
        try:
            action = json.loads(message).get("action")
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


async def stream_metrics(websocket: Any) -> None:
    state = SessionState()
    analyzer = EyeStrainAnalyzer(pitch_threshold_deg=30.0, distance_threshold_ratio=0.4, ear_threshold=0.3)
    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        raise RuntimeError("Could not open webcam. Close other camera apps, then run python server.py again.")

    action_task = asyncio.create_task(handle_actions(websocket, state))
    print("Frontend connected. Streaming posture metrics.")

    try:
        while True:
            if state.paused:
                await asyncio.sleep(FRAME_INTERVAL_SEC)
                continue

            ok, frame = camera.read()
            if ok:
                metrics = analyzer.process_frame(frame)
                await websocket.send(json.dumps(build_payload(state, metrics)))

            await asyncio.sleep(FRAME_INTERVAL_SEC)
    finally:
        action_task.cancel()
        camera.release()
        print("Frontend disconnected. Webcam released.")


async def main() -> None:
    print(f"Backend running at ws://{HOST}:{PORT}")
    async with websockets.serve(stream_metrics, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Backend stopped.")
