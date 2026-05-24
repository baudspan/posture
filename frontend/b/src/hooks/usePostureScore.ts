// src/hooks/usePostureScore.ts
import { useMemo } from "react";
import type { RawMetrics, PostureSettings, PostureScore } from "../types/posture";
import { calculatePostureScore } from "../lib/scoring";

export const usePostureScore = (
  metrics: RawMetrics | null,
  settings: PostureSettings
): PostureScore => {
  return useMemo(() => {
    if (!metrics) {
      return { status: "NO_FACE", violationCount: 0 };
    }

    // Future backend integration check
    // If backend sends a master score field, use it
    if ("posture_score" in metrics && typeof (metrics as any).posture_score === "number") {
      const score = (metrics as any).posture_score;
      let status: "GOOD" | "SLIPPING" | "POOR" = "GOOD";
      if (score < 50) {
        status = "POOR";
      } else if (score < 80) {
        status = "SLIPPING";
      }
      return { status, violationCount: score < 80 ? 1 : 0 };
    }

    return calculatePostureScore(metrics, settings);
  }, [metrics, settings]);
};
