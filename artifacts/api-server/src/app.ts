import express, { type Express } from "express";
  import cors from "cors";
  import helmet from "helmet";
  import pinoHttp from "pino-http";
  import { seedProductsIfEmpty } from "@workspace/db";
  import router from "./routes";
  import { logger } from "./lib/logger";
  import { sessionMiddleware } from "./middlewares/session";

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

  // Cap request bodies at 100 kb to prevent resource exhaustion from
  // oversized payloads sent to any route.
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(sessionMiddleware);

  app.use("/api", router);

  seedProductsIfEmpty()
    .then(() => logger.info("Firestore product seed check complete"))
    .catch((err) => logger.error({ err }, "Failed to seed Firestore products"));

  export default app;
  