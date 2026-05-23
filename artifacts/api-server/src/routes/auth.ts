import { Router, type IRouter } from "express";
  import bcrypt from "bcryptjs";
  import { getAuth } from "firebase-admin/auth";
  import { firestore, COLLECTIONS, Timestamp, type UserDoc } from "@workspace/db";
  import { SignupBody } from "@workspace/api-zod";

  const router: IRouter = Router();

  router.post("/auth/signup", async (req, res) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid signup data" }); return; }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const rawBody    = req.body as Record<string, unknown>;
    const firebaseUid = (rawBody["firebaseUid"] as string | undefined) ?? null;

    if (!firebaseUid) {
      res.status(400).json({
        error: "Firebase authentication is required. Please sign up through the app — direct API access is not permitted.",
      });
      return;
    }

    const existing = await firestore
      .collection(COLLECTIONS.users)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (!existing.empty) {
      res.status(400).json({ error: "An account with that email already exists" }); return;
    }

    const byUid = await firestore.collection(COLLECTIONS.users).doc(firebaseUid).get();
    if (byUid.exists) {
      res.status(400).json({ error: "An account with that email already exists" }); return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const data: UserDoc = {
      name, email: normalizedEmail, passwordHash,
      createdAt: Timestamp.now(),
      emailVerified: false,
      firebaseUid,
      phoneNumber: null,
    };
    await firestore.collection(COLLECTIONS.users).doc(firebaseUid).set(data);
    res.status(201).json({ id: firebaseUid, email: normalizedEmail, name });
  });

  router.post("/auth/login", (_req, res) => {
    res.status(410).json({
      error: "Password login is disabled. Please use Firebase Authentication.",
    });
  });

  router.post("/auth/login-firebase", async (req, res) => {
    const { firebaseIdToken } = req.body as { firebaseIdToken?: string };
    if (!firebaseIdToken) { res.status(400).json({ error: "firebaseIdToken is required" }); return; }

    let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>["verifyIdToken"]>>;
    try { decodedToken = await getAuth().verifyIdToken(firebaseIdToken); }
    catch (err) {
      req.log.warn({ err }, "Firebase token verification failed");
      res.status(401).json({ error: "Invalid or expired authentication token" }); return;
    }

    if (!decodedToken.email_verified) {
      res.status(403).json({
        error: "Please check your inbox and verify your email link to activate your account and log in. If you don't see it, check your spam or junk folder.",
      });
      return;
    }

    const email = (decodedToken.email ?? "").toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "Token does not contain an email address" }); return; }

    let userDocId: string;
    let user: UserDoc;

    const byUid = await firestore.collection(COLLECTIONS.users).doc(decodedToken.uid).get();
    if (byUid.exists) {
      userDocId = byUid.id;
      user      = byUid.data() as UserDoc;
    } else {
      const snap = await firestore
        .collection(COLLECTIONS.users)
        .where("email", "==", email)
        .limit(1)
        .get();
      if (snap.empty) {
        res.status(401).json({ error: "Account not found. Please sign up first." }); return;
      }
      userDocId = snap.docs[0]!.id;
      user      = snap.docs[0]!.data() as UserDoc;
    }

    await firestore.collection(COLLECTIONS.users).doc(userDocId).update({
      emailVerified: true,
      firebaseUid: decodedToken.uid,
    });

    req.session.userId      = userDocId;
    req.session.firebaseUid = decodedToken.uid;
    req.session.save((err) => {
      if (err) { req.log.error({ err }, "Session save failed"); res.status(500).json({ error: "Session error" }); return; }
      res.status(200).json({ id: userDocId, email: user.email, name: user.name });
    });
  });

  router.post("/auth/logout", (req, res) => {
    if (!req.session) { res.status(204).end(); return; }
    req.session.userId      = undefined;
    req.session.firebaseUid = undefined;
    req.session.save(() => res.status(204).end());
  });

  router.get("/auth/me", async (req, res) => {
    const isAdmin = Boolean(req.session?.isAdmin);
    const userId  = req.session?.userId;
    if (!userId) { res.json({ user: null, isAdmin }); return; }
    const doc = await firestore.collection(COLLECTIONS.users).doc(userId).get();
    if (!doc.exists) { res.json({ user: null, isAdmin }); return; }
    const u = doc.data() as UserDoc;
    res.json({
      user: {
        id: doc.id, email: u.email, name: u.name,
        emailVerified: u.emailVerified !== false,
        firebaseUid: u.firebaseUid ?? null,
      },
      isAdmin,
    });
  });

  router.post("/admin/auth/login", async (req, res) => {
    const { firebaseIdToken } = req.body as { firebaseIdToken?: string };
    if (!firebaseIdToken) {
      res.status(400).json({
        error: "A Firebase ID token is required. Please sign in through the admin login page.",
      });
      return;
    }

    const adminEmail = process.env["ADMIN_EMAIL"];
    if (!adminEmail) {
      req.log.error("ADMIN_EMAIL env var is not set — admin login cannot proceed");
      res.status(500).json({ error: "Admin access is not configured on this server. Set ADMIN_EMAIL." });
      return;
    }

    let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>["verifyIdToken"]>>;
    try { decodedToken = await getAuth().verifyIdToken(firebaseIdToken); }
    catch (err) {
      req.log.warn({ err }, "Admin: Firebase token verification failed");
      res.status(401).json({ error: "Invalid or expired authentication token" }); return;
    }

    const tokenEmail = (decodedToken.email ?? "").toLowerCase().trim();
    if (tokenEmail !== adminEmail.toLowerCase().trim()) {
      req.log.warn({ tokenEmail }, "Admin: email does not match ADMIN_EMAIL");
      res.status(403).json({ error: "This account does not have admin access" }); return;
    }

    req.session.isAdmin = true;
    req.session.save((err) => {
      if (err) { req.log.error({ err }, "Session save failed"); res.status(500).json({ error: "Session error" }); return; }
      res.status(204).end();
    });
  });

  router.post("/admin/auth/logout", (req, res) => {
    if (!req.session) { res.status(204).end(); return; }
    req.session.isAdmin = false;
    req.session.save(() => res.status(204).end());
  });

  export default router;
