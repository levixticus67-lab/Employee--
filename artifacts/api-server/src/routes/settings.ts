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
};

const defaultSettings: StoreSettings = {
  whatsappNumber: "",
  whatsappMessage: "Hi! I need help with my order.",
  currencyDefault: "USD",
  lowStockThreshold: 5,
};

router.get("/settings/public", async (_req, res) => {
  try {
    const snap = await firestore.doc(SETTINGS_DOC).get();
    const data = snap.exists ? snap.data() : {};
    res.json({
      whatsappNumber: data?.["whatsappNumber"] ?? "",
      whatsappMessage: data?.["whatsappMessage"] ?? "Hi! I need help with my order.",
      currencyDefault: data?.["currencyDefault"] ?? "USD",
    });
  } catch {
    res.json({ whatsappNumber: "", whatsappMessage: "Hi! I need help.", currencyDefault: "USD" });
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
  if (body.whatsappNumber !== undefined) updates.whatsappNumber = body.whatsappNumber;
  if (body.whatsappMessage !== undefined) updates.whatsappMessage = body.whatsappMessage;
  if (body.currencyDefault !== undefined) updates.currencyDefault = body.currencyDefault;
  if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(body.lowStockThreshold);
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
      .map((d) => ({
        id: d.id,
        name: d.data()["name"],
        brand: d.data()["brand"],
        stock: d.data()["stock"],
        imageUrl: d.data()["imageUrl"] ?? null,
      }));
    res.json(low);
  } catch {
    res.json([]);
  }
});

export default router;
