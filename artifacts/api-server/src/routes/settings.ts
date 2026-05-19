import { Router, type IRouter } from "express";
import { firestore } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

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
    });
  } catch {
    res.json({ whatsappNumber: "", whatsappMessage: "Hi! I need help.", currencyDefault: "USD", mtnNumber: "", airtelNumber: "", logoUrl: "", bannerEnabled: false });
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
  const strKeys: (keyof StoreSettings)[] = ["whatsappNumber", "whatsappMessage", "currencyDefault", "mtnNumber", "airtelNumber", "logoUrl", "bannerText", "bannerBgColor", "bannerMediaUrl", "bannerMediaType"];
  for (const k of strKeys) {
    if (body[k] !== undefined) (updates as Record<string, unknown>)[k] = body[k];
  }
  if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(body.lowStockThreshold);
  if (body.freeDeliveryThreshold !== undefined) updates.freeDeliveryThreshold = Number(body.freeDeliveryThreshold);
  if (body.locationDeliveryThreshold !== undefined) updates.locationDeliveryThreshold = Number(body.locationDeliveryThreshold);
  if (body.bannerEnabled !== undefined) updates.bannerEnabled = Boolean(body.bannerEnabled);
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

export default router;
