/**
 * Cloudflare Worker — OG preview for Jojo Collections / LENZ
 *
 * Env vars (set as Worker secrets in CI):
 *   FIREBASE_PROJECT_ID  — "jojo-collection"
 *   FIREBASE_API_KEY     — Firebase Web API key (public, safe here)
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

async function fetchProduct(projectId, apiKey, productId) {
  // Anonymous sign-in to get a Firestore-readable token
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (!authRes.ok) return null;
  const { idToken } = await authRes.json();

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${productId}`;
  const docRes = await fetch(firestoreUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!docRes.ok) return null;
  const doc = await docRes.json();
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

    // Humans: skip Firestore, redirect straight to the SPA
    if (!isBot(ua)) {
      return Response.redirect(productUrl, 302);
    }

    try {
      const product = await fetchProduct(
        env.FIREBASE_PROJECT_ID,
        env.FIREBASE_API_KEY,
        productId
      );
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
