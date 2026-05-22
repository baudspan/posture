// src/hooks/useSession.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { RawMetrics, SessionHistoryItem, PostureStatus } from "../types/posture";
import { saveSession } from "../lib/localStorage";

export const useSession = (metrics: RawMetrics | null, currentStatus: PostureStatus) => {
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0); // active session duration in seconds

  // Track session details in refs to avoid triggering re-renders for every frame
  const framesRef = useRef<Array<{
    score: number;
    status: PostureStatus;
    issues: string[];
    blinkRate: number;
  }>>([]);
  const timerRef = useRef<number | null>(null);
  const minuteAccumulatorRef = useRef<Array<{ score: number; status: PostureStatus }>>([]);
  const timelineRef = useRef<SessionHistoryItem["timeline"]>([]);
  const issueCountsRef = useRef<Record<string, number>>({});

  // Reset all refs
  const resetRefs = useCallback(() => {
    framesRef.current = [];
    minuteAccumulatorRef.current = [];
    timelineRef.current = [];
    issueCountsRef.current = {};
    setDuration(0);
  }, []);

  // Increment duration timer
  useEffect(() => {
    if (sessionActive) {
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionActive]);

  // Aggregate metrics on every frame update
  useEffect(() => {
    if (!sessionActive || !metrics) return;

    // Calculate a temporary frame score from shoulder, neck and hunch
    const frameScore = metrics.face_detected
      ? Math.round((metrics.shoulder_score + metrics.neck_score + metrics.hunch_score) / 3)
      : 0;

    // Add frame to tracking list
    framesRef.current.push({
      score: frameScore,
      status: currentStatus,
      issues: metrics.active_issues || [],
      blinkRate: metrics.blink_rate_per_min || 0
    });

    // Track issue counts (on frame level, if an issue is present)
    if (metrics.active_issues) {
      metrics.active_issues.forEach(issue => {
        issueCountsRef.current[issue] = (issueCountsRef.current[issue] || 0) + 1;
      });
    }

    // Accumulate for the minute timeline
    minuteAccumulatorRef.current.push({
      score: frameScore,
      status: currentStatus
    });

    // Check if a minute has passed (e.g. accumulator reaches ~600 entries at 10 fps, 
    // but a cleaner way is mapping to the actual session elapsed seconds)
    const currentMinuteIndex = Math.floor(duration / 60) + 1;
    const existingMinuteIndex = timelineRef.current.findIndex(t => t.minute === currentMinuteIndex);
    
    // If it's a new minute and we have accumulated data for the previous one
    if (existingMinuteIndex === -1 && minuteAccumulatorRef.current.length >= 30) {
      const avgScore = Math.round(
        minuteAccumulatorRef.current.reduce((sum, item) => sum + item.score, 0) /
        minuteAccumulatorRef.current.length
      );
      
      // Determine dominant status of the minute
      const statusCounts = minuteAccumulatorRef.current.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      let dominantStatus: PostureStatus = "GOOD";
      let maxCount = 0;
      Object.entries(statusCounts).forEach(([status, count]) => {
        if (count > maxCount) {
          maxCount = count;
          dominantStatus = status as PostureStatus;
        }
      });

      timelineRef.current.push({
        minute: currentMinuteIndex,
        status: dominantStatus,
        score: avgScore
      });

      // Clear accumulator for the next minute
      minuteAccumulatorRef.current = [];
    }
  }, [sessionActive, metrics, currentStatus, duration]);

  const startSession = () => {
    resetRefs();
    setStartedAt(new Date().toISOString());
    setSessionActive(true);
  };

  const endSession = (userId: string): SessionHistoryItem | null => {
    if (!sessionActive || !startedAt) return null;

    setSessionActive(false);
    const endedAt = new Date().toISOString();
    const totalDuration = duration;

    if (framesRef.current.length === 0) {
      resetRefs();
      return null;
    }

    // 1. Calculate average posture score
    const totalScoreSum = framesRef.current.reduce((sum, f) => sum + f.score, 0);
    const avgPostureScore = Math.round(totalScoreSum / framesRef.current.length);

    // 2. Calculate average blink rate
    const totalBlinkRateSum = framesRef.current.reduce((sum, f) => sum + f.blinkRate, 0);
    const blinkRateAvg = Number((totalBlinkRateSum / framesRef.current.length).toFixed(1));

    // 3. Status breakdown
    const statusCounts = framesRef.current.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, { GOOD: 0, SLIPPING: 0, POOR: 0, NO_FACE: 0 } as Record<PostureStatus, number>);


    // Map status breakdown (excluding NO_FACE or grouping it under POOR/SLIPPING for standard percentage)
    const activeFrames = (statusCounts.GOOD + statusCounts.SLIPPING + statusCounts.POOR) || 1;
    const statusBreakdown = {
      GOOD: Math.round((statusCounts.GOOD / activeFrames) * 100),
      SLIPPING: Math.round((statusCounts.SLIPPING / activeFrames) * 100),
      POOR: Math.round((statusCounts.POOR / activeFrames) * 100)
    };

    // 4. Most common issue & Issue frequencies
    const issueFrequency: Record<string, number> = {};
    // Let's count how many distinct "events" or frames had these issues
    Object.entries(issueCountsRef.current).forEach(([issue, count]) => {
      // Scale count to represent distinct events (approx frames count / 10 is seconds)
      issueFrequency[issue] = Math.round(count / 10) || 1;
    });

    let mostCommonIssue = "None";
    let maxIssueCount = 0;
    Object.entries(issueFrequency).forEach(([issue, count]) => {
      if (count > maxIssueCount) {
        maxIssueCount = count;
        mostCommonIssue = issue;
      }
    });

    // 5. Finalize timeline (add remaining frames)
    if (minuteAccumulatorRef.current.length > 0) {
      const lastMinuteIndex = Math.floor(totalDuration / 60) + 1;
      const avgScore = Math.round(
        minuteAccumulatorRef.current.reduce((sum, item) => sum + item.score, 0) /
        minuteAccumulatorRef.current.length
      );
      const statusCountsLast = minuteAccumulatorRef.current.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      let dominantStatus: PostureStatus = "GOOD";
      let maxCount = 0;
      Object.entries(statusCountsLast).forEach(([status, count]) => {
        if (count > maxCount) {
          maxCount = count;
          dominantStatus = status as PostureStatus;
        }
      });

      if (!timelineRef.current.some(t => t.minute === lastMinuteIndex)) {
        timelineRef.current.push({
          minute: lastMinuteIndex,
          status: dominantStatus,
          score: avgScore
        });
      }
    }

    const sessionItem: SessionHistoryItem = {
      id: "sess_" + Math.random().toString(36).substr(2, 9),
      userId,
      startedAt,
      endedAt,
      durationSec: totalDuration,
      avgPostureScore,
      mostCommonIssue,
      statusBreakdown,
      timeline: timelineRef.current.length > 0 ? timelineRef.current : [{ minute: 1, status: "GOOD", score: avgPostureScore }],
      blinkRateAvg,
      issueFrequency
    };

    saveSession(sessionItem);
    resetRefs();
    return sessionItem;
  };

  return {
    sessionActive,
    duration,
    startSession,
    endSession
  };
};
