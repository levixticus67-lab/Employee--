import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { getAuth } from "firebase-admin/auth";
import { firestore, COLLECTIONS, Timestamp, type UserDoc } from "@workspace/db";
import { SignupBody, LoginBody, AdminLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid signup data" });
    return;
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const rawBody = req.body as Record<string, unknown>;
  const firebaseUid = (rawBody["firebaseUid"] as string | undefined) ?? null;

  const existing = await firestore
    .collection(COLLECTIONS.users)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();
  if (!existing.empty) {
    res.status(400).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const data: UserDoc = {
    name,
    email: normalizedEmail,
    passwordHash,
    createdAt: Timestamp.now(),
    emailVerified: firebaseUid ? false : true,
    firebaseUid: firebaseUid ?? null,
    phoneNumber: null,
  };
  const ref = await firestore.collection(COLLECTIONS.users).add(data);

  if (!firebaseUid) {
    req.session.userId = ref.id;
  }
  res.status(201).json({ id: ref.id, email: data.email, name: data.name });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const snap = await firestore
    .collection(COLLECTIONS.users)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();
  if (snap.empty) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const userDoc = snap.docs[0]!;
  const user = userDoc.data() as UserDoc;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.emailVerified === false) {
    res.status(403).json({
      error:
        "Please check your inbox and verify your email link to activate your account and log in.",
    });
    return;
  }

  req.session.userId = userDoc.id;
  res.status(200).json({ id: userDoc.id, email: user.email, name: user.name });
});

router.post("/auth/login-firebase", async (req, res) => {
  const { firebaseIdToken } = req.body as { firebaseIdToken?: string };
  if (!firebaseIdToken) {
    res.status(400).json({ error: "firebaseIdToken is required" });
    return;
  }

  let decodedToken: Awaited<ReturnType<ReturnType<typeof getAuth>["verifyIdToken"]>>;
  try {
    decodedToken = await getAuth().verifyIdToken(firebaseIdToken);
  } catch (err) {
    req.log.warn({ err }, "Firebase token verification failed");
    res.status(401).json({ error: "Invalid or expired authentication token" });
    return;
  }

  if (!decodedToken.email_verified) {
    res.status(403).json({
      error:
        "Please check your inbox and verify your email link to activate your account and log in.",
    });
    return;
  }

  const email = (decodedToken.email ?? "").toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: "Token does not contain an email address" });
    return;
  }

  const snap = await firestore
    .collection(COLLECTIONS.users)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    res.status(401).json({ error: "Account not found. Please sign up first." });
    return;
  }

  const userDoc = snap.docs[0]!;
  const user = userDoc.data() as UserDoc;

  await firestore.collection(COLLECTIONS.users).doc(userDoc.id).update({
    emailVerified: true,
    firebaseUid: decodedToken.uid,
  });

  req.session.userId = userDoc.id;
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Session save failed");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.status(200).json({ id: userDoc.id, email: user.email, name: user.name });
  });
});

router.post("/auth/logout", (req, res) => {
  if (!req.session) {
    res.status(204).end();
    return;
  }
  req.session.userId = undefined;
  req.session.save(() => {
    res.status(204).end();
  });
});

router.get("/auth/me", async (req, res) => {
  const isAdmin = Boolean(req.session?.isAdmin);
  const userId = req.session?.userId;
  if (!userId) {
    res.json({ user: null, isAdmin });
    return;
  }
  const doc = await firestore.collection(COLLECTIONS.users).doc(userId).get();
  if (!doc.exists) {
    res.json({ user: null, isAdmin });
    return;
  }
  const u = doc.data() as UserDoc;
  res.json({
    user: { id: doc.id, email: u.email, name: u.name, emailVerified: u.emailVerified !== false },
    isAdmin,
  });
});

router.post("/admin/auth/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) {
    res.status(500).json({ error: "Admin password is not configured" });
    return;
  }
  if (parsed.data.password !== expected) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  req.session.isAdmin = true;
  req.session.save(() => {
    res.status(204).end();
  });
});

router.post("/admin/auth/logout", (req, res) => {
  if (!req.session) {
    res.status(204).end();
    return;
  }
  req.session.isAdmin = false;
  req.session.save(() => {
    res.status(204).end();
  });
});

export default router;
