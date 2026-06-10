import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, type ProductDoc } from "@workspace/db";

const router: IRouter = Router();

const FRONTEND_URL = (process.env["FRONTEND_URL"] ?? "").replace(/\/$/, "");
const RENDER_URL = (process.env["RENDER_EXTERNAL_URL"] ?? process.env["API_URL"] ?? "").replace(/\/$/, "");
const SITE_NAME = "LENZ";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toAbsoluteUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${RENDER_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildOgHtml(title: string, description: string, image: string, productUrl: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = image ? escapeHtml(toAbsoluteUrl(image)) : "";
  const u = escapeHtml(productUrl);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${t}</title>
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    ${img ? `<meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${t}" />
    <meta name="twitter:image" content="${img}" />` : ""}
    <meta property="og:url" content="${u}" />
    <meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta http-equiv="refresh" content="0; url=${u}" />
    <script>window.location.replace(${JSON.stringify(productUrl)});</script>
  </head>
  <body><p>Redirecting to <a href="${u}">${t}</a>&hellip;</p></body>
</html>`;
}

router.get("/share/product/:id", async (req, res) => {
  const productUrl = FRONTEND_URL
    ? `${FRONTEND_URL}/product/${req.params.id}`
    : `/product/${req.params.id}`;

  const imgParam   = typeof req.query["img"]   === "string" ? req.query["img"]   : "";
  const titleParam = typeof req.query["title"] === "string" ? req.query["title"] : "";
  const descParam  = typeof req.query["desc"]  === "string" ? req.query["desc"]  : "";

  if (imgParam && titleParam) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildOgHtml(
      titleParam,
      descParam || `Shop ${titleParam} at ${SITE_NAME}.`,
      imgParam,
      productUrl,
    ));
    return;
  }

  try {
    const doc = await firestore.collection(COLLECTIONS.products).doc(req.params.id).get();
    if (!doc.exists) {
      res.redirect(302, productUrl);
      return;
    }
    const p = doc.data() as ProductDoc;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildOgHtml(
      p.name,
      (p.description ?? `Shop ${p.name} at ${SITE_NAME}.`).slice(0, 200),
      p.imageUrl ?? "",
      productUrl,
    ));
  } catch {
    res.redirect(302, productUrl);
  }
});

export default router;
