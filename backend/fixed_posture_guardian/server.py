"""
server.py  –  Posture Guardian WebSocket backend
Streams JSON metrics to the React frontend at ws://localhost:8765
Run:  python server.py
"""

import asyncio
import json
import time
import base64

import cv2
import numpy as np
import pygame
import websockets
from eyestrain_ml import EyeStrainAnalyzer

# ── Audio beeps ───────────────────────────────────────────────────────────────
pygame.mixer.init()

def _make_beep(freq, dur):
    sr = 44100
    t  = np.arange(int(sr * dur)) / sr
    s  = (np.sin(2 * np.pi * freq * t) * 32767).astype(np.int16)
    stereo = np.column_stack((s, s))
    return pygame.sndarray.make_sound(stereo)

alert_sound = _make_beep(880, 0.3)
blink_sound  = _make_beep(440, 0.2)
break_sound  = _make_beep(660, 0.5)

# ── Blink tracker (same as before) ───────────────────────────────────────────
class BlinkTracker:
    def __init__(self, window_sec=60, min_bpm=10):
        self.window_sec = window_sec
        self.min_bpm    = min_bpm
        self.timestamps: list[float] = []
        self.last_alert = 0.0
        self.session_count = 0

    def add_blink(self):
        now = time.time()
        self.timestamps.append(now)
        self.session_count += 1
        self.timestamps = [t for t in self.timestamps if now - t <= self.window_sec]

    def rate(self) -> float:
        if len(self.timestamps) < 2:
            return 0.0
        span = (self.timestamps[-1] - self.timestamps[0]) / 60.0
        return min(len(self.timestamps) / span, 60.0) if span > 0.01 else 0.0

    def status(self) -> str:
        r = self.rate()
        if r > 12:  return "Normal"
        if r >= 8:  return "Low"
        return "Very Low"

    def should_alert(self) -> bool:
        now = time.time()
        if self.rate() < self.min_bpm and now - self.last_alert > 60:
            self.last_alert = now
            return True
        return False

    def reset(self):
        self.timestamps.clear()
        self.session_count = 0
        self.last_alert = 0.0

# ── Shared state (single camera, multiple WS clients welcome) ─────────────────
analyzer      = EyeStrainAnalyzer(pitch_threshold_deg=48.0, roll_threshold_deg=15.0,
                                   distance_threshold_ratio=0.4, ear_threshold=0.3)
blink_tracker = BlinkTracker()

cap: cv2.VideoCapture | None = None
last_blink_state   = False
last_posture_alert = 0.0
last_distance_alert= 0.0
last_break_time    = time.time()
break_interval     = 20 * 60          # 20 minutes
session_start      = time.time()
frame_index        = 0

CONNECTED_CLIENTS: set = set()
stream_paused: bool = True   # silent until frontend sends "resume" on login


