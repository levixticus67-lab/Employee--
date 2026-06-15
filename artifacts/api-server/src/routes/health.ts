import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { firestore } from "@workspace/db";
import { getAuth } from "firebase-admin/auth";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/deep", async (_req, res) => {
  const results: Record<string, { ok: boolean; error?: string; detail?: string }> = {};

  // 0 — Show which project the service account points to (project_id is NOT a secret)
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] ?? process.env["FIREBASE_SERVICE_ACCOUNT"] ?? "";
  let projectId = "(could not parse)";
  let clientEmail = "(could not parse)";
  let privateKeySnippet = "(could not parse)";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    projectId = parsed["project_id"] ?? "(missing)";
    clientEmail = parsed["client_email"] ?? "(missing)";
    const pk = parsed["private_key"] ?? "";
    // Show first/last 30 chars and length — never full key
    privateKeySnippet = pk.length > 0
      ? `len=${pk.length} starts=${pk.slice(0, 30).replace(/\n/g, "\\n")} ends=${pk.slice(-20).replace(/\n/g, "\\n")}`
      : "(missing)";
  } catch {
    projectId = "(invalid JSON)";
  }
  results["service_account"] = {
    ok: true,
    detail: `project_id=${projectId} | client_email=${clientEmail} | json_length=${raw.length} | private_key=${privateKeySnippet}`,
  };

  // 1 — Firestore write/read test with full error detail
  try {
    const ref = firestore.collection("_healthz").doc("ping");
    await ref.set({ ts: Date.now() });
    await ref.delete();
    results["firestore"] = { ok: true, detail: `database=(default) project=${projectId}` };
  } catch (err: unknown) {
    const e = err as { code?: string | number; message?: string; details?: string; stack?: string };
    results["firestore"] = {
      ok: false,
      error: String(e.code ?? "unknown"),
      detail: [
        `message=${e.message ?? "(empty)"}`,
        `details=${e.details ?? "(none)"}`,
        `stack_head=${(e.stack ?? "").slice(0, 200).replace(/\n/g, " ")}`,
      ].join(" | "),
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

  // 3 — Env presence check
  results["env"] = {
    ok: true,
    detail: [
      `SESSION_SECRET=${process.env["SESSION_SECRET"] ? "SET" : "MISSING"}`,
      `ADMIN_EMAIL=${process.env["ADMIN_EMAIL"] ?? "MISSING"}`,
      `CORS_ORIGINS=${process.env["CORS_ORIGINS"] || "EMPTY"}`,
      `FRONTEND_URL=${process.env["FRONTEND_URL"] || "EMPTY"}`,
      `NODE_ENV=${process.env["NODE_ENV"] || "EMPTY"}`,
      `FIREBASE_DATABASE_ID=${process.env["FIREBASE_DATABASE_ID"] || "(not set = uses default)"}`,
    ].join(" | "),
  };

  const allOk = Object.values(results).every((r) => r.ok);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    checks: results,
  });
});

export default router;
