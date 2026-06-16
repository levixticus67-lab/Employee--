import "./instrument.js";
import app from "./app";
import { logger } from "./lib/logger";
import { startSessionCleanup } from "./middlewares/session";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Session cleanup: purge expired Firestore session docs every 6 hours
  startSessionCleanup();
  logger.info("Session cleanup job started (6h interval)");

  // Keep-alive: ping own health endpoint every 5 minutes to prevent
  // Render free tier from sleeping after inactivity.
  const backendUrl = (
    process.env["RENDER_EXTERNAL_URL"] ??
    process.env["BACKEND_URL"] ??
    ""
  ).replace(/\/$/, "");
  if (backendUrl) {
    setInterval(() => {
      fetch(`${backendUrl}/api/healthz`)
        .then(() => logger.debug("Keep-alive ping sent"))
        .catch((pingErr) => logger.warn({ err: pingErr }, "Keep-alive ping failed"));
    }, 5 * 60 * 1000); // every 5 minutes
    logger.info({ backendUrl }, "Keep-alive pinger started (5 min interval)");
  } else {
    logger.warn("RENDER_EXTERNAL_URL / BACKEND_URL not set — keep-alive pinger disabled");
  }
});
