import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, type ProductDoc } from "@workspace/db";

const router: IRouter = Router();

const SITE_URL = (process.env["FRONTEND_URL"] ?? "https://jojo-collection.web.app").replace(/\/$/, "");
const SITE_NAME = "LENZ";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.get("/share/product/:id", async (req, res) => {
  const productUrl = `${SITE_URL}/product/${req.params.id}`;
  try {
    const doc = await firestore.collection(COLLECTIONS.products).doc(req.params.id).get();
    if (!doc.exists) {
      res.redirect(302, productUrl);
      return;
    }
    const p = doc.data() as ProductDoc;
    const title = escapeHtml(`${p.name} — ${SITE_NAME}`);
    const description = escapeHtml((p.description ?? `Shop ${p.name} at ${SITE_NAME}.`).slice(0, 200));
    const image = escapeHtml(p.imageUrl ?? `${SITE_URL}/opengraph.jpg`);
    const url = escapeHtml(productUrl);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:alt" content="${escapeHtml(p.name)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta http-equiv="refresh" content="0; url=${url}" />
    <script>window.location.replace(${JSON.stringify(productUrl)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${url}">${title}</a>&hellip;</p>
  </body>
</html>`);
  } catch {
    res.redirect(302, productUrl);
  }
});

export default router;
