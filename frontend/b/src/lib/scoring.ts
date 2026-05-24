import type { RawMetrics, PostureSettings, PostureScore, PostureStatus } from "../types/posture";

export const calculatePostureScore = (
  metrics: RawMetrics,
  settings: PostureSettings
): PostureScore => {
  if (!metrics.face_detected) {
    return { status: "NO_FACE", violationCount: 0 };
  }

  // Use the backend's own posture_ok flag — this is exactly what triggers
  // the beep in server.py, so the UI and audio are now in sync.
  if (metrics.posture_ok === false) {
    // Still count secondary violations for session analytics detail
    let violationCount = 1;
    if (metrics.face_width_ratio > settings.distance_threshold_ratio) violationCount++;
    if (metrics.hunch_score < 60) violationCount++;
    if (metrics.neck_score < 60) violationCount++;
    return { status: "POOR", violationCount };
  }

  // Secondary violations that don't trigger beeps — show as SLIPPING
  let violationCount = 0;
  if (metrics.face_width_ratio > settings.distance_threshold_ratio) violationCount++;
  if (metrics.hunch_score < 60) violationCount++;
  if (metrics.neck_score < 60) violationCount++;
  if (metrics.shoulder_score < 60) violationCount++;
  if (Math.abs(metrics.head_offset_norm) > settings.head_offset_threshold) violationCount++;

  const status: PostureStatus = violationCount >= 2 ? "SLIPPING" : "GOOD";
  return { status, violationCount };
};