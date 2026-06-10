import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const SITE_NAME = "LENZ";

// Derived automatically from Firebase environment — no hardcoding needed
function getFrontendUrl(): string {
  if (process.env["FRONTEND_URL"]) return process.env["FRONTEND_URL"].replace(/\/$/, "");
  try {
    const cfg = JSON.parse(process.env["FIREBASE_CONFIG"] ?? "{}") as { projectId?: string };
    if (cfg.projectId) return `https://${cfg.projectId}.web.app`;
  } catch {}
  return "";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const ogPreview = functions.https.onRequest(async (req, res) => {
  const FRONTEND_URL = getFrontendUrl();

  // Path comes in as /product/:id (Firebase Hosting passes the original path)
  const match = req.path.match(/^\/product\/([^/]+)/);
  const productId = match?.[1] ?? "";
  const productUrl = productId ? `${FRONTEND_URL}/product/${productId}` : FRONTEND_URL;

  if (!productId) {
    res.redirect(302, FRONTEND_URL || "/");
    return;
  }

  try {
    const doc = await db.collection("products").doc(productId).get();

    if (!doc.exists) {
      res.redirect(302, productUrl);
      return;
    }

    const p = doc.data()!;
    const title    = escapeHtml(`${String(p["name"] ?? "")} — ${SITE_NAME}`);
    const desc     = escapeHtml((String(p["description"] ?? `Shop ${p["name"]} at ${SITE_NAME}.`)).slice(0, 200));
    const imageRaw = String(p["imageUrl"] ?? "");
    const image    = imageRaw ? escapeHtml(imageRaw) : "";
    const url      = escapeHtml(productUrl);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    ${image ? `<meta property="og:image" content="${image}" />
    <meta property="og:image:alt" content="${title}" />
    <meta name="twitter:image" content="${image}" />` : ""}
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta http-equiv="refresh" content="0; url=${url}" />
    <script>window.location.replace(${JSON.stringify(productUrl)});</script>
  </head>
  <body><p>Redirecting to <a href="${url}">${title}</a>&hellip;</p></body>
</html>`);
  } catch (err) {
    functions.logger.error("ogPreview error", { productId, err });
    res.redirect(302, productUrl);
  }
});
