// src/lib/firestore.ts
// All session persistence — reads/writes go to Firestore, scoped per user.
// Path: users/{uid}/sessions/{sessionId}

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SessionHistoryItem } from "../types/posture";

const sessionsRef = (uid: string) =>
  collection(db, "users", uid, "sessions");

// ── Save a completed session ──────────────────────────────────────────────────
export const saveSessionFS = async (
  uid: string,
  session: SessionHistoryItem
): Promise<void> => {
  const ref = doc(sessionsRef(uid), session.id);
  await setDoc(ref, {
    ...session,
    // Store as Firestore Timestamp for range queries
    startedAtTs: Timestamp.fromDate(new Date(session.startedAt)),
  });
};

// ── Load sessions for a user, optionally filtered by day range ────────────────
// NOTE: The compound query (where + orderBy on different fields) requires a
// Firestore composite index. If that index doesn't exist yet, we fall back to
// fetching all sessions and filtering client-side so the UI still works.
export const getSessionsFS = async (
  uid: string,
  days?: number          // undefined = all time
): Promise<SessionHistoryItem[]> => {
  const since = days
    ? (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })()
    : null;

  // Try the indexed compound query first
  try {
    let q;
    if (since) {
      q = query(
        sessionsRef(uid),
        where("startedAtTs", ">=", Timestamp.fromDate(since)),
        orderBy("startedAtTs", "desc")
      );
    } else {
      q = query(sessionsRef(uid), orderBy("startedAtTs", "desc"));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as SessionHistoryItem & { startedAtTs: Timestamp };
      const { startedAtTs, ...session } = data;
      return session;
    });
  } catch (err: unknown) {
    // Composite index not yet built → fall back to full fetch + client filter
    const isIndexError =
      err instanceof Error && err.message.toLowerCase().includes("index");
    if (!isIndexError) throw err;

    console.warn(
      "[Firestore] Composite index missing — falling back to client-side filter. " +
      "Create the index at: https://console.firebase.google.com/project/_/firestore/indexes"
    );

    const snap = await getDocs(query(sessionsRef(uid)));
    const all = snap.docs.map(d => {
      const data = d.data() as SessionHistoryItem & { startedAtTs?: Timestamp };
      const { startedAtTs, ...session } = data;
      return session;
    });

    const filtered = since
      ? all.filter(s => new Date(s.startedAt) >= since)
      : all;

    return filtered.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }
};

// ── Delete a single session ───────────────────────────────────────────────────
export const deleteSessionFS = async (
  uid: string,
  sessionId: string
): Promise<void> => {
  await deleteDoc(doc(sessionsRef(uid), sessionId));
};