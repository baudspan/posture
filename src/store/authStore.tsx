// src/store/authStore.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserSession } from "../types/posture";
import { getUser, saveUser, clearUser } from "../lib/localStorage";

interface AuthContextType {
  user: UserSession | null;
  login: (name: string, email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    const loadedUser = getUser();
    if (loadedUser) {
      setUser(loadedUser);
    }
  }, []);

  const login = (name: string, email: string) => {
    const newUser: UserSession = {
      id: "usr_" + Math.random().toString(36).substr(2, 9),
      name,
      email,
      createdAt: new Date().toISOString()
    };
    saveUser(newUser);
    setUser(newUser);
  };

  const logout = () => {
    clearUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
