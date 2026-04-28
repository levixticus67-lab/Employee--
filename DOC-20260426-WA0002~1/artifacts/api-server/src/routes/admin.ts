import { Router, type IRouter } from "express";
import {
  firestore,
  COLLECTIONS,
  Timestamp,
  type ProductDoc,
  type OrderDoc,
  type ReviewDoc,
} from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateOrderStatusBody,
  UpdateReviewStatusBody,
} from "@workspace/api-zod";
import { loadProductsWithStats } from "./products";
import { loadAllOrders, type OrderDto } from "./orders";
import { toReviewDto } from "./reviews";

const router: IRouter = Router();

router.get("/admin/dashboard", async (_req, res) => {
  const [ordersSnap, productsSnap, reviewsSnap] = await Promise.all([
    firestore.collection(COLLECTIONS.orders).get(),
    firestore.collection(COLLECTIONS.products).get(),
    firestore.collection(COLLECTIONS.reviews).get(),
  ]);

  let totalRevenue = 0;
  let pendingOrders = 0;
  for (const d of ordersSnap.docs) {
    const o = d.data() as OrderDoc;
    totalRevenue += Number(o.total ?? 0);
    if (o.status === "pending") pendingOrders++;
  }

  let outOfStock = 0;
  for (const d of productsSnap.docs) {
    const p = d.data() as ProductDoc;
    if (p.stock === 0) outOfStock++;
  }

  let ratingSum = 0;
  let ratingCount = 0;
  let pendingReviews = 0;
  for (const d of reviewsSnap.docs) {
    const r = d.data() as ReviewDoc;
    ratingSum += r.rating;
    ratingCount += 1;
    if (r.status === "pending") pendingReviews++;
  }

  const allOrders = await loadAllOrders();
  const recentOrders = allOrders.slice(0, 5);

  const products = await loadProductsWithStats({});
  const topProducts = [...products]
    .sort(
      (a, b) =>
        (b.averageRating ?? 0) * b.reviewCount -
        (a.averageRating ?? 0) * a.reviewCount,
    )
    .slice(0, 5);

  res.json({
    totalRevenue,
    ordersCount: ordersSnap.size,
    pendingOrdersCount: pendingOrders,
    productsCount: productsSnap.size,
    outOfStockCount: outOfStock,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    pendingReviewsCount: pendingReviews,
    recentOrders,
    topProducts,
  });
});

router.post("/admin/products", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload" });
    return;
  }
  const b = parsed.data;
  const data: ProductDoc = {
    name: b.name,
    brand: b.brand,
    description: b.description,
    category: b.category,
    price: b.price,
    sizeMl: b.sizeMl ?? null,
    stock: b.stock,
    featured: b.featured,
    imageUrl: b.imageUrl ?? null,
    notes: b.notes,
    topNotes: b.topNotes ?? null,
    heartNotes: b.heartNotes ?? null,
    baseNotes: b.baseNotes ?? null,
    createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.products).add(data);
  const all = await loadProductsWithStats({});
  res.status(201).json(all.find((p) => p.id === ref.id));
});

router.put("/admin/products/:id", async (req, res) => {
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload" });
    return;
  }
  const b = parsed.data;
  const updates: Record<string, unknown> = {};
  if (b.name !== undefined) updates["name"] = b.name;
  if (b.brand !== undefined) updates["brand"] = b.brand;
  if (b.description !== undefined) updates["description"] = b.description;
  if (b.category !== undefined) updates["category"] = b.category;
  if (b.price !== undefined) updates["price"] = b.price;
  if (b.sizeMl !== undefined) updates["sizeMl"] = b.sizeMl;
  if (b.stock !== undefined) updates["stock"] = b.stock;
  if (b.featured !== undefined) updates["featured"] = b.featured;
  if (b.imageUrl !== undefined) updates["imageUrl"] = b.imageUrl;
  if (b.notes !== undefined) updates["notes"] = b.notes;
  if (b.topNotes !== undefined) updates["topNotes"] = b.topNotes;
  if (b.heartNotes !== undefined) updates["heartNotes"] = b.heartNotes;
  if (b.baseNotes !== undefined) updates["baseNotes"] = b.baseNotes;

  const ref = firestore.collection(COLLECTIONS.products).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await ref.update(updates);
  const all = await loadProductsWithStats({});
  res.json(all.find((p) => p.id === req.params.id));
});

router.delete("/admin/products/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.products).doc(req.params.id).delete();
  res.status(204).send();
});

router.get("/admin/orders", async (req, res) => {
  const status =
    typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const orders = await loadAllOrders(status);
  res.json(orders);
});

router.put("/admin/orders/:id/status", async (req, res) => {
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status payload" });
    return;
  }
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  await ref.update({ status: parsed.data.status });
  const all = await loadAllOrders();
  const dto = all.find((o) => o.id === req.params.id) as OrderDto;
  res.json(dto);
});

router.get("/admin/reviews", async (req, res) => {
  const status =
    typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const snap = await firestore.collection(COLLECTIONS.reviews).get();
  const productSnap = await firestore.collection(COLLECTIONS.products).get();
  const productNames = new Map<string, string>();
  for (const d of productSnap.docs) {
    productNames.set(d.id, (d.data() as ProductDoc).name);
  }
  let reviews = snap.docs.map((d) =>
    toReviewDto(d.id, d.data() as ReviewDoc, productNames.get((d.data() as ReviewDoc).productId)),
  );
  if (status) reviews = reviews.filter((r) => r.status === status);
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(reviews);
});

router.put("/admin/reviews/:id", async (req, res) => {
  const parsed = UpdateReviewStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status payload" });
    return;
  }
  const ref = firestore.collection(COLLECTIONS.reviews).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  await ref.update({ status: parsed.data.status });
  const fresh = await ref.get();
  const data = fresh.data() as ReviewDoc;
  const productSnap = await firestore
    .collection(COLLECTIONS.products)
    .doc(data.productId)
    .get();
  const productName = productSnap.exists
    ? (productSnap.data() as ProductDoc).name
    : undefined;
  res.json(toReviewDto(fresh.id, data, productName));
});

router.delete("/admin/reviews/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.reviews).doc(req.params.id).delete();
  res.status(204).send();
});

export default router;
