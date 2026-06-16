import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const SITE_NAME = "LENZ";

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

// Cache the React app's index.html for 10 minutes to avoid fetching on every request
let indexHtmlCache: { html: string; fetchedAt: number } | null = null;
const INDEX_CACHE_TTL_MS = 10 * 60 * 1000;

async function getIndexHtml(frontendUrl: string): Promise<string> {
  const now = Date.now();
  if (indexHtmlCache && now - indexHtmlCache.fetchedAt < INDEX_CACHE_TTL_MS) {
    return indexHtmlCache.html;
  }
  // Fetch the root — this hits the "**" -> index.html hosting rewrite, NOT this function
  const response = await fetch(`${frontendUrl}/`);
  const html = await response.text();
  indexHtmlCache = { html, fetchedAt: now };
  return html;
}

function buildOgTags(params: {
  title: string;
  desc: string;
  image: string;
  url: string;
}): string {
  const { title, desc, image, url } = params;
  return [
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    image ? `<meta property="og:image:alt" content="${title}" />` : "",
    image ? `<meta name="twitter:image" content="${image}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

export const ogPreview = onRequest(async (req, res) => {
  const FRONTEND_URL = getFrontendUrl();

  const match = req.path.match(/^\/product\/([^/]+)/);
  const productId = match?.[1] ?? "";

  if (!productId) {
    res.redirect(302, FRONTEND_URL || "/");
    return;
  }

  const productUrl = `${FRONTEND_URL}/product/${productId}`;

  try {
    // Fetch the React SPA's index.html and inject OG tags — serve it directly.
    // This eliminates the redirect loop: we never redirect back to /product/**.
    // Real browsers get the full SPA; crawlers get OG meta tags already in <head>.
    const [doc, baseHtml] = await Promise.all([
      db.collection("products").doc(productId).get(),
      getIndexHtml(FRONTEND_URL),
    ]);

    let ogTags = "";

    if (doc.exists) {
      const p = doc.data()!;
      const title = escapeHtml(`${String(p["name"] ?? "")} — ${SITE_NAME}`);
      const desc  = escapeHtml(
        (String(p["description"] ?? `Shop ${p["name"]} at ${SITE_NAME}.`)).slice(0, 200)
      );
      const imageRaw = String(p["imageUrl"] ?? "");
      const image    = imageRaw ? escapeHtml(imageRaw) : "";
      const url      = escapeHtml(productUrl);

      ogTags = buildOgTags({ title, desc, image, url });
    }

    // Inject OG tags right after <head> so crawlers see them immediately
    const html = ogTags
      ? baseHtml.replace(/<head>/i, `<head>\n    ${ogTags}`)
      : baseHtml;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.status(200).send(html);
  } catch (err) {
    logger.error("ogPreview error", { productId, err });
    // Fallback: serve the SPA without OG tags
    try {
      const baseHtml = await getIndexHtml(FRONTEND_URL);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(baseHtml);
    } catch {
      res.redirect(302, FRONTEND_URL || "/");
    }
  }
});
