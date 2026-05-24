// src/store/authStore.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, provider } from "../lib/firebase";
import type { UserSession } from "../types/posture";

interface AuthContextType {
  user: UserSession | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;          // Google Sign-In popup
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Map Firebase User → UserSession so the rest of the app is untouched
  const user: UserSession | null = firebaseUser
    ? {
        id:        firebaseUser.uid,
        name:      firebaseUser.displayName ?? firebaseUser.email ?? "User",
        email:     firebaseUser.email ?? "",
        createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
      }
    : null;

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign-in failed:", err);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, logout, isAuthenticated: !!firebaseUser }}>
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
