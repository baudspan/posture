import cv2
import time
import pygame
import numpy as np
from eyestrain_ml import EyeStrainAnalyzer

pygame.mixer.init()

def make_beep(frequency, duration):
    sample_rate = 44100
    t = np.arange(int(sample_rate * duration)) / sample_rate
    samples = np.sin(2 * np.pi * frequency * t).astype(np.float32)
    samples_int16 = (samples * 32767).astype(np.int16)
    stereo = np.column_stack((samples_int16, samples_int16))
    return pygame.sndarray.make_sound(stereo)

alert_sound = make_beep(880, 0.3)
blink_sound = make_beep(440, 0.2)
break_sound = make_beep(660, 0.5)


def rounded_rectangle(img, top_left, bottom_right, color, thickness=1, radius=10):
    x1, y1 = top_left
    x2, y2 = bottom_right
    cv2.rectangle(img, (x1+radius, y1), (x2-radius, y2), color, thickness)
    cv2.rectangle(img, (x1, y1+radius), (x2, y2-radius), color, thickness)
    cv2.circle(img, (x1+radius, y1+radius), radius, color, thickness)
    cv2.circle(img, (x2-radius, y1+radius), radius, color, thickness)
    cv2.circle(img, (x1+radius, y2-radius), radius, color, thickness)
    cv2.circle(img, (x2-radius, y2-radius), radius, color, thickness)


class BlinkTracker:
    def __init__(self, window_sec=60, min_blinks_per_minute=10):
        self.window_sec = window_sec
        self.min_blinks = min_blinks_per_minute
        self.blink_timestamps = []
        self.last_alert_time = 0

    def add_blink(self):
        now = time.time()
        self.blink_timestamps.append(now)
        self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= self.window_sec]

    def get_blinks_per_minute(self):
        if len(self.blink_timestamps) < 2:
            return 0.0
        oldest = self.blink_timestamps[0]
        newest = self.blink_timestamps[-1]
        duration_minutes = (newest - oldest) / 60.0
        if duration_minutes < 0.01:
            return 0.0
        return min(len(self.blink_timestamps) / duration_minutes, 60.0)

    def get_status(self):
        rate = self.get_blinks_per_minute()
        if rate > 12:
            return "Normal", (0, 255, 0)
        elif rate >= 8:
            return "Low", (0, 165, 255)
        else:
            return "Very Low", (0, 0, 255)

    def should_alert(self):
        rate = self.get_blinks_per_minute()
        now = time.time()
        if rate < self.min_blinks and (now - self.last_alert_time > 60):
            self.last_alert_time = now
            return True, rate
        return False, rate


def main():
    analyzer = EyeStrainAnalyzer(
        pitch_threshold_deg=48.0,
        roll_threshold_deg=20.0,
        distance_threshold_ratio=0.4,
        ear_threshold=0.3
    )
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open webcam.")
        return

    blink_tracker = BlinkTracker(window_sec=60, min_blinks_per_minute=10)
    last_blink_state = False
    last_posture_alert = 0
    last_distance_alert = 0
    last_break_time = time.time()
    break_interval = 20 * 60   # seconds

    print("Posture Guardian with Eye Strain Protection. Press 'q' to quit.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame.")
                break

            metrics = analyzer.process_frame(frame)
            print(
                f"Pitch: {metrics['head_pitch_deg']:.1f} | "
                f"Roll: {metrics['head_roll_deg']:.1f} | "
                f"Posture OK: {metrics['posture_ok']} | "
                f"Distance OK: {metrics['distance_ok']} | "
                f"Eyes closed: {metrics['eyes_closed']}"
            )

            now = time.time()

            # 1. Posture alert (pitch OR roll)
            if metrics['face_detected'] and not metrics['posture_ok']:
                if now - last_posture_alert > 3:
                    alert_sound.play()
                    last_posture_alert = now
                    print("Posture alert triggered (forward slouch or side tilt)!")

            # 2. Distance alert
            if metrics['face_detected'] and not metrics['distance_ok']:
                if now - last_distance_alert > 3:
                    alert_sound.play()
                    last_distance_alert = now
                    print("Distance alert! Too close to screen.")

            # 3. Blink detection (open -> closed transition)
            if metrics['face_detected']:
                if metrics['eyes_closed'] and not last_blink_state:
                    blink_tracker.add_blink()
                last_blink_state = metrics['eyes_closed']

            blink_rate = blink_tracker.get_blinks_per_minute()
            blink_status, status_color = blink_tracker.get_status()

            # 4. Low blink rate alert
            low_blink, _ = blink_tracker.should_alert()
            if low_blink:
                blink_sound.play()

            # 5. 20-20-20 break reminder
            if now - last_break_time > break_interval:
                break_sound.play()
                last_break_time = now

            # --- Draw UI ---
            h, w = frame.shape[:2]
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (w, 220), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

            cv2.putText(frame, "POSTURE GUARDIAN", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            if metrics['face_detected']:
                # Forward tilt bar
                pitch = metrics['head_pitch_deg']
                pitch_pct = min(100, int((pitch / 50.0) * 100))
                c = (0, 255, 0) if pitch_pct < 70 else (0, 165, 255) if pitch_pct < 85 else (0, 0, 255)
                cv2.rectangle(frame, (20, 70), (20 + int(2.8 * pitch_pct), 90), c, -1)
                cv2.putText(frame, f"Forward tilt: {pitch:.0f}deg", (20, 115),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

                # Side tilt bar
                roll_abs = abs(metrics['head_roll_deg'])
                roll_pct = min(100, int((roll_abs / 30.0) * 100))
                cr = (0, 255, 0) if roll_abs < 10 else (0, 165, 255) if roll_abs < 20 else (0, 0, 255)
                cv2.rectangle(frame, (20, 130), (20 + int(2.8 * roll_pct), 150), cr, -1)
                cv2.putText(frame, f"Side tilt: {metrics['head_roll_deg']:.1f}deg", (20, 175),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

                # Distance bar
                dist_ratio = metrics['face_width_ratio']
                dist_pct = min(100, int((dist_ratio / 0.6) * 100))
                cd = (0, 255, 0) if dist_ratio < 0.35 else (0, 165, 255) if dist_ratio < 0.45 else (0, 0, 255)
                cv2.rectangle(frame, (20, 190), (20 + int(2.8 * dist_pct), 210), cd, -1)
                cv2.putText(frame, f"Distance: {dist_ratio:.2f}", (20, 235),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            else:
                cv2.putText(frame, "No face detected", (20, 115),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)

            # Blink rate
            if metrics['face_detected']:
                cv2.putText(frame, f"Blink rate: {blink_rate:.1f}/min {blink_status}",
                            (w - 280, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)

            # Break timer
            remaining = max(0, break_interval - (now - last_break_time))
            cv2.putText(frame,
                        f"Next break: {int(remaining // 60):02d}:{int(remaining % 60):02d}",
                        (w - 230, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Status label
            if metrics['face_detected']:
                if not metrics['posture_ok']:
                    label = "SLOUCHING" if metrics['head_pitch_deg'] >= analyzer.pitch_threshold else "SIDE TILT"
                    cv2.putText(frame, label, (w - 160, 130),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                elif not metrics['distance_ok']:
                    cv2.putText(frame, "TOO CLOSE", (w - 160, 130),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                else:
                    cv2.putText(frame, "GOOD", (w - 160, 130),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            cv2.imshow("Posture Guardian", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        analyzer.close()
        pygame.quit()


if __name__ == "__main__":
    main()