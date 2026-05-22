// src/components/history/SessionTable.tsx
import React from "react";
import { Calendar, Clock, Award, AlertTriangle, Trash2 } from "lucide-react";
import type { SessionHistoryItem } from "../../types/posture";

interface SessionTableProps {
  sessions: SessionHistoryItem[];
  selectedId: string | null;
  onSelect: (session: SessionHistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export const SessionTable: React.FC<SessionTableProps> = ({
  sessions,
  selectedId,
  onSelect,
  onDelete
}) => {
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 1) return `${seconds}s`;
    return `${mins} min`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40";
    if (score >= 60) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40";
    return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40";
  };

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-slate-600 dark:text-slate-300 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/10">
        <Calendar className="w-10 h-10 mx-auto text-slate-500 dark:text-slate-400 mb-3" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No session history found</p>
        <p className="text-xs text-slate-600 dark:text-slate-350 mt-1">Start tracking to log your posture analytics.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
            <th className="px-6 py-4">Date & Time</th>
            <th className="px-6 py-4">Duration</th>
            <th className="px-6 py-4">Avg Score</th>
            <th className="px-6 py-4">Most Common Issue</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
          {sessions.map((session) => {
            const isSelected = selectedId === session.id;
            return (
              <tr
                key={session.id}
                onClick={() => onSelect(session)}
                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors ${
                  isSelected ? "bg-teal-50/30 dark:bg-teal-950/10 border-l-4 border-l-teal-500" : ""
                }`}
              >
                {/* Date */}
                <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
                    <span>{formatDate(session.startedAt)}</span>
                  </div>
                </td>
                {/* Duration */}
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-550 dark:text-slate-400 shrink-0" />
                    <span>{formatDuration(session.durationSec)}</span>
                  </div>
                </td>
                {/* Score */}
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${getScoreColor(session.avgPostureScore)}`}>
                    {session.avgPostureScore}%
                  </span>
                </td>
                {/* Issue */}
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    {session.mostCommonIssue !== "None" && session.mostCommonIssue !== "None" ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[150px]">{session.mostCommonIssue}</span>
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Perfect alignment</span>
                      </>
                    )}
                  </div>
                </td>
                {/* Delete button */}
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => onDelete(session.id, e)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
