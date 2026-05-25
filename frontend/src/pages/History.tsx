// src/pages/History.tsx
import React, { useState, useEffect } from "react";
import { getSessionsFS, deleteSessionFS } from "../lib/firestore";
import { useAuth } from "../store/authStore";
import type { SessionHistoryItem } from "../types/posture";
import { SessionTable } from "../components/history/SessionTable";
import { SessionDetail } from "../components/history/SessionDetail";
import { Info } from "lucide-react";

export const History: React.FC = () => {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getSessionsFS(user.id)
      .then(loaded => {
        setSessions(loaded);
        if (loaded.length > 0) setSelectedSession(loaded[0]);
      })
      .catch(err => console.error("[Firestore] load failed:", err))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (confirm("Are you sure you want to delete this session?")) {
      deleteSessionFS(user.id, id)
        .then(() => {
          const updated = sessions.filter(s => s.id !== id);
          setSessions(updated);
          if (selectedSession?.id === id)
            setSelectedSession(updated.length > 0 ? updated[0] : null);
        })
        .catch(err => console.error("[Firestore] delete failed:", err));
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Please sign in to view your session history.</div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading sessions…</div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
      {/* LEFT: Session Table */}
      <div className={`${selectedSession ? "lg:col-span-7" : "lg:col-span-12"} space-y-4`}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-none">Tracking Logs</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">Review all your historically recorded posture sessions.</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 text-teal-600 dark:text-teal-400 text-xs font-bold font-mono">
              Total logs: {sessions.length}
            </span>
          </div>
 
          <SessionTable
            sessions={sessions}
            selectedId={selectedSession?.id || null}
            onSelect={setSelectedSession}
            onDelete={handleDelete}
          />
        </div>
      </div>
 
      {/* RIGHT: Detail View */}
      {selectedSession && (
        <div className="lg:col-span-5">
          <SessionDetail session={selectedSession} />
        </div>
      )}
      
      {!selectedSession && sessions.length > 0 && (
        <div className="hidden lg:block lg:col-span-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-300 border-dashed min-h-[300px] flex flex-col justify-center items-center">
          <Info className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Select a log row</p>
          <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1">Select any session row from the list to display its complete diagnostic data timeline.</p>
        </div>
      )}
    </div>
  );
};
