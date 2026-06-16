import express, { type Express } from "express";
  import cors from "cors";
  import helmet from "helmet";
  import rateLimit from "express-rate-limit";
  import pinoHttp from "pino-http";
  import { seedProductsIfEmpty } from "@workspace/db";
  import router from "./routes";
  import healthRouter from "./routes/health";
  import { logger } from "./lib/logger";
  import { sessionMiddleware } from "./middlewares/session";
import { setupExpressErrorHandler } from "@sentry/node";

  const app: Express = express();

  app.set("trust proxy", 1);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === "production";

  // ── Security headers ────────────────────────────────────────────────────────
  // Adds X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, etc.
  app.use(helmet());

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(
    cors({
      // Fail-closed: in production, reject all cross-origin requests when
      // CORS_ORIGINS is not configured. In development, allow all origins
      // so local testing works without env setup.
      origin: allowedOrigins.length > 0 ? allowedOrigins : (isProduction ? false : true),
      credentials: true,
    }),
  );

  // Global rate limiter — 200 req/min per IP across all endpoints.
  // Auth routes have their own tighter limits (10 req/15 min) applied in auth.ts.
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
    skip: (req) => req.path === "/api/healthz" || req.path === "/api/healthz/deep",
  }));

  // Cap request bodies at 100 kb to prevent resource exhaustion from
  // oversized payloads sent to any route.
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Mount health routes BEFORE session middleware so /api/healthz and
  // /api/healthz/deep are always reachable even when Firestore is down.
  app.use("/api", healthRouter);

  app.use(sessionMiddleware);

  app.use("/api", router);

  // Sentry must come after all routes and before any other error handlers
  setupExpressErrorHandler(app);

  seedProductsIfEmpty()
    .then(() => logger.info("Firestore product seed check complete"))
    .catch((err) => logger.error({ err }, "Failed to seed Firestore products"));

  export default app;
