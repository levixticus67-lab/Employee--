import { Router, type IRouter } from "express";
  import bcrypt from "bcryptjs";
  import { getAuth } from "firebase-admin/auth";
  import { firestore, COLLECTIONS, Timestamp, type UserDoc } from "@workspace/db";
  import { SignupBody, LoginBody } from "@workspace/api-zod";

  const router: IRouter = Router();

  // ── Customer signup ───────────────────────────────────────────────────────────
  // When Firebase Auth has already created the account client-side, the caller
  // passes firebaseUid so we use it as the Firestore document ID (Firebase UID
  // is the canonical identity across all services). Without firebaseUid we fall
  // back to an auto-generated Firestore ID for legacy / non-Firebase flows.
  router.post("/auth/signup", async (req, res) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid signup data" }); return; }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const rawBody    = req.body as Record<string, unknown>;
    const firebaseUid = (rawBody["firebaseUid"] as string | undefined) ?? null;

    const existing = await firestore
      .collection(COLLECTIONS.users)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (!existing.empty) {
      res.status(400).json({ error: "An account with that email already exists" }); return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (firebaseUid) {
      // ── Firebase-backed user: use Firebase UID as Firestore document ID ──────
      const data: UserDoc = {
        name, email: normalizedEmail, passwordHash,
        createdAt: Timestamp.now(),
        emailVerified: false,   // will be set true on first Firebase-verified login
        firebaseUid,
        phoneNumber: null,
      };
      await firestore.collection(COLLECTIONS.users).doc(firebaseUid).set(data);
      // Do NOT start a session — the account is unverified
      res.status(201).json({ id: firebaseUid, email: normalizedEmail, name });
    } else {
      // ── Legacy / fallback path (no Firebase) ─────────────────────────────────
      const data: UserDoc = {
        name, email: normalizedEmail, passwordHash,
        createdAt: Timestamp.now(),
        emailVerified: true,
        firebaseUid: null, phoneNumber: null,
      };
      const ref = await firestore.collection(COLLECTIONS.users).add(data);
      req.session.userId = ref.id;
      res.status(201).json({ id: ref.id, email: normalizedEmail, name });
    }
  });

  // ── Customer login (password-based, legacy) ───────────────────────────────────
  router.post("/auth/login", async (req, res) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) { res.status(401).json({ error: "Invalid email or password" }); return; }
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const snap = await firestore
      .collection(COLLECTIONS.users)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (snap.empty) { res.status(401).json({ error: "Invalid email or password" }); return; }

    const userDoc = snap.docs[0]!;
    const user    = userDoc.data() as UserDoc;
    const ok      = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { res.status(401).json({ error: "Invalid email or password" }); return; }
    if (user.emailVerified === false) {
      res.status(403).json({ error: "Please check your inbox and verify your email link to activate your account and log in." });
      return;
    }
    req.session.userId = userDoc.id;
    res.status(200).json({ id: userDoc.id, email: user.email, name: user.name });
  });

  // ── Customer login (Firebase ID token) ───────────────────────────────────────
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
      res.status(403).json({ error: "Please check your inbox and verify your email link to activate your account and log in." });
      return;
    }

    const email = (decodedToken.email ?? "").toLowerCase().trim();
    if (!email) { res.status(400).json({ error: "Token does not contain an email address" }); return; }

    const snap = await firestore
      .collection(COLLECTIONS.users)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snap.empty) { res.status(401).json({ error: "Account not found. Please sign up first." }); return; }

    const userDoc = snap.docs[0]!;
    const user    = userDoc.data() as UserDoc;

    // Stamp emailVerified and keep firebaseUid in sync
    await firestore.collection(COLLECTIONS.users).doc(userDoc.id).update({
      emailVerified: true,
      firebaseUid: decodedToken.uid,
    });

    req.session.userId      = userDoc.id;
    req.session.firebaseUid = decodedToken.uid;
    req.session.save((err) => {
      if (err) { req.log.error({ err }, "Session save failed"); res.status(500).json({ error: "Session error" }); return; }
      res.status(200).json({ id: userDoc.id, email: user.email, name: user.name });
    });
  });

  // ── Customer logout ───────────────────────────────────────────────────────────
  router.post("/auth/logout", (req, res) => {
    if (!req.session) { res.status(204).end(); return; }
    req.session.userId      = undefined;
    req.session.firebaseUid = undefined;
    req.session.save(() => res.status(204).end());
  });

  // ── Current user ──────────────────────────────────────────────────────────────
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

  // ── Admin login ───────────────────────────────────────────────────────────────
  // Supports two modes:
  //   Mode A (preferred) — Firebase ID token: the frontend signs in to Firebase,
  //     gets a short-lived cryptographic token, and sends it here. We verify it
  //     server-side and confirm the email matches ADMIN_EMAIL.
  //   Mode B (fallback) — email + password: used when Firebase is not configured
  //     on the frontend build (missing VITE_FIREBASE_* env vars). Compares
  //     directly against ADMIN_EMAIL + ADMIN_PASSWORD env vars.
  router.post("/admin/auth/login", async (req, res) => {
    const body = req.body as { firebaseIdToken?: string; email?: string; password?: string };

    if (body.firebaseIdToken) {
      // ── Mode A: Firebase token ──────────────────────────────────────────────
      const adminEmail = process.env["ADMIN_EMAIL"];
      if (!adminEmail) {
        res.status(500).json({ error: "ADMIN_EMAIL is not configured on this server" }); return;
      }
      let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>["verifyIdToken"]>>;
      try { decodedToken = await getAuth().verifyIdToken(body.firebaseIdToken); }
      catch (err) {
        req.log.warn({ err }, "Admin Firebase token verification failed");
        res.status(401).json({ error: "Invalid or expired authentication token" }); return;
      }
      const tokenEmail = (decodedToken.email ?? "").toLowerCase().trim();
      if (tokenEmail !== adminEmail.toLowerCase().trim()) {
        res.status(403).json({ error: "This account does not have admin access" }); return;
      }
      req.session.isAdmin = true;
      req.session.save((err) => {
        if (err) { req.log.error({ err }, "Session save failed"); res.status(500).json({ error: "Session error" }); return; }
        res.status(204).end();
      });
      return;
    }

    // ── Mode B: direct email + password against env vars ─────────────────────
    const expectedEmail    = process.env["ADMIN_EMAIL"];
    const expectedPassword = process.env["ADMIN_PASSWORD"];
    if (!expectedEmail || !expectedPassword) {
      res.status(500).json({ error: "Admin credentials are not configured on this server" }); return;
    }
    const emailOk    = (body.email    ?? "").toLowerCase().trim() === expectedEmail.toLowerCase().trim();
    const passwordOk = (body.password ?? "")                      === expectedPassword;
    if (!emailOk || !passwordOk) {
      res.status(401).json({ error: "Invalid admin email or password" }); return;
    }
    req.session.isAdmin = true;
    req.session.save(() => res.status(204).end());
  });

  // ── Admin logout ──────────────────────────────────────────────────────────────
  router.post("/admin/auth/logout", (req, res) => {
    if (!req.session) { res.status(204).end(); return; }
    req.session.isAdmin = false;
    req.session.save(() => res.status(204).end());
  });

  export default router;
  