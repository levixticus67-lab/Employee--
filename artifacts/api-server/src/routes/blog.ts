import { Router, type IRouter } from "express";
import { firestore, Timestamp } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function postDto(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    title: data["title"] ?? "",
    summary: data["summary"] ?? "",
    content: data["content"] ?? "",
    imageUrl: data["imageUrl"] ?? null,
    author: data["author"] ?? "Jojo Collections",
    published: data["published"] === true,
    createdAt: data["createdAt"]?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

router.get("/blog", async (_req, res) => {
  const snap = await firestore
    .collection("blog")
    .where("published", "==", true)
    .orderBy("createdAt", "desc")
    .get();
  res.json(snap.docs.map((d) => postDto(d.id, d.data())));
});

router.get("/blog/:id", async (req, res) => {
  const snap = await firestore.collection("blog").doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(postDto(snap.id, snap.data() ?? {}));
});

router.get("/admin/blog", requireAdmin, async (_req, res) => {
  const snap = await firestore.collection("blog").orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((d) => postDto(d.id, d.data())));
});

router.post("/admin/blog", requireAdmin, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const doc = await firestore.collection("blog").add({
    title: b["title"] ?? "",
    summary: b["summary"] ?? "",
    content: b["content"] ?? "",
    imageUrl: b["imageUrl"] ?? null,
    author: b["author"] ?? "Jojo Collections",
    published: b["published"] === true,
    createdAt: Timestamp.now(),
  });
  const snap = await doc.get();
  res.status(201).json(postDto(doc.id, snap.data() ?? {}));
});

router.put("/admin/blog/:id", requireAdmin, async (req, res) => {
  const ref = firestore.collection("blog").doc(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of ["title", "summary", "content", "imageUrl", "author", "published"]) {
    if (b[key] !== undefined) updates[key] = b[key];
  }
  await ref.update(updates);
  const snap = await ref.get();
  res.json(postDto(ref.id, snap.data() ?? {}));
});

router.delete("/admin/blog/:id", requireAdmin, async (req, res) => {
  await firestore.collection("blog").doc(req.params.id).delete();
  res.status(204).send();
});

export default router;
