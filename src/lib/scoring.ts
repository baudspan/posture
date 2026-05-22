import type { RawMetrics, PostureSettings, PostureScore, PostureStatus } from "../types/posture";

export const calculatePostureScore = (
  metrics: RawMetrics,
  settings: PostureSettings
): PostureScore => {
  if (!metrics.face_detected) {
    return { status: "NO_FACE", violationCount: 0 };
  }

  let violationCount = 0;

  // 1. Head pitch (slouching)
  if (metrics.head_pitch_deg > settings.pitch_threshold_deg) {
    violationCount++;
  }

  // 2. Distance status
  if (metrics.face_width_ratio > settings.distance_threshold_ratio) {
    violationCount++;
  }

  // 3. Body metrics
  if (metrics.hunch_score < 60) {
    violationCount++;
  }
  if (metrics.neck_score < 60) {
    violationCount++;
  }
  if (metrics.shoulder_score < 60) {
    violationCount++;
  }

  // 4. Head lean
  if (Math.abs(metrics.head_offset_norm) > settings.head_offset_threshold) {
    violationCount++;
  }

  let status: PostureStatus = "GOOD";
  if (violationCount === 1) {
    status = "SLIPPING";
  } else if (violationCount >= 2) {
    status = "POOR";
  }

  return { status, violationCount };
};
