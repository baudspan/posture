// src/pages/Analytics.tsx
import React, { useState, useEffect } from "react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { getSessionsFS } from "../lib/firestore";
import { useAuth } from "../store/authStore";
import type { SessionHistoryItem } from "../types/posture";
import { BarChart3, Award, Zap, Heart, Calendar } from "lucide-react";



export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<7 | 30>(7);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const { user } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<"light" | "dark">;
      setTheme(customEvent.detail);
    };

    window.addEventListener("theme-change", handleThemeChange);
    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    getSessionsFS(user.id, timeRange)
      .then(realSessions => {
        setSessions(realSessions);
      })
      .catch(err => console.error("[Firestore] analytics load failed:", err))
      .finally(() => setLoadingData(false));
  }, [user, timeRange]);

  // Firestore already filters by timeRange — just sort chronologically for charts
  const filteredSessions = React.useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
  }, [sessions]);

  // 1. Posture Score Trend Data
  const trendData = React.useMemo(() => {
    return filteredSessions.map(s => {
      const date = new Date(s.startedAt);
      return {
        name: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        score: s.avgPostureScore,
        blinkRate: s.blinkRateAvg
      };
    });
  }, [filteredSessions]);

  // 2. Status Split Data (Pie Chart)
  const statusSplitData = React.useMemo(() => {
    let goodSum = 0;
    let slippingSum = 0;
    let poorSum = 0;

    filteredSessions.forEach(s => {
      goodSum += s.statusBreakdown.GOOD;
      slippingSum += s.statusBreakdown.SLIPPING;
      poorSum += s.statusBreakdown.POOR;
    });

    const total = (goodSum + slippingSum + poorSum) || 1;
    return [
      { name: "Optimal (GOOD)", value: Math.round((goodSum / total) * 100), color: "#10b981" },
      { name: "Warning (SLIPPING)", value: Math.round((slippingSum / total) * 100), color: "#f59e0b" },
      { name: "Critical (POOR)", value: Math.round((poorSum / total) * 100), color: "#f43f5e" }
    ];
  }, [filteredSessions]);

  // 3. Issue Frequency Data (Bar Chart) — seconds spent in each state
  // issueFrequency values are already in seconds (stored as frame_count / 10 in useSession)
  const issueFrequencyData = React.useMemo(() => {
    const counts: Record<string, number> = {
      "Slouching":     0,
      "Leaning Left":  0,
      "Leaning Right": 0,
    };

    filteredSessions.forEach(s => {
      if (s.issueFrequency) {
        Object.entries(s.issueFrequency).forEach(([issue, count]) => {
          const c = count as number;
          if (issue.includes("Slouch") || issue.includes("forward")) counts["Slouching"]     += c;
          else if (issue.toLowerCase().includes("left"))              counts["Leaning Left"]  += c;
          else if (issue.toLowerCase().includes("right"))             counts["Leaning Right"] += c;
        });
      }
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredSessions]);

  // 4. Calculate Streak Counter
  // Streak = consecutive days with avg posture score >= 75
  const streak = React.useMemo(() => {
    // Collect daily average scores
    const dayScores: Record<string, number[]> = {};
    sessions.forEach(s => {
      const dateStr = new Date(s.startedAt).toDateString();
      if (!dayScores[dateStr]) dayScores[dateStr] = [];
      dayScores[dateStr].push(s.avgPostureScore);
    });

    const dayAverages = Object.entries(dayScores).map(([day, scores]) => ({
      day: new Date(day),
      avg: scores.reduce((sum, val) => sum + val, 0) / scores.length
    })).sort((a, b) => b.day.getTime() - a.day.getTime()); // newest first

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < dayAverages.length; i++) {
      const day = new Date(dayAverages[i].day);
      day.setHours(0,0,0,0);
      
      // Calculate day difference from today to index
      const diffTime = Math.abs(today.getTime() - day.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Allow starting streak from today or yesterday
      if (i === 0 && diffDays > 1) {
        break;
      }
      
      if (dayAverages[i].avg >= 75) {
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  }, [sessions]);

  // Key Aggregates
  const stats = React.useMemo(() => {
    if (filteredSessions.length === 0) return { avgScore: 0, totalMins: 0, avgBlinkRate: 0 };
    const avgScore = Math.round(
      filteredSessions.reduce((sum, s) => sum + s.avgPostureScore, 0) / filteredSessions.length
    );
    const totalSecs = filteredSessions.reduce((sum, s) => sum + s.durationSec, 0);
    const totalMins = Math.round(totalSecs / 60);
    const avgBlinkRate = Number(
      (filteredSessions.reduce((sum, s) => sum + s.blinkRateAvg, 0) / filteredSessions.length).toFixed(1)
    );
    return { avgScore, totalMins, avgBlinkRate };
  }, [filteredSessions]);

  if (!user) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Please sign in to view analytics.</div>
  );

  if (loadingData) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading analytics…</div>
  );

  if (sessions.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <BarChart3 className="w-10 h-10 text-slate-400" />
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No sessions in the last {timeRange} days</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Start a recording session on the Monitor page to begin tracking.</p>
      <div className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1 mt-2">
        <button
          onClick={() => setTimeRange(7)}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${timeRange === 7 ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white" : "text-slate-600 dark:text-slate-300"}`}
        >Last 7 Days</button>
        <button
          onClick={() => setTimeRange(30)}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${timeRange === 30 ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white" : "text-slate-600 dark:text-slate-300"}`}
        >Last 30 Days</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 select-none">
      {/* Time Range Selector & Page Title info */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-none">Diagnostic Analytics</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">Detailed statistical reports on posture habits and eye wellness.</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1">
          <button
            onClick={() => setTimeRange(7)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
              timeRange === 7 
                ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white shadow shadow-emerald-500/10" 
                : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange(30)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
              timeRange === 30 
                ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white shadow shadow-emerald-500/10" 
                : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Aggregate metrics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Posture Score */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider">Avg Posture</span>
            <span className="text-2xl font-mono font-black text-slate-900 dark:text-slate-50">{stats.avgScore}%</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">Target: &gt;75%</span>
          </div>
        </div>

        {/* Tracking Hours */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider">Total Tracked</span>
            <span className="text-2xl font-mono font-black text-slate-900 dark:text-slate-50">{stats.totalMins}m</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold block mt-0.5">{filteredSessions.length} total sessions</span>
          </div>
        </div>

        {/* Eye Strain / Blink Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="p-3 bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/40 rounded-xl">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider">Avg Blink Rate</span>
            <span className="text-2xl font-mono font-black text-slate-900 dark:text-slate-50">{stats.avgBlinkRate}</span>
            <span className="text-[10px] text-slate-650 dark:text-slate-350 font-bold ml-1">/ min</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold block mt-0.5">Optimal: 12-15/min</span>
          </div>
        </div>

        {/* Streak Counter */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider">Streak Days</span>
            <span className="text-2xl font-mono font-black text-slate-900 dark:text-slate-50">{streak} Days</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">Consecutive days &gt;75%</span>
          </div>
        </div>
      </div>

      {/* Charts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Graph - Line chart (Spans 8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-6">Daily Posture Score Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={theme === "dark" ? { backgroundColor: "#020617", borderColor: "#334155", color: "#f8fafc", borderRadius: 12 } : { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: 12 }} 
                  labelClassName="font-bold text-[10px] text-slate-600 dark:text-slate-300"
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Posture Score (%)" 
                  stroke="#0d9488" 
                  strokeWidth={3} 
                  dot={{ r: 4, stroke: "#2dd4bf", strokeWidth: 1 }}
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Split - Donut Chart (Spans 4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-4">Posture Status Split</h3>
          <div className="flex-1 h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusSplitData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusSplitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={theme === "dark" ? { backgroundColor: "#020617", borderColor: "#334155", color: "#f8fafc", borderRadius: 12 } : { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: 12 }}
                  formatter={(value) => [`${value}%`, "Split"]}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center score display */}
            <div className="absolute text-center">
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider">Optimal</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {statusSplitData[0].value}%
              </span>
            </div>
          </div>
          
          {/* Legend Details */}
          <div className="space-y-2 mt-4">
            {statusSplitData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-50">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issue Frequency - Bar Chart (Spans 6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-6">Ergonomic Issues Volume</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueFrequencyData}>
                <CartesianGrid stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <YAxis stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={theme === "dark" ? { backgroundColor: "#020617", borderColor: "#334155", color: "#f8fafc", borderRadius: 12 } : { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: 12 }}
                  formatter={(value) => [`${value}s`, "Time spent"]}
                  labelClassName="font-bold text-[10px] text-slate-600 dark:text-slate-300"
                />
                <Bar dataKey="value" name="Violation Time (s)" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {issueFrequencyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === "Slouching" || entry.name === "Neck Strain" ? "#f43f5e" : "#f59e0b"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blink rate graph - Line/Area chart (Spans 6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-6">Blink Rate per Session (Eye Strain Index)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <YAxis stroke={theme === "dark" ? "#cbd5e1" : "#475569"} fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={theme === "dark" ? { backgroundColor: "#020617", borderColor: "#334155", color: "#f8fafc", borderRadius: 12 } : { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: 12 }}
                  formatter={(value) => [`${value} bpm`, "Blink Rate"]}
                  labelClassName="font-bold text-[10px] text-slate-600 dark:text-slate-300"
                />
                <Line 
                  type="monotone" 
                  dataKey="blinkRate" 
                  name="Blink rate (bpm)" 
                  stroke="#06b6d4" 
                  strokeWidth={3} 
                  dot={{ r: 4, stroke: "#22d3ee", strokeWidth: 1 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
