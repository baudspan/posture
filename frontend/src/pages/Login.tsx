import React from "react";
import { useAuth } from "../store/authStore";

export const Login: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-10 flex flex-col items-center gap-6 w-full max-w-sm shadow-2xl">
        <h1 className="text-2xl font-bold text-white">Posture Guardian</h1>
        <p className="text-slate-400 text-sm text-center">
          Sign in to track your posture sessions
        </p>
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-100 transition"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
};