# ── Runtime config (updated live from frontend settings) ─────────────────────
runtime = {
    "alert_cooldown_sec":    10,    # default; overridden by frontend
    "sound_alerts_enabled":  True,
    "show_skeleton_overlay": True,
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def _distance_status(ratio: float) -> str:
    if ratio >= analyzer.distance_threshold:   return "TOO_CLOSE"
    if ratio < 0.2:                            return "TOO_FAR"
    return "GOOD"

def _active_issues(metrics: dict, blink_rate: float,
                   pitch_ok: bool, roll_ok: bool, roll: float) -> list[str]:
    issues: list[str] = []
    if not metrics["face_detected"]:
        return issues
    if not pitch_ok:
        issues.append("Slouching forward")
    if not roll_ok:
        direction = "right" if roll > 0 else "left"
        issues.append(f"Head tilting {direction}")
    if not metrics["distance_ok"]:
        issues.append("Too close to screen")
    if blink_rate < 8 and blink_rate > 0:
        issues.append("Low blink rate")
    return issues

def _frame_to_jpeg_b64(frame: np.ndarray, quality: int = 60) -> str:
    """Encode an OpenCV BGR frame as a base64 JPEG string."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf.tobytes()).decode("ascii")

class _NumpySafeEncoder(json.JSONEncoder):
    """Converts numpy scalars to native Python types so json.dumps never chokes."""
    def default(self, obj):
        if isinstance(obj, np.integer):  return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.bool_):    return bool(obj)
        if isinstance(obj, np.ndarray):  return obj.tolist()
        return super().default(obj)


# ── Face skeleton: key landmark indices and edges ────────────────────────────
_FACE_SKELETON_INDICES = [
    10,338,297,332,284,251,389,356,454,323,361,288,
    397,365,379,378,400,377,152,148,176,149,150,136,
    172,58,132,93,234,127,162,21,54,103,67,109,
    33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7,
    362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382,
    70,63,105,66,107,336,296,334,293,300,
    1,2,98,327,168,6,197,195,5,
    61,185,40,39,37,0,267,269,270,409,291,
    146,91,181,84,17,314,405,321,375,308,
    78,191,80,81,82,13,312,311,310,415,308,
    95,88,178,87,14,317,402,318,324,308,
]
_seen_sk: set = set()
_FACE_KEY_INDICES = [i for i in _FACE_SKELETON_INDICES if not (i in _seen_sk or _seen_sk.add(i))]  # type: ignore

_FACE_SKELETON_EDGES = [
    [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],
    [389,356],[356,454],[454,323],[323,361],[361,288],[288,397],
    [397,365],[365,379],[379,378],[378,400],[400,377],[377,152],
    [152,148],[148,176],[176,149],[149,150],[150,136],[136,172],
    [172,58],[58,132],[132,93],[93,234],[234,127],[127,162],
    [162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
    [33,160],[160,158],[158,133],[133,153],[153,144],[144,33],
    [362,385],[385,387],[387,263],[263,373],[373,380],[380,362],
    [168,6],[6,197],[197,195],[195,5],[5,4],[4,1],
    [1,2],[2,98],[98,97],[97,2],
    [61,185],[185,40],[40,39],[39,37],[37,0],[0,267],
    [267,269],[269,270],[270,409],[409,291],[291,375],
    [375,321],[321,405],[405,314],[314,17],[17,84],
    [84,181],[181,91],[91,146],[146,61],
    [70,63],[63,105],[105,66],[66,107],
    [336,296],[296,334],[334,293],[293,300],
]

def _face_skeleton_landmarks(raw_landmarks: list) -> list:
    if not raw_landmarks:
        return []
    out = []
    for idx in _FACE_KEY_INDICES:
        if idx < len(raw_landmarks):
            lm = raw_landmarks[idx]
            out.append({"id": idx, "x": float(lm.x), "y": float(lm.y)})
    return out

# ── Camera capture loop (runs in a thread via asyncio executor) ───────────────
async def camera_loop(broadcast_fn):
    global cap, last_blink_state, last_posture_alert, last_distance_alert
    global last_break_time, frame_index

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    print("Camera open. Streaming to frontend…")

    loop = asyncio.get_event_loop()

    while True:
        ret, frame = await loop.run_in_executor(None, cap.read)
        if not ret:
            await asyncio.sleep(0.05)
            continue

        frame_index += 1
        now = time.time()

        # ── Skip ML + broadcast when paused or no clients, but keep reading
        # frames so the camera buffer never backs up and stalls on resume ───────
        if stream_paused or not CONNECTED_CLIENTS:
            await asyncio.sleep(0.033)   # ~30fps drain rate
            continue

        # ── Run ML analysis ──────────────────────────────────────────────────
        metrics = analyzer.process_frame(frame)

        pitch      = metrics["head_pitch_deg"]
        # head_roll_deg only in updated eyestrain_ml — safe fallback to 0
        roll       = metrics.get("head_roll_deg", 0.0)
        dist_ratio = metrics["face_width_ratio"]
        blink_rate = blink_tracker.rate()

        # Compute ok-flags here so server.py works with ANY version of eyestrain_ml
        pitch_ok   = metrics.get("pitch_ok",   pitch < analyzer.pitch_threshold)
        roll_ok    = metrics.get("roll_ok",    abs(roll) < analyzer.roll_threshold)
        posture_ok = metrics.get("posture_ok", pitch_ok and roll_ok)

        # ── Blink detection ──────────────────────────────────────────────────
        eyes_closed = metrics["eyes_closed"]
        if eyes_closed and not last_blink_state:
            blink_tracker.add_blink()
        last_blink_state = eyes_closed

        # ── Audio alerts ─────────────────────────────────────────────────────
        if metrics["face_detected"] and not posture_ok:
            if now - last_posture_alert > runtime["alert_cooldown_sec"]:
                if runtime["sound_alerts_enabled"]:
                    alert_sound.play()
                    print(f"[BEEP] Posture alert (cooldown={runtime['alert_cooldown_sec']}s)")
                else:
                    print("[MUTED] Posture alert suppressed (sound off)")
                last_posture_alert = now

        if metrics["face_detected"] and not metrics["distance_ok"]:
            if now - last_distance_alert > runtime["alert_cooldown_sec"]:
                if runtime["sound_alerts_enabled"]: alert_sound.play()
                last_distance_alert = now

        if blink_tracker.should_alert():
            if runtime["sound_alerts_enabled"]: blink_sound.play()

        if now - last_break_time > break_interval:
            if runtime["sound_alerts_enabled"]: break_sound.play()
            last_break_time = now

        # ── Build JSON payload (matches RawMetrics type exactly) ─────────────
        session_elapsed = int(now - session_start)
        break_remaining = max(0, int(break_interval - (now - last_break_time)))

        active_issues = _active_issues(metrics, blink_rate, pitch_ok, roll_ok, roll)

        payload = {
            # Timing
            "timestamp":           now,
            "frame_index":         frame_index,
            # Face / posture
            "face_detected":       metrics["face_detected"],
            "head_pitch_deg":      round(pitch, 2),
            "head_roll_deg":       round(roll, 2),
            "face_width_ratio":    round(dist_ratio, 3),
            "distance_status":     _distance_status(dist_ratio),
            "posture_ok":          posture_ok,
            "pitch_ok":            pitch_ok,
            "roll_ok":             roll_ok,
            # Eye / blink
            "left_ear":            round(metrics["left_ear"], 3),
            "right_ear":           round(metrics["right_ear"], 3),
            "ear_avg":             round((metrics["left_ear"] + metrics["right_ear"]) / 2, 3),
            "eyes_closed":         eyes_closed,
            "blink_count_session": blink_tracker.session_count,
            "blink_rate_per_min":  round(blink_rate, 1),
            "blink_status":        blink_tracker.status(),
            # Session
            "session_elapsed_sec": session_elapsed,
            "break_countdown_sec": break_remaining,
            "calibration_status":  "idle",
            "calibration_progress": 0,
            # Body posture scores (face-only proxy — 100 when OK, drops when bad)
            "shoulder_score":      90,
            "neck_score":          max(0, round(100 * (1 - abs(roll) / analyzer.roll_threshold))) if analyzer.roll_threshold > 0 else 100,
            "hunch_score":         max(0, min(100, round(100 * (1 - max(0, pitch - 20) / max(1, analyzer.pitch_threshold - 20))))),
            "head_offset_norm":    round(roll / 90.0, 3),
            # Issues
            "active_issues":       active_issues,
            "skeleton_landmarks":  _face_skeleton_landmarks(metrics.get("_landmarks", [])),
            "skeleton_edges":      _FACE_SKELETON_EDGES,
            # Live camera frame as base64 JPEG
            "frame_b64":           _frame_to_jpeg_b64(frame),
        }

        await broadcast_fn(json.dumps(payload, cls=_NumpySafeEncoder))
        await asyncio.sleep(0.05)   # ~20 fps

# ── WebSocket handler ─────────────────────────────────────────────────────────
async def handler(websocket):
    global stream_paused
    CONNECTED_CLIENTS.add(websocket)
    print(f"Client connected  ({len(CONNECTED_CLIENTS)} total)")
    try:
        async for message in websocket:
            try:
                cmd = json.loads(message)
                action = cmd.get("action", "")
                if action == "calibrate":
                    print("Calibration requested (stub).")
                elif action == "pause":
                    stream_paused = True
                    print(f"[SERVER] Stream PAUSED  (paused={stream_paused})")
                elif action == "resume":
                    stream_paused = False
                    print(f"[SERVER] Stream RESUMED (paused={stream_paused})  clients={len(CONNECTED_CLIENTS)}")
                elif action == "update_settings":
                    if "alert_cooldown_sec" in cmd:
                        runtime["alert_cooldown_sec"] = float(cmd["alert_cooldown_sec"])
                    if "sound_alerts_enabled" in cmd:
                        # json.loads gives real Python bool — no str coercion needed
                        val = cmd["sound_alerts_enabled"]
                        runtime["sound_alerts_enabled"] = val if isinstance(val, bool) else str(val).lower() == "true"
                    if "show_skeleton_overlay" in cmd:
                        val = cmd["show_skeleton_overlay"]
                        runtime["show_skeleton_overlay"] = val if isinstance(val, bool) else str(val).lower() == "true"
                    if "pitch_threshold_deg" in cmd:
                        analyzer.pitch_threshold = float(cmd["pitch_threshold_deg"])
                    if "roll_threshold_deg" in cmd:
                        analyzer.roll_threshold = float(cmd["roll_threshold_deg"])
                    if "ear_threshold" in cmd:
                        analyzer.ear_threshold = float(cmd["ear_threshold"])
                    if "distance_threshold_ratio" in cmd:
                        analyzer.distance_threshold = float(cmd["distance_threshold_ratio"])
                    if "break_interval_min" in cmd:
                        global break_interval
                        break_interval = float(cmd["break_interval_min"]) * 60
                    print(f"Settings updated: cooldown={runtime['alert_cooldown_sec']}s  sound={runtime['sound_alerts_enabled']}  skeleton={runtime['show_skeleton_overlay']}  pitch={analyzer.pitch_threshold}°  roll={analyzer.roll_threshold}°")
            except Exception:
                pass
    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError:
        pass
    finally:
        CONNECTED_CLIENTS.discard(websocket)
        print(f"Client disconnected ({len(CONNECTED_CLIENTS)} total)")

async def broadcast(message: str):
    global CONNECTED_CLIENTS
    if not CONNECTED_CLIENTS:
        return
    dead = set()
    for ws in CONNECTED_CLIENTS.copy():
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    CONNECTED_CLIENTS -= dead

# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    print("Starting Posture Guardian WebSocket server on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765, max_size=10_000_000, origins=None):
        await camera_loop(broadcast)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        if cap:
            cap.release()
        analyzer.close()
        pygame.quit()
