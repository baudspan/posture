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
    # Draw main rectangle
    cv2.rectangle(img, (x1+radius, y1), (x2-radius, y2), color, thickness)
    cv2.rectangle(img, (x1, y1+radius), (x2, y2-radius), color, thickness)
    # Draw four corners
    cv2.circle(img, (x1+radius, y1+radius), radius, color, thickness)
    cv2.circle(img, (x2-radius, y1+radius), radius, color, thickness)
    cv2.circle(img, (x1+radius, y2-radius), radius, color, thickness)
    cv2.circle(img, (x2-radius, y2-radius), radius, color, thickness)


class BlinkTracker:
    def __init__(self, window_sec=60, min_blinks_per_minute=10):
        self.window_sec = window_sec
        self.min_blinks = min_blinks_per_minute
        self.blink_timestamps = []   # store times of blinks
        self.last_alert_time = 0
    
    def add_blink(self):
        now = time.time()
        self.blink_timestamps.append(now)
        # Remove timestamps older than window_sec
        self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= self.window_sec]
    
    def get_blinks_per_minute(self):
        """Returns current blink rate (blinks per minute) over the window."""
        if not self.blink_timestamps:
            return 0.0
        # If window is less than 60 seconds, extrapolate to per minute
        if len(self.blink_timestamps) < 2:
            return 0.0
        oldest = self.blink_timestamps[0]
        newest = self.blink_timestamps[-1]
        duration_minutes = (newest - oldest) / 60.0
        if duration_minutes < 0.01:
            return 0.0
        # Count blinks in window, then scale to per minute
        blink_count = len(self.blink_timestamps)
        rate = blink_count / duration_minutes
        return min(rate, 60.0)   # cap at 60 bpm
    
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
    analyzer = EyeStrainAnalyzer(pitch_threshold_deg=30.0, distance_threshold_ratio=0.4, ear_threshold=0.3)
    cap = cv2.VideoCapture(0)
    
    blink_tracker = BlinkTracker(window_sec=60, min_blinks_per_minute=10)
    last_blink_state = False   
    last_posture_alert = 0
    last_distance_alert = 0
    last_break_time = time.time()
    break_interval = 20*60    
    
    bad_posture_start = None
    bad_distance_start = None
    
    print("Posture Guardian with Eye Strain Protection. Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        
        metrics = analyzer.process_frame(frame)
        print(f"Pitch: {metrics['head_pitch_deg']:.1f} | OK: {metrics['posture_ok']} | Distance OK: {metrics['distance_ok']} | Eyes closed: {metrics['eyes_closed']}")
        
      
        now = time.time()
        
        # 1. Posture alert (requires 3 seconds of bad posture to avoid false triggers)
        if metrics['face_detected'] and not metrics['posture_ok']:
            if time.time() - last_posture_alert > 10:
                alert_sound.play()
                last_posture_alert = time.time()
                print("Posture alert triggered!")
        
        # 2. Distance alert (too close to screen)
        if metrics['face_detected'] and not metrics['distance_ok']:
            if time.time() - last_distance_alert > 10:   # 10 sec cooldown
                alert_sound.play()
                last_distance_alert = time.time()
                print("Distance alert! Too close to screen.")
        
        # Blink detection (using EAR threshold)
        if metrics['face_detected']:
            if metrics['eyes_closed'] and not last_blink_state:
                # A blink just occurred (open -> closed transition)
                blink_tracker.add_blink()
            last_blink_state = metrics['eyes_closed']

        # Get current blink rate and status
        blink_rate = blink_tracker.get_blinks_per_minute()
        blink_status, status_color = blink_tracker.get_status()

        # Check for low blink rate alert
        low_blink, rate = blink_tracker.should_alert()
        if low_blink:
            blink_sound.play()
        
        # 5. 20-20-20 break reminder
        if now - last_break_time > break_interval:
            break_sound.play()
            last_break_time = now
        
        # --- Draw pretty UI ---
        h, w = frame.shape[:2]
        overlay = frame.copy()
        
        # Semi-transparent panel at top
        cv2.rectangle(overlay, (0,0), (w, 200), (0,0,0), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        
        # Header
        cv2.putText(frame, "POSTURE GUARDIAN", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
        
        # Posture meter (progress bar from 0 to 45 deg)
        if metrics['face_detected']:
            pitch = metrics['head_pitch_deg']
            posture_percent = min(100, int((pitch / 45.0) * 100))
            # Green to red
            color = (0, 255, 0) if posture_percent < 70 else (0, 165, 255) if posture_percent < 85 else (0, 0, 255)
            cv2.rectangle(frame, (20, 70), (20 + int(2.8 * posture_percent), 90), color, -1)
            cv2.putText(frame, f"Posture: {pitch:.0f}°", (20, 115),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
        else:
            cv2.putText(frame, "No face detected", (20, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 1)
        
        # Distance meter (ratio, threshold 0.4)
        if metrics['face_detected']:
            dist_ratio = metrics['face_width_ratio']
            dist_percent = min(100, int((dist_ratio / 0.6) * 100))
            color = (0,255,0) if dist_ratio < 0.35 else (0,165,255) if dist_ratio < 0.45 else (0,0,255)
            cv2.rectangle(frame, (20, 140), (20 + int(2.8 * dist_percent), 160), color, -1)
            cv2.putText(frame, f"Distance: {dist_ratio:.2f}", (20, 185),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
        
        # Blink rate display
        if metrics['face_detected']:
            cv2.putText(frame, f"Blink rate: {blink_rate:.1f}/min {blink_status}", 
                        (w-250, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        # Break timer
        time_since_break = now - last_break_time
        remaining = max(0, break_interval - time_since_break)
        minutes = int(remaining // 60)
        seconds = int(remaining % 60)
        cv2.putText(frame, f"Next break: {minutes:02d}:{seconds:02d}", (w-220, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
        
        # Status icons
        if metrics['face_detected']:
            if not metrics['posture_ok']:
                cv2.putText(frame, "SLOUCHING", (w-150, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
            elif not metrics['distance_ok']:
                cv2.putText(frame, "TOO CLOSE", (w-150, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
            else:
                cv2.putText(frame, "GOOD", (w-150, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)
        
        # Show frame
        cv2.imshow("Posture Guardian", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    pygame.quit()

if __name__ == "__main__":
    main()