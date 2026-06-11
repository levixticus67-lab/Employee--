/**
 * Cloudflare Worker — OG preview for Jojo Collections / LENZ
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

function isBot(ua) {
  if (!ua) return false;
  const bots = [
    "facebookexternalhit","Facebot","Twitterbot","WhatsApp","TelegramBot",
    "LinkedInBot","Slackbot","Discordbot","bot","crawl","spider","preview",
  ];
  return bots.some((b) => ua.toLowerCase().includes(b.toLowerCase()));
}

/**
 * If the URL is a Cloudinary image, inject transformation params to produce
 * a 1200×630 JPEG — the ideal OG image size that WhatsApp requires.
 * Non-Cloudinary URLs pass through unchanged.
 */
function toOgImageUrl(url) {
  if (!url) return url;
  // Match: https://res.cloudinary.com/{cloud}/image/upload/{...existing_transforms?}/{public_id}
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?:([^/]+)\/)?(.+)$/);
  if (!match) return url; // not Cloudinary — pass through
  const [, base, existingTransforms, publicId] = match;
  // Force: 1200w × 630h, fill crop, JPEG, auto quality
  const ogTransform = `w_${OG_W},h_${OG_H},c_fill,f_jpg,q_auto`;
  // Keep any existing transforms (e.g. watermarks) after ours
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

function buildOgPage(product, productUrl) {
  const title = escapeHtml(`${product.name} — ${SITE_NAME}`);
  const desc  = escapeHtml(
    (product.description || `Shop ${product.name} at ${SITE_NAME}.`).slice(0, 200)
  );
  const rawImage = toOgImageUrl(product.imageUrl);
  const image    = rawImage ? escapeHtml(rawImage) : "";
  const url      = escapeHtml(productUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>

    <!-- Open Graph -->
    <meta property="og:type"        content="product" />
    <meta property="og:site_name"   content="${SITE_NAME}" />
    <meta property="og:title"       content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url"         content="${url}" />
    ${image ? `
    <meta property="og:image"       content="${image}" />
    <meta property="og:image:width"  content="${OG_W}" />
    <meta property="og:image:height" content="${OG_H}" />
    <meta property="og:image:type"   content="image/jpeg" />
    <meta property="og:image:alt"    content="${title}" />` : ""}

    <!-- Twitter / WhatsApp fallback -->
    <meta name="twitter:card"        content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title"       content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    ${image ? `<meta name="twitter:image" content="${image}" />` : ""}

    <!-- Redirect humans immediately -->
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

    if (!match) return Response.redirect(frontendUrl, 302);

    const productId  = match[1];
    const productUrl = `${frontendUrl}/product/${productId}`;
    const ua         = request.headers.get("User-Agent") ?? "";

    if (!isBot(ua)) return Response.redirect(productUrl, 302);

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
