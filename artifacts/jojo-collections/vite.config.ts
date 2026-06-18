import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

const DOMAIN = "https://lenz-fragrances.web.app";

type SitemapUrl = {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
};

function sitemapPlugin() {
  return {
    name: "generate-sitemap",
    async closeBundle() {
      const apiUrl = process.env.VITE_API_URL;
      const today = new Date().toISOString().slice(0, 10);

      const staticUrls: SitemapUrl[] = [
        { loc: `${DOMAIN}/`,        lastmod: today, changefreq: "weekly",  priority: "1.0" },
        { loc: `${DOMAIN}/shop`,    lastmod: today, changefreq: "daily",   priority: "0.9" },
        { loc: `${DOMAIN}/bundles`, lastmod: today, changefreq: "weekly",  priority: "0.8" },
        { loc: `${DOMAIN}/blog`,    lastmod: today, changefreq: "weekly",  priority: "0.7" },
      ];

      let productUrls: SitemapUrl[] = [];
      let blogUrls: SitemapUrl[] = [];

      if (apiUrl) {
        try {
          const res = await fetch(`${apiUrl}/products`);
          const products = await res.json() as { id: string; active?: boolean; updatedAt?: string }[];
          if (Array.isArray(products)) {
            productUrls = products
              .filter((p) => p.active !== false)
              .map((p) => ({
                loc: `${DOMAIN}/product/${p.id}`,
                lastmod: p.updatedAt ? p.updatedAt.slice(0, 10) : today,
                changefreq: "weekly",
                priority: "0.8",
              }));
          }
        } catch {
          console.warn("[sitemap] Could not fetch products — static pages only");
        }

        try {
          const res = await fetch(`${apiUrl}/blog`);
          const posts = await res.json() as { id: string; createdAt?: string }[];
          if (Array.isArray(posts)) {
            blogUrls = posts.map((p) => ({
              loc: `${DOMAIN}/blog/${p.id}`,
              lastmod: p.createdAt ? p.createdAt.slice(0, 10) : today,
              changefreq: "monthly",
              priority: "0.6",
            }));
          }
        } catch {
          console.warn("[sitemap] Could not fetch blog posts");
        }
      } else {
        console.warn("[sitemap] VITE_API_URL not set — only static pages included");
      }

      const allUrls = [...staticUrls, ...productUrls, ...blogUrls];

      const toEntry = (u: SitemapUrl) =>
        [
          "  <url>",
          `    <loc>${u.loc}</loc>`,
          `    <lastmod>${u.lastmod}</lastmod>`,
          `    <changefreq>${u.changefreq}</changefreq>`,
          `    <priority>${u.priority}</priority>`,
          "  </url>",
        ].join("\n");

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        allUrls.map(toEntry).join("\n"),
        "</urlset>",
        "",
      ].join("\n");

      const outPath = path.resolve(import.meta.dirname, "dist/public/sitemap.xml");
      try {
        fs.writeFileSync(outPath, xml);
        console.log(
          `[sitemap] ✓ Generated ${allUrls.length} URLs (${productUrls.length} products, ${blogUrls.length} blog posts) → sitemap.xml`
        );
      } catch {
        console.warn("[sitemap] Could not write sitemap.xml — dist/public may not exist yet");
      }
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    sitemapPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    fs: {
      strict: true,
    },
  },
});
