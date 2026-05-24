// src/types/posture.ts

export type PostureStatus = "GOOD" | "SLIPPING" | "POOR" | "NO_FACE";

export interface RawMetrics {
  // Timing
  timestamp:              number;
  frame_index:            number;
  // Face / posture
  face_detected:          boolean;
  head_pitch_deg:         number;
  head_roll_deg:          number;   // left/right tilt in degrees
  face_width_ratio:       number;
  distance_status:        "TOO_CLOSE" | "GOOD" | "TOO_FAR";
  posture_ok:             boolean;
  pitch_ok:               boolean;
  roll_ok:                boolean;
  // Eye / blink
  left_ear:               number;
  right_ear:              number;
  ear_avg:                number;
  eyes_closed:            boolean;
  blink_count_session:    number;
  blink_rate_per_min:     number;
  blink_status:           "Normal" | "Low" | "Very Low";
  // Session
  calibration_status:     "idle" | "in_progress" | "complete" | "failed";
  calibration_progress:   number;
  session_elapsed_sec:    number;
  break_countdown_sec:    number;
  // Posture scores
  shoulder_score:         number;
  neck_score:             number;
  hunch_score:            number;
  head_offset_norm:       number;
  // Issues + skeleton
  active_issues:          string[];
  skeleton_landmarks:     Array<{ id: number; x: number; y: number }>;
  skeleton_edges:         Array<[number, number]>;
  // Alert flags from backend
  alerts?: {
    posture:  boolean;
    distance: boolean;
    blink:    boolean;
    break:    boolean;
  };
}

export interface PostureScore {
  status:         PostureStatus;
  violationCount: number;
}

export interface SessionHistoryItem {
  id:               string;
  userId:           string;
  startedAt:        string;
  endedAt:          string;
  durationSec:      number;
  avgPostureScore:  number;
  mostCommonIssue:  string;
  statusBreakdown: {
    GOOD:     number;
    SLIPPING: number;
    POOR:     number;
  };
  timeline: Array<{
    minute: number;
    status: PostureStatus;
    score:  number;
  }>;
  blinkRateAvg:    number;
  issueFrequency:  Record<string, number>;
}

export interface PostureSettings {
  pitch_threshold_deg:          number;
  roll_threshold_deg:           number;
  distance_threshold_ratio:     number;
  ear_threshold:                number;
  head_offset_threshold:        number;
  shoulder_offset:              number;
  hunch_offset:                 number;
  neck_offset:                  number;
  alert_cooldown_sec:           number;
  break_interval_min:           number;
  sound_alerts_enabled:         boolean;
  show_skeleton_overlay:        boolean;
  screen_distance_threshold_px: number;
}

export interface UserSession {
  id:        string;
  name:      string;
  email:     string;
  createdAt: string;
}
