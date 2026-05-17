import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { seedProductsIfEmpty } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./middlewares/session";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

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
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use("/api", router);

seedProductsIfEmpty()
  .then(() => logger.info("Firestore product seed check complete"))
  .catch((err) => logger.error({ err }, "Failed to seed Firestore products"));

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const staticPath = join(__dirnameLocal, "../../jojo-collections/dist/public");

if (existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.use((_req, res) => {
    res.sendFile(join(staticPath, "index.html"));
  });
}

export default app;
