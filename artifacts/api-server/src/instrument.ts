import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Silently disabled when SENTRY_DSN is not set (local dev / unset env)
  enabled: !!process.env.SENTRY_DSN,
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,
  // Disable gRPC auto-instrumentation — Sentry v8 patches @grpc/grpc-js via
  // import-in-the-middle, which breaks firebase-admin's Firestore connection
  // and causes every Firestore call to fail with gRPC code 5 NOT_FOUND.
  integrations: (defaultIntegrations) =>
    defaultIntegrations.filter((integration) => integration.name !== "Grpc"),
});
