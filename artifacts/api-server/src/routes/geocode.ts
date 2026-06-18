import { Router } from "express";

const router = Router();

router.get("/geocode/search", async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.trim().length < 2) { res.json([]); return; }
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" +
      encodeURIComponent(q);
    const r = await fetch(url, {
      headers: {
        "User-Agent": "LenzFragrances/1.0 (lenz-fragrances.web.app)",
        Accept: "application/json",
      },
    });
    const data = (await r.json()) as { display_name: string }[];
    res.json(data.map((item) => item.display_name));
  } catch {
    res.json([]);
  }
});

router.get("/geocode/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) { res.json({ display_name: null }); return; }
  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
      lat +
      "&lon=" +
      lon;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "LenzFragrances/1.0 (lenz-fragrances.web.app)",
        Accept: "application/json",
      },
    });
    const data = (await r.json()) as { display_name?: string };
    res.json({ display_name: data.display_name ?? null });
  } catch {
    res.json({ display_name: null });
  }
});

router.get("/geocode/ip", async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) ?? req.ip ?? "";
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "LenzFragrances/1.0 (lenz-fragrances.web.app)", Accept: "application/json" },
    });
    const data = (await r.json()) as Record<string, string>;
    const parts = [data["city"], data["region"], data["country_name"]].filter(Boolean);
    res.json({ location: parts.join(", ") || null });
  } catch {
    res.json({ location: null });
  }
});

export default router;
