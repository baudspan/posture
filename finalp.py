import cv2
import time
import pygame
import numpy as np
from eyestrain_ml import EyeStrainAnalyzer   # make sure filename matches

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
        if not self.blink_timestamps:
            return 0.0
        if len(self.blink_timestamps) < 2:
            return 0.0
        oldest = self.blink_timestamps[0]
        newest = self.blink_timestamps[-1]
        duration_minutes = (newest - oldest) / 60.0
        if duration_minutes < 0.01:
            return 0.0
        blink_count = len(self.blink_timestamps)
        rate = blink_count / duration_minutes
        return min(rate, 60.0)
    
    def get_status(self):
        rate = self.get_blinks_per_minute()
        if rate > 12:
            return "Normal", (0,255,0)
        elif rate >= 8:
            return "Low", (0,165,255)
        else:
            return "Very Low", (0,0,255)
    
    def should_alert(self):
        rate = self.get_blinks_per_minute()
        now = time.time()
        if rate < self.min_blinks and (now - self.last_alert_time > 60):
            self.last_alert_time = now
            return True, rate
        return False, rate

def main():
    # Increased pitch threshold to 38° (less sensitive), roll threshold 15°
    analyzer = EyeStrainAnalyzer(pitch_threshold_deg=38.0, roll_threshold_deg=15.0,
                                 distance_threshold_ratio=0.4, ear_threshold=0.3)
    cap = cv2.VideoCapture(0)
    
    blink_tracker = BlinkTracker(window_sec=60, min_blinks_per_minute=10)
    last_blink_state = False
    last_posture_alert = 0
    last_distance_alert = 0
    last_break_time = time.time()
    break_interval = 20 * 60
    
    print("Posture Guardian with Eye Strain Protection. Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        metrics = analyzer.process_frame(frame)
        print(f"Pitch: {metrics['head_pitch_deg']:.1f} | Roll: {metrics['head_roll_deg']:.1f} | Posture OK: {metrics['posture_ok']} | Distance OK: {metrics['distance_ok']}")
        
        now = time.time()
        
        # Posture alert (pitch OR roll)
        if metrics['face_detected'] and not metrics['posture_ok']:
            if now - last_posture_alert > 3:
                alert_sound.play()
                last_posture_alert = now
                print("Posture alert triggered (forward slouch or side tilt)!")
        
        # Distance alert
        if metrics['face_detected'] and not metrics['distance_ok']:
            if now - last_distance_alert > 3:
                alert_sound.play()
                last_distance_alert = now
                print("Distance alert! Too close to screen.")
        
        # Blink detection
        if metrics['face_detected']:
            if metrics['eyes_closed'] and not last_blink_state:
                blink_tracker.add_blink()
            last_blink_state = metrics['eyes_closed']
        
        blink_rate = blink_tracker.get_blinks_per_minute()
        blink_status, status_color = blink_tracker.get_status()
        low_blink, _ = blink_tracker.should_alert()
        if low_blink:
            blink_sound.play()
        
        # 20-20-20 break
        if now - last_break_time > break_interval:
            break_sound.play()
            last_break_time = now
        
        # --- UI Drawing ---
        h, w = frame.shape[:2]
        overlay = frame.copy()
        cv2.rectangle(overlay, (0,0), (w, 220), (0,0,0), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        
        cv2.putText(frame, "POSTURE GUARDIAN", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
        
        if metrics['face_detected']:
            # Pitch bar
            pitch = metrics['head_pitch_deg']
            pitch_percent = min(100, int((pitch / 50.0) * 100))
            color = (0,255,0) if pitch_percent < 70 else (0,165,255) if pitch_percent < 85 else (0,0,255)
            cv2.rectangle(frame, (20, 70), (20 + int(2.8 * pitch_percent), 90), color, -1)
            cv2.putText(frame, f"Forward tilt: {pitch:.0f}", (20, 115),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
            
            # Roll bar (absolute value, max 30°)
            roll_abs = abs(metrics['head_roll_deg'])
            roll_percent = min(100, int((roll_abs / 30.0) * 100))
            color_roll = (0,255,0) if roll_abs < 10 else (0,165,255) if roll_abs < 20 else (0,0,255)
            cv2.rectangle(frame, (20, 130), (20 + int(2.8 * roll_percent), 150), color_roll, -1)
            cv2.putText(frame, f"Side tilt: {metrics['head_roll_deg']:.1f}", (20, 175),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
            
            # Distance meter
            dist_ratio = metrics['face_width_ratio']
            dist_percent = min(100, int((dist_ratio / 0.6) * 100))
            color_dist = (0,255,0) if dist_ratio < 0.35 else (0,165,255) if dist_ratio < 0.45 else (0,0,255)
            cv2.rectangle(frame, (20, 190), (20 + int(2.8 * dist_percent), 210), color_dist, -1)
            cv2.putText(frame, f"Distance: {dist_ratio:.2f}", (20, 235),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
        else:
            cv2.putText(frame, "No face detected", (20, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 1)
        
        # Blink rate
        if metrics['face_detected']:
            cv2.putText(frame, f"Blink rate: {blink_rate:.1f}/min {blink_status}",
                        (w-280, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        
        # Break timer
        time_since_break = now - last_break_time
        remaining = max(0, break_interval - time_since_break)
        minutes = int(remaining // 60)
        seconds = int(remaining % 60)
        cv2.putText(frame, f"Next break: {minutes:02d}:{seconds:02d}", (w-230, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
        
        # Status icons
        if metrics['face_detected']:
            if not metrics['posture_ok']:
                if metrics['head_pitch_deg'] >= analyzer.pitch_threshold:
                    cv2.putText(frame, "SLOUCHING", (w-160, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
                elif not metrics['roll_ok']:
                    cv2.putText(frame, "SIDE TILT", (w-160, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
            elif not metrics['distance_ok']:
                cv2.putText(frame, "TOO CLOSE", (w-160, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
            else:
                cv2.putText(frame, "GOOD", (w-160, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)
        
        cv2.imshow("Posture Guardian", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    pygame.quit()

if __name__ == "__main__":
    main()