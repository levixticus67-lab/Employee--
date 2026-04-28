import session from "express-session";
import type { RequestHandler } from "express";
import { firestore, COLLECTIONS, Timestamp } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    isAdmin?: boolean;
  }
}

class FirestoreSessionStore extends session.Store {
  private collection() {
    return firestore.collection(COLLECTIONS.sessions);
  }

  get(
    sid: string,
    callback: (err: unknown, session?: session.SessionData | null) => void,
  ): void {
    this.collection()
      .doc(sid)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          callback(null, null);
          return;
        }
        const data = doc.data() as { data: string; expiresAt: Timestamp };
        if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
          this.collection()
            .doc(sid)
            .delete()
            .finally(() => callback(null, null));
          return;
        }
        try {
          const parsed = JSON.parse(data.data) as session.SessionData;
          callback(null, parsed);
        } catch (e) {
          callback(e);
        }
      })
      .catch((err) => callback(err));
  }

  set(
    sid: string,
    sessionData: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const expiryMs =
      sessionData.cookie && sessionData.cookie.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 1000 * 60 * 60 * 24 * 30;
    const payload = {
      data: JSON.stringify(sessionData),
      expiresAt: Timestamp.fromMillis(expiryMs),
    };
    this.collection()
      .doc(sid)
      .set(payload)
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.collection()
      .doc(sid)
      .delete()
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  touch(
    sid: string,
    sessionData: session.SessionData,
    callback?: () => void,
  ): void {
    this.set(sid, sessionData, () => callback?.());
  }
}

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required");
}

const isProduction = process.env.NODE_ENV === "production";

export const sessionMiddleware: RequestHandler = session({
  store: new FirestoreSessionStore(),
  name: "jojo.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
