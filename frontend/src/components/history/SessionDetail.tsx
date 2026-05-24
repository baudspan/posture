// src/components/history/SessionDetail.tsx
import React from "react";
import { AlertTriangle, Clock, Award, Eye } from "lucide-react";
import type { SessionHistoryItem, PostureStatus } from "../../types/posture";

interface SessionDetailProps {
  session: SessionHistoryItem;
}

export const SessionDetail: React.FC<SessionDetailProps> = ({ session }) => {
  const getStatusColor = (status: PostureStatus) => {
    switch (status) {
      case "GOOD":
        return "bg-emerald-500 shadow-emerald-500/10";
      case "SLIPPING":
        return "bg-amber-500 shadow-amber-500/10";
      case "POOR":
        return "bg-rose-500 shadow-rose-500/10";
      case "NO_FACE":
      default:
        return "bg-slate-700";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-500";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 1) return `${seconds} seconds`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl animate-fade-in select-none">
      {/* Detail Header */}
      <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-none">Session Details</h2>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider block mt-1.5">
            ID: {session.id}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">Date</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
            {new Date(session.startedAt).toLocaleDateString(undefined, { 
              weekday: "short", 
              month: "short", 
              day: "numeric" 
            })}
          </span>
        </div>
      </div>

      {/* Segmented Timeline Bar */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Minute-by-Minute Posture Timeline</span>
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">Total: {session.timeline.length}m</span>
        </div>
        
        {/* Horizontal segment track */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-x-auto min-h-[36px]">
          {session.timeline.map((segment) => (
            <div
              key={segment.minute}
              className={`h-6 flex-1 min-w-[20px] rounded-md transition-all duration-300 relative group ${getStatusColor(segment.status)}`}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 bg-slate-900 text-slate-200 border border-slate-950 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800 text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap shadow-xl">
                Min {segment.minute}: {segment.status} ({segment.score}%)
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-[9px] font-bold text-slate-600 dark:text-slate-300 justify-end px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500"></span> Optimal (GOOD)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500"></span> Warning (SLIPPING)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500"></span> Critical (POOR)
          </span>
        </div>
      </div>

      {/* Grid of aggregate stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Posture Score */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 flex items-center gap-3">
          <div className="p-2 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-350 font-bold block uppercase tracking-wider">Avg Posture</span>
            <span className={`text-xl font-mono font-black ${getScoreColor(session.avgPostureScore)}`}>
              {session.avgPostureScore}%
            </span>
          </div>
        </div>

        {/* Duration */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-350 font-bold block uppercase tracking-wider">Active Time</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatDuration(session.durationSec)}</span>
          </div>
        </div>

        {/* Blink rate */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 flex items-center gap-3">
          <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/40 rounded-lg">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-350 font-bold block uppercase tracking-wider">Avg Blink Rate</span>
            <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-50">{session.blinkRateAvg}</span>
            <span className="text-[9px] text-slate-600 dark:text-slate-350 ml-1 font-bold">/ min</span>
          </div>
        </div>

        {/* Status percentages breakdown */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-1">
          <span className="text-[10px] text-slate-600 dark:text-slate-350 font-bold block uppercase tracking-wider">Status Split</span>
          <div className="flex gap-2 text-xs font-mono font-bold">
            <span className="text-emerald-600 dark:text-emerald-400">{session.statusBreakdown.GOOD}% <span className="text-[9px] text-slate-550 dark:text-slate-600 font-semibold">G</span></span>
            <span className="text-amber-600 dark:text-amber-400">{session.statusBreakdown.SLIPPING}% <span className="text-[9px] text-slate-550 dark:text-slate-600 font-semibold">S</span></span>
            <span className="text-rose-600 dark:text-rose-50">{session.statusBreakdown.POOR}% <span className="text-[9px] text-slate-550 dark:text-slate-600 font-semibold">P</span></span>
          </div>
        </div>
      </div>

      {/* Issue frequency list */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Posture Violations Frequency</h3>
        {Object.keys(session.issueFrequency).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(session.issueFrequency).map(([issue, count]) => (
              <div
                key={issue}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/40 text-xs text-slate-800 dark:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  {issue}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40 font-mono font-bold">
                  {count}s
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-slate-600 dark:text-slate-300 text-xs font-bold border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/10">
            No posture issues recorded in this session!
          </div>
        )}
      </div>
    </div>
  );
};
