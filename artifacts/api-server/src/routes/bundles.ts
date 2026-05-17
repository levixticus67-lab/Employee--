import { Router, type IRouter } from "express";
import { firestore, Timestamp } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function bundleDto(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data["name"] ?? "",
    description: data["description"] ?? "",
    productIds: data["productIds"] ?? [],
    price: Number(data["price"] ?? 0),
    imageUrl: data["imageUrl"] ?? null,
    active: data["active"] !== false,
    createdAt: data["createdAt"]?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

router.get("/bundles", async (_req, res) => {
  const snap = await firestore.collection("bundles").where("active", "==", true).get();
  res.json(snap.docs.map((d) => bundleDto(d.id, d.data())));
});

router.get("/admin/bundles", requireAdmin, async (_req, res) => {
  const snap = await firestore.collection("bundles").orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((d) => bundleDto(d.id, d.data())));
});

router.post("/admin/bundles", requireAdmin, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const doc = await firestore.collection("bundles").add({
    name: b["name"] ?? "",
    description: b["description"] ?? "",
    productIds: b["productIds"] ?? [],
    price: Number(b["price"] ?? 0),
    imageUrl: b["imageUrl"] ?? null,
    active: b["active"] !== false,
    createdAt: Timestamp.now(),
  });
  const snap = await doc.get();
  res.status(201).json(bundleDto(doc.id, snap.data() ?? {}));
});

router.put("/admin/bundles/:id", requireAdmin, async (req, res) => {
  const ref = firestore.collection("bundles").doc(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of ["name", "description", "productIds", "imageUrl", "active"]) {
    if (b[key] !== undefined) updates[key] = b[key];
  }
  if (b["price"] !== undefined) updates["price"] = Number(b["price"]);
  await ref.update(updates);
  const snap = await ref.get();
  res.json(bundleDto(ref.id, snap.data() ?? {}));
});

router.delete("/admin/bundles/:id", requireAdmin, async (req, res) => {
  await firestore.collection("bundles").doc(req.params.id).delete();
  res.status(204).send();
});

export default router;
