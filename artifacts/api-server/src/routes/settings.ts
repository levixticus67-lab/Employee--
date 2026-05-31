import { Router, type IRouter } from "express";
import { firestore } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getLiveRates, getRateHistory, setRateOverride, clearRateOverride, getOverrideDoc } from "../lib/exchangeRate";

const router: IRouter = Router();
const SETTINGS_DOC = "settings/global";

type StoreSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
  currencyDefault: string;
  lowStockThreshold: number;
  mtnNumber: string;
  airtelNumber: string;
  freeDeliveryThreshold: number;
  locationDeliveryThreshold: number;
  logoUrl: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerBgColor: string;
  bannerMediaUrl: string;
  bannerMediaType: "none" | "image" | "video";
  bannerCountdownEnabled: boolean;
  bannerCountdownEnd: string;
  heroImage1: string;
  heroImage2: string;
  heroImage3: string;
};

const defaultSettings: StoreSettings = {
  whatsappNumber: "",
  whatsappMessage: "Hi! I need help with my order.",
  currencyDefault: "USD",
  lowStockThreshold: 5,
  mtnNumber: "",
  airtelNumber: "",
  freeDeliveryThreshold: 0,
  locationDeliveryThreshold: 0,
  logoUrl: "",
  bannerEnabled: false,
  bannerText: "",
  bannerBgColor: "#1e3a8a",
  bannerMediaUrl: "",
  bannerMediaType: "none",
  bannerCountdownEnabled: false,
  bannerCountdownEnd: "",
  heroImage1: "",
  heroImage2: "",
  heroImage3: "",
};

router.get("/settings/public", async (_req, res) => {
  try {
    const snap = await firestore.doc(SETTINGS_DOC).get();
    const data = snap.exists ? snap.data() : {};
    res.json({
      whatsappNumber: data?.["whatsappNumber"] ?? "",
      whatsappMessage: data?.["whatsappMessage"] ?? "Hi! I need help with my order.",
      currencyDefault: data?.["currencyDefault"] ?? "USD",
      mtnNumber: data?.["mtnNumber"] ?? "",
      airtelNumber: data?.["airtelNumber"] ?? "",
      freeDeliveryThreshold: Number(data?.["freeDeliveryThreshold"] ?? 0),
      locationDeliveryThreshold: Number(data?.["locationDeliveryThreshold"] ?? 0),
      logoUrl: data?.["logoUrl"] ?? "",
      bannerEnabled: data?.["bannerEnabled"] === true,
      bannerText: data?.["bannerText"] ?? "",
      bannerBgColor: data?.["bannerBgColor"] ?? "#1e3a8a",
      bannerMediaUrl: data?.["bannerMediaUrl"] ?? "",
      bannerMediaType: data?.["bannerMediaType"] ?? "none",
      bannerCountdownEnabled: data?.["bannerCountdownEnabled"] === true,
      bannerCountdownEnd: data?.["bannerCountdownEnd"] ?? "",
      heroImage1: data?.["heroImage1"] ?? "",
      heroImage2: data?.["heroImage2"] ?? "",
      heroImage3: data?.["heroImage3"] ?? "",
    });
  } catch {
    res.json({ whatsappNumber: "", whatsappMessage: "Hi! I need help.", currencyDefault: "USD", mtnNumber: "", airtelNumber: "", logoUrl: "", bannerEnabled: false, heroImage1: "", heroImage2: "", heroImage3: "" });
  }
});

router.get("/admin/settings", requireAdmin, async (_req, res) => {
  try {
    const snap = await firestore.doc(SETTINGS_DOC).get();
    res.json(snap.exists ? { ...defaultSettings, ...snap.data() } : defaultSettings);
  } catch {
    res.json(defaultSettings);
  }
});

router.put("/admin/settings", requireAdmin, async (req, res) => {
  const body = req.body as Partial<StoreSettings>;
  const updates: Partial<StoreSettings> = {};
  const strKeys: (keyof StoreSettings)[] = [
    "whatsappNumber", "whatsappMessage", "currencyDefault", "mtnNumber", "airtelNumber",
    "logoUrl", "bannerText", "bannerBgColor", "bannerMediaUrl", "bannerMediaType", "bannerCountdownEnd",
    "heroImage1", "heroImage2", "heroImage3",
  ];
  for (const k of strKeys) {
    if (body[k] !== undefined) (updates as Record<string, unknown>)[k] = body[k];
  }
  if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(body.lowStockThreshold);
  if (body.freeDeliveryThreshold !== undefined) updates.freeDeliveryThreshold = Number(body.freeDeliveryThreshold);
  if (body.locationDeliveryThreshold !== undefined) updates.locationDeliveryThreshold = Number(body.locationDeliveryThreshold);
  if (body.bannerEnabled !== undefined) updates.bannerEnabled = Boolean(body.bannerEnabled);
  if (body.bannerCountdownEnabled !== undefined) updates.bannerCountdownEnabled = Boolean(body.bannerCountdownEnabled);
  await firestore.doc(SETTINGS_DOC).set(updates, { merge: true });
  const snap = await firestore.doc(SETTINGS_DOC).get();
  res.json({ ...defaultSettings, ...snap.data() });
});

router.get("/admin/low-stock", requireAdmin, async (_req, res) => {
  try {
    const settingsSnap = await firestore.doc(SETTINGS_DOC).get();
    const threshold = settingsSnap.exists ? (settingsSnap.data()?.["lowStockThreshold"] ?? 5) : 5;
    const snap = await firestore.collection("products").get();
    const low = snap.docs
      .filter((d) => (d.data()["stock"] ?? 0) <= threshold)
      .map((d) => ({ id: d.id, name: d.data()["name"], brand: d.data()["brand"], stock: d.data()["stock"], imageUrl: d.data()["imageUrl"] ?? null }));
    res.json(low);
  } catch {
    res.json([]);
  }
});

router.get("/exchange-rates", async (_req, res) => {
  const rates = await getLiveRates();
  res.json({
    USD: 1,
    UGX: rates["UGX"] ?? 3700,
    EUR: rates["EUR"] ?? 0.92,
    GBP: rates["GBP"] ?? 0.79,
  });
});

router.get("/admin/exchange-rates/history", requireAdmin, async (req, res) => {
  const days = Math.min(30, Math.max(1, Number(req.query["days"]) || 7));
  const history = await getRateHistory(days);
  res.json(history);
});

router.get("/admin/exchange-rates/override", requireAdmin, async (_req, res) => {
  const doc = await getOverrideDoc();
  if (!doc) { res.status(404).json(null); return; }
  res.json(doc);
});

router.post("/admin/exchange-rates/override", requireAdmin, async (req, res) => {
  const body = req.body as { UGX?: number; EUR?: number; GBP?: number; expiresInHours?: number };
  const rates: { UGX?: number; EUR?: number; GBP?: number } = {};
  if (body.UGX && body.UGX > 0) rates.UGX = Number(body.UGX);
  if (body.EUR && body.EUR > 0) rates.EUR = Number(body.EUR);
  if (body.GBP && body.GBP > 0) rates.GBP = Number(body.GBP);
  if (!Object.keys(rates).length) { res.status(400).json({ error: "Provide at least one rate" }); return; }
  await setRateOverride(rates, body.expiresInHours || undefined);
  res.json({ ok: true });
});

router.delete("/admin/exchange-rates/override", requireAdmin, async (_req, res) => {
  await clearRateOverride();
  res.json({ ok: true });
});

export default router;
