import React, { useState } from "react";
import { PersonStanding, LogIn } from "lucide-react";
import { useAuth } from "../store/authStore";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setError("");
    login(name.trim(), email.trim());
  };

  const handleGoogleMock = () => {
    login("Tanya (Google)", "tanya.google@example.com");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden select-none transition-colors duration-300">
      {/* Background gradients for aesthetics */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white border-none p-3 rounded-2xl shadow-xl shadow-emerald-500/10 mb-4 animate-pulse">
            <PersonStanding className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 m-0">
            POSTURE GUARD
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-2 text-center">
            Real-time ergonomic monitoring & eye strain prevention.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold text-center animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-teal-500 dark:focus:border-teal-500 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-teal-500 dark:focus:border-teal-500 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 hover:brightness-110 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-500/10 active:scale-98 transition-all duration-300 border-none cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Get Started
          </button>
        </form>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800/80"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 dark:text-slate-350 uppercase tracking-widest">
            or connect with
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800/80"></div>
        </div>

        {/* Mock Google Login */}
        <button
          onClick={handleGoogleMock}
          className="w-full flex items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-xl py-3 text-sm font-bold transition-all duration-300 active:scale-98 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.51 1.73 14.97 1 12 1 7.35 1 3.39 3.67 1.45 7.57l3.77 2.93c.9-2.7 3.41-4.46 6.78-4.46z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.46c-.28 1.47-1.11 2.71-2.36 3.55l3.67 2.84c2.14-1.97 3.38-4.87 3.38-8.48z"
            />
            <path
              fill="#FBBC05"
              d="M5.22 14.74a7.22 7.22 0 0 1 0-4.48L1.45 7.33A11.96 11.96 0 0 0 0 12c0 1.68.35 3.28 1.45 4.67l3.77-2.93z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.67-2.84c-1.1.74-2.51 1.18-4.29 1.18-3.37 0-5.88-1.76-6.78-4.46L1.45 16.9C3.39 20.33 7.35 23 12 23z"
            />
          </svg>
          Google
        </button>
      </div>
    </div>
  );
};

