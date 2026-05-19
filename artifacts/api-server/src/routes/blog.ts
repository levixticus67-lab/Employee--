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

// Public: list published posts — sort in JS to avoid composite index requirement
router.get("/blog", async (_req, res) => {
  try {
    const snap = await firestore.collection("blog").get();
    const posts = snap.docs
      .map((d) => postDto(d.id, d.data()))
      .filter((p) => p.published)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(posts);
  } catch (err) {
    console.error("GET /blog error:", err);
    res.json([]);
  }
});

// Public: single post by id
router.get("/blog/:id", async (req, res) => {
  try {
    const snap = await firestore.collection("blog").doc(req.params.id).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const post = postDto(snap.id, snap.data() ?? {});
    if (!post.published) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(post);
  } catch (err) {
    console.error(`GET /blog/${req.params.id} error:`, err);
    res.status(500).json({ error: "Failed to load post" });
  }
});

// Admin: list all posts (including unpublished)
router.get("/admin/blog", requireAdmin, async (_req, res) => {
  try {
    const snap = await firestore.collection("blog").orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => postDto(d.id, d.data())));
  } catch (err) {
    console.error("GET /admin/blog error:", err);
    res.json([]);
  }
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
