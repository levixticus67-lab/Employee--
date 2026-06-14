import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { firestore } from "@workspace/db";
import { getAuth } from "firebase-admin/auth";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/deep", async (req, res) => {
  const results: Record<string, { ok: boolean; error?: string; detail?: string }> = {};

  // 1 — Firestore write test
  try {
    const ref = firestore.collection("_healthz").doc("ping");
    await ref.set({ ts: Date.now() });
    await ref.delete();
    results["firestore"] = { ok: true };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    results["firestore"] = {
      ok: false,
      error: e.code ?? "unknown",
      detail: e.message ?? String(err),
    };
  }

  // 2 — Firebase Auth admin SDK test
  try {
    await getAuth().listUsers(1);
    results["firebase_auth"] = { ok: true };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    results["firebase_auth"] = {
      ok: false,
      error: e.code ?? "unknown",
      detail: e.message ?? String(err),
    };
  }

  // 3 — env var presence check (values hidden)
  results["env"] = {
    ok: true,
    detail: [
      `FIREBASE_SERVICE_ACCOUNT_JSON=${process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] ? "SET("+process.env["FIREBASE_SERVICE_ACCOUNT_JSON"].length+"chars)" : "MISSING"}`,
      `FIREBASE_SERVICE_ACCOUNT=${process.env["FIREBASE_SERVICE_ACCOUNT"] ? "SET" : "MISSING"}`,
      `SESSION_SECRET=${process.env["SESSION_SECRET"] ? "SET" : "MISSING"}`,
      `ADMIN_EMAIL=${process.env["ADMIN_EMAIL"] ? "SET" : "MISSING"}`,
      `CORS_ORIGINS=${process.env["CORS_ORIGINS"] || "EMPTY"}`,
      `FRONTEND_URL=${process.env["FRONTEND_URL"] || "EMPTY"}`,
      `NODE_ENV=${process.env["NODE_ENV"] || "EMPTY"}`,
    ].join(" | "),
  };

  const allOk = Object.values(results).every((r) => r.ok);
  res.status(allOk ? 200 : 503).json({ status: allOk ? "ok" : "degraded", checks: results });
});

export default router;
