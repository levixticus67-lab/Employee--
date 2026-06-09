import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Silently disabled when SENTRY_DSN is not set (local dev / unset env)
  enabled: !!process.env.SENTRY_DSN,
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,
});
