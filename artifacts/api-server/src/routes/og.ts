import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS } from "@workspace/db";

const router: IRouter = Router();

const SITE_NAME = "LENZ";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.get("/og/product/:productId", async (req, res) => {
  const { productId } = req.params;
  const frontendUrl = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
  const productUrl = `${frontendUrl}/product/${productId}`;

  try {
    const doc = await firestore.collection(COLLECTIONS.PRODUCTS).doc(productId).get();

    if (!doc.exists) {
      res.redirect(302, productUrl || "/");
      return;
    }

    const p = doc.data()!;
    const title = escapeHtml(`${String(p["name"] ?? "")} — ${SITE_NAME}`);
    const desc = escapeHtml(
      (String(p["description"] ?? `Shop ${p["name"]} at ${SITE_NAME}.`)).slice(0, 200),
    );
    const imageRaw = String(p["imageUrl"] ?? "");
    const image = imageRaw ? escapeHtml(imageRaw) : "";
    const url = escapeHtml(productUrl);

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
    req.log.error({ err, productId }, "ogPreview error");
    res.redirect(302, productUrl || "/");
  }
});

export default router;
