import session from "express-session";
import type { RequestHandler } from "express";
import { firestore, COLLECTIONS, Timestamp } from "@workspace/db";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    firebaseUid?: string;
    isAdmin?: boolean;
    createdOrderIds?: string[];
  }
}

class FirestoreSessionStore extends session.Store {
  private collection() { return firestore.collection(COLLECTIONS.sessions); }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    this.collection().doc(sid).get().then((doc) => {
      if (!doc.exists) { callback(null, null); return; }
      const data = doc.data() as { data: string; expiresAt: Timestamp };
      if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
        this.collection().doc(sid).delete().finally(() => callback(null, null)); return;
      }
      try { callback(null, JSON.parse(data.data) as session.SessionData); } catch (e) { callback(e); }
    }).catch((err) => { logger.error({ err }, '[FirestoreSession.get] error'); callback(err); });
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    const expiryMs = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 1000 * 60 * 60 * 24 * 30;
    const payload = { data: JSON.stringify(sessionData), expiresAt: Timestamp.fromMillis(expiryMs) };
    this.collection().doc(sid).set(payload).then(() => callback?.()).catch((err) => { logger.error({ err }, '[FirestoreSession.set] error'); callback?.(err); });
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.collection().doc(sid).delete().then(() => callback?.()).catch((err) => callback?.(err));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: () => void): void {
    this.set(sid, sessionData, () => callback?.());
  }
}

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) throw new Error("SESSION_SECRET is required");
const isProduction = process.env.NODE_ENV === "production";

export const sessionMiddleware: RequestHandler = session({
  store: new FirestoreSessionStore(),
  name: "lenz.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: isProduction ? "none" : "lax", secure: isProduction, maxAge: 1000 * 60 * 60 * 24 * 30 },
});

// Purges expired session documents from Firestore on a fixed interval (default: every 6 hours).
// Handles up to 500 expired docs per run; multiple intervals will handle backlogs over time.
export function startSessionCleanup(intervalMs = 6 * 60 * 60 * 1000): void {
  const run = async () => {
    try {
      const now = Timestamp.now();
      const snap = await firestore
        .collection(COLLECTIONS.sessions)
        .where("expiresAt", "<", now)
        .limit(500)
        .get();
      if (snap.empty) return;
      const batch = firestore.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
      logger.info({ count: snap.size }, "Session cleanup: purged expired sessions");
    } catch (err) {
      logger.warn({ err }, "Session cleanup: failed — will retry next interval");
    }
  };
  setInterval(run, intervalMs);
  run().catch(() => {});
}
