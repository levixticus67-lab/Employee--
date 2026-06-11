/**
 * Cloudflare Worker — OG preview for Jojo Collections / LENZ
 *
 * Serves OG meta tags to ALL visitors (bots + humans).
 * Humans are instantly redirected to the Firebase SPA via a JS redirect.
 * Bots (WhatsApp, Facebook, etc.) don't execute JS so they read the OG tags.
 *
 * Env vars (wrangler.toml [vars]):
 *   FIREBASE_PROJECT_ID  — "jojo-collection"
 *   FRONTEND_URL         — "https://jojo-collection.web.app"
 */

const SITE_NAME = "LENZ";
const OG_W = 1200;
const OG_H = 630;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toOgImageUrl(url) {
  if (!url) return url;
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?:([^/]+)\/)?(.+)$/);
  if (!match) return url;
  const [, base, existingTransforms, publicId] = match;
  const ogTransform = `w_${OG_W},h_${OG_H},c_fill,f_jpg,q_auto`;
  const transforms = existingTransforms ? `${ogTransform}/${existingTransforms}` : ogTransform;
  return `${base}${transforms}/${publicId}`;
}

async function fetchProduct(projectId, productId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${productId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const doc = await res.json();
  if (!doc.fields) return null;
  const f = doc.fields;
  return {
    name: f.name?.stringValue ?? "",
    description: f.description?.stringValue ?? "",
    imageUrl:
      f.imageUrl?.stringValue ??
      f.images?.arrayValue?.values?.[0]?.stringValue ??
      "",
  };
}

function buildOgPage(product, workerUrl, productSpaUrl) {
  const title = escapeHtml(`${product.name} — ${SITE_NAME}`);
  const desc  = escapeHtml(
    (product.description || `Shop ${product.name} at ${SITE_NAME}.`).slice(0, 200)
  );
  const rawImage = toOgImageUrl(product.imageUrl);
  const image    = rawImage ? escapeHtml(rawImage) : "";
  const canonicalUrl = escapeHtml(workerUrl);
  const spaUrl = escapeHtml(productSpaUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>

    <!-- Open Graph -->
    <meta property="og:type"         content="product" />
    <meta property="og:site_name"    content="${SITE_NAME}" />
    <meta property="og:title"        content="${title}" />
    <meta property="og:description"  content="${desc}" />
    <meta property="og:url"          content="${canonicalUrl}" />
    ${image ? `
    <meta property="og:image"        content="${image}" />
    <meta property="og:image:width"  content="${OG_W}" />
    <meta property="og:image:height" content="${OG_H}" />
    <meta property="og:image:type"   content="image/jpeg" />
    <meta property="og:image:alt"    content="${title}" />` : ""}

    <!-- Twitter / WhatsApp fallback -->
    <meta name="twitter:card"        content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    ${image ? `<meta name="twitter:image" content="${image}" />` : ""}

    <!-- JS redirect for humans — bots don't run JS so they read the OG tags above -->
    <script>window.location.replace("${spaUrl}");<\/script>
    <noscript><meta http-equiv="refresh" content="0;url=${spaUrl}" /></noscript>
  </head>
  <body>
    <p>Redirecting to <a href="${spaUrl}">${title}</a>…</p>
  </body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/product\/([^/?]+)/);
    const frontendUrl = (env.FRONTEND_URL ?? "https://jojo-collection.web.app").replace(/\/$/, "");

    if (!match) return Response.redirect(frontendUrl, 302);

    const productId     = match[1];
    const productSpaUrl = `${frontendUrl}/product/${productId}`;
    const workerUrl     = `https://${url.host}/product/${productId}`;

    try {
      const product = await fetchProduct(env.FIREBASE_PROJECT_ID, productId);
      if (!product?.name) return Response.redirect(productSpaUrl, 302);

      return new Response(buildOgPage(product, workerUrl, productSpaUrl), {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          // Short cache so WhatsApp picks up product changes quickly
          "Cache-Control": "public,max-age=300,s-maxage=300",
        },
      });
    } catch {
      return Response.redirect(productSpaUrl, 302);
    }
  },
};
