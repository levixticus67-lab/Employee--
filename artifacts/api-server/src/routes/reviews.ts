import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, Timestamp, type ReviewDoc } from "@workspace/db";
import { CreateProductReviewBody } from "@workspace/api-zod";

const router: IRouter = Router();

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function toDto(id: string, r: ReviewDoc, productName?: string) {
  return {
    id,
    productId: r.productId,
    productName: productName ?? null,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: tsToIso(r.createdAt),
  };
}

router.get("/products/:id/reviews", async (req, res) => {
  const snap = await firestore
    .collection(COLLECTIONS.reviews)
    .where("productId", "==", req.params.id)
    .where("status", "==", "approved")
    .get();
  const reviews = snap.docs
    .map((d) => toDto(d.id, d.data() as ReviewDoc))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(reviews);
});

router.post("/products/:id/reviews", async (req, res) => {
  const parsed = CreateProductReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review payload" });
    return;
  }

  const productDoc = await firestore
    .collection(COLLECTIONS.products)
    .doc(req.params.id)
    .get();
  if (!productDoc.exists) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const data: ReviewDoc = {
    productId: req.params.id,
    customerName: parsed.data.customerName,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    status: "pending",
    createdAt: Timestamp.now(),
  };
  const docRef = await firestore.collection(COLLECTIONS.reviews).add(data);
  res.status(201).json(toDto(docRef.id, data));
});

export { toDto as toReviewDto };
export default router;
