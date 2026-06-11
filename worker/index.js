/**
 * Cloudflare Worker — OG preview for Jojo Collections / LENZ
 *
 * Reads products from Firestore REST API — no API key needed if
 * Firestore rules allow public reads on the products collection.
 *
 * Env vars (set via wrangler.toml [vars] — no secrets needed):
 *   FIREBASE_PROJECT_ID  — "jojo-collection"
 *   FRONTEND_URL         — "https://jojo-collection.web.app"
 */

const SITE_NAME = "LENZ";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBot(ua) {
  if (!ua) return false;
  const bots = [
    "facebookexternalhit","Facebot","Twitterbot","WhatsApp","TelegramBot",
    "LinkedInBot","Slackbot","Discordbot","bot","crawl","spider","preview",
  ];
  return bots.some((b) => ua.toLowerCase().includes(b.toLowerCase()));
}

async function fetchProduct(projectId, productId) {
  // Unauthenticated Firestore REST — works if rules allow: allow read: if true
  // on the products collection (standard for a public storefront).
  // No API key, no anonymous auth — nothing that can be domain-restricted.
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

function buildOgPage(product, productUrl) {
  const title = escapeHtml(`${product.name} — ${SITE_NAME}`);
  const desc = escapeHtml(
    (product.description || `Shop ${product.name} at ${SITE_NAME}.`).slice(0, 200)
  );
  const image = product.imageUrl ? escapeHtml(product.imageUrl) : "";
  const url = escapeHtml(productUrl);

  return `<!DOCTYPE html>
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
  <body><p>Redirecting to <a href="${url}">${title}</a>…</p></body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/product\/([^/?]+)/);
    const frontendUrl = (env.FRONTEND_URL ?? "https://jojo-collection.web.app").replace(/\/$/, "");

    if (!match) {
      return Response.redirect(frontendUrl, 302);
    }

    const productId = match[1];
    const productUrl = `${frontendUrl}/product/${productId}`;
    const ua = request.headers.get("User-Agent") ?? "";

    // Humans: skip Firestore entirely, redirect straight to the SPA
    if (!isBot(ua)) {
      return Response.redirect(productUrl, 302);
    }

    try {
      const product = await fetchProduct(env.FIREBASE_PROJECT_ID, productId);
      if (!product?.name) return Response.redirect(productUrl, 302);

      return new Response(buildOgPage(product, productUrl), {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public,max-age=300",
        },
      });
    } catch {
      return Response.redirect(productUrl, 302);
    }
  },
};
