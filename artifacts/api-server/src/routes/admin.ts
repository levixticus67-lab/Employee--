import { Router, type IRouter } from "express";
import {
  firestore,
  COLLECTIONS,
  Timestamp,
  type ProductDoc,
  type OrderDoc,
  type ReviewDoc,
  type CouponDoc,
  type BundleDoc,
  type BlogPostDoc,
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/admin/dashboard", async (_req, res) => {
  const [ordersSnap, productsSnap, reviewsSnap] = await Promise.all([
    firestore.collection(COLLECTIONS.orders).get(),
    firestore.collection(COLLECTIONS.products).get(),
    firestore.collection(COLLECTIONS.reviews).get(),
  ]);

  let totalRevenue = 0;
  let pendingOrders = 0;
  const revenueByDay = new Map<string, number>();
  for (const d of ordersSnap.docs) {
    const o = d.data() as OrderDoc;
    totalRevenue += Number(o.total ?? 0);
    if (o.status === "pending") pendingOrders++;
    const day = o.createdAt instanceof Timestamp
      ? o.createdAt.toDate().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(o.total ?? 0));
  }

  let outOfStock = 0;
  let lowStock = 0;
  for (const d of productsSnap.docs) {
    const p = d.data() as ProductDoc;
    if (p.stock === 0) outOfStock++;
    else if (p.stock <= 5) lowStock++;
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

  const revenueChart = Array.from(revenueByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, revenue]) => ({ date, revenue }));

  res.json({
    totalRevenue,
    ordersCount: ordersSnap.size,
    pendingOrdersCount: pendingOrders,
    productsCount: productsSnap.size,
    outOfStockCount: outOfStock,
    lowStockCount: lowStock,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    pendingReviewsCount: pendingReviews,
    recentOrders,
    topProducts,
    revenueChart,
  });
});

// ─── Products ─────────────────────────────────────────────────────────────────
router.post("/admin/products", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload" });
    return;
  }
  const b = parsed.data;
  const body = req.body as Record<string, unknown>;
  const data: ProductDoc = {
    name: b.name,
    brand: b.brand,
    description: b.description,
    category: b.category,
    collection: (body["collection"] as string) || null,
    price: b.price,
    sizeMl: b.sizeMl ?? null,
    sizes: (body["sizes"] as ProductDoc["sizes"]) ?? [],
    stock: b.stock,
    featured: b.featured,
    imageUrl: b.imageUrl ?? null,
    images: (body["images"] as string[]) ?? [],
    notes: b.notes,
    topNotes: b.topNotes ?? null,
    heartNotes: b.heartNotes ?? null,
    baseNotes: b.baseNotes ?? null,
    salePrice: (body["salePrice"] as number) || null,
    saleEndsAt: (body["saleEndsAt"] as string) || null,
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
  const body = req.body as Record<string, unknown>;
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
  if ("collection" in body) updates["collection"] = body["collection"] || null;
  if ("sizes" in body) updates["sizes"] = body["sizes"] ?? [];
  if ("images" in body) updates["images"] = body["images"] ?? [];
  if ("salePrice" in body) updates["salePrice"] = body["salePrice"] || null;
  if ("saleEndsAt" in body) updates["saleEndsAt"] = body["saleEndsAt"] || null;

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

// ─── Bulk Import ──────────────────────────────────────────────────────────────
router.post("/admin/products/bulk-import", async (req, res) => {
  const rows = req.body as Array<Record<string, unknown>>;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Expected non-empty array of products" });
    return;
  }
  const batch = firestore.batch();
  let count = 0;
  for (const row of rows) {
    if (!row["name"] || !row["brand"] || !row["price"]) continue;
    const ref = firestore.collection(COLLECTIONS.products).doc();
    batch.set(ref, {
      name: String(row["name"]),
      brand: String(row["brand"]),
      description: String(row["description"] ?? ""),
      category: String(row["category"] ?? "Eau de Parfum"),
      collection: row["collection"] ? String(row["collection"]) : null,
      price: Number(row["price"]),
      sizeMl: row["sizeMl"] ? Number(row["sizeMl"]) : null,
      sizes: [],
      stock: row["stock"] ? Number(row["stock"]) : 0,
      featured: row["featured"] === "true" || row["featured"] === true,
      imageUrl: row["imageUrl"] ? String(row["imageUrl"]) : null,
      images: [],
      notes: row["notes"] ? String(row["notes"]).split(",").map((n) => n.trim()) : [],
      topNotes: row["topNotes"] ? String(row["topNotes"]) : null,
      heartNotes: row["heartNotes"] ? String(row["heartNotes"]) : null,
      baseNotes: row["baseNotes"] ? String(row["baseNotes"]) : null,
      salePrice: null,
      saleEndsAt: null,
      createdAt: Timestamp.now(),
    } satisfies ProductDoc);
    count++;
  }
  await batch.commit();
  res.json({ imported: count });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
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
  const existing = snap.data() as OrderDoc;
  const history = existing.statusHistory ?? [];
  history.push({ status: parsed.data.status, timestamp: new Date().toISOString() });
  await ref.update({ status: parsed.data.status, statusHistory: history });
  const all = await loadAllOrders();
  const dto = all.find((o) => o.id === req.params.id) as OrderDto;
  res.json(dto);
});

// ─── Reviews ──────────────────────────────────────────────────────────────────
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

// ─── Coupons ──────────────────────────────────────────────────────────────────
router.get("/admin/coupons", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.coupons).get();
  const coupons = snap.docs.map((d) => {
    const c = d.data() as CouponDoc;
    return { id: d.id, ...c, createdAt: c.createdAt instanceof Timestamp ? c.createdAt.toDate().toISOString() : new Date().toISOString() };
  });
  res.json(coupons);
});

router.post("/admin/coupons", async (req, res) => {
  const body = req.body as { code: string; type: string; value: number; minOrder?: number; maxUses?: number | null };
  if (!body.code || !body.type || !body.value) {
    res.status(400).json({ error: "code, type and value are required" });
    return;
  }
  const data: CouponDoc = {
    code: body.code.toUpperCase().trim(),
    type: body.type as "percentage" | "fixed",
    value: Number(body.value),
    minOrder: Number(body.minOrder ?? 0),
    active: true,
    uses: 0,
    maxUses: body.maxUses ?? null,
    createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.coupons).add(data);
  res.status(201).json({ id: ref.id, ...data, createdAt: new Date().toISOString() });
});

router.put("/admin/coupons/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.coupons).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Not found" }); return; }
  const updates = req.body as Partial<CouponDoc>;
  await ref.update(updates as Record<string, unknown>);
  const fresh = await ref.get();
  const c = fresh.data() as CouponDoc;
  res.json({ id: fresh.id, ...c, createdAt: c.createdAt instanceof Timestamp ? c.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.delete("/admin/coupons/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.coupons).doc(req.params.id).delete();
  res.status(204).send();
});

// Public coupon validation
router.post("/coupons/validate", async (req, res) => {
  const { code, orderTotal } = req.body as { code: string; orderTotal: number };
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  const snap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", code.toUpperCase().trim()).get();
  if (snap.empty) { res.status(404).json({ error: "Invalid coupon code" }); return; }
  const doc = snap.docs[0]!;
  const c = doc.data() as CouponDoc;
  if (!c.active) { res.status(400).json({ error: "Coupon is no longer active" }); return; }
  if (c.maxUses !== null && c.uses >= c.maxUses) { res.status(400).json({ error: "Coupon usage limit reached" }); return; }
  if (orderTotal < c.minOrder) { res.status(400).json({ error: `Minimum order $${c.minOrder} required` }); return; }
  const discount = c.type === "percentage" ? (orderTotal * c.value) / 100 : Math.min(c.value, orderTotal);
  res.json({ id: doc.id, code: c.code, type: c.type, value: c.value, discount: Math.round(discount * 100) / 100 });
});

// ─── Bundles ──────────────────────────────────────────────────────────────────
router.get("/bundles", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.bundles).where("active", "==", true).get();
  const bundles = snap.docs.map((d) => {
    const b = d.data() as BundleDoc;
    return { id: d.id, ...b, createdAt: b.createdAt instanceof Timestamp ? b.createdAt.toDate().toISOString() : new Date().toISOString() };
  });
  res.json(bundles);
});

router.get("/admin/bundles", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.bundles).get();
  const bundles = snap.docs.map((d) => {
    const b = d.data() as BundleDoc;
    return { id: d.id, ...b, createdAt: b.createdAt instanceof Timestamp ? b.createdAt.toDate().toISOString() : new Date().toISOString() };
  });
  res.json(bundles);
});

router.post("/admin/bundles", async (req, res) => {
  const body = req.body as { name: string; description: string; productIds: string[]; price: number; imageUrl?: string };
  if (!body.name || !body.productIds?.length || !body.price) {
    res.status(400).json({ error: "name, productIds and price required" });
    return;
  }
  const data: BundleDoc = {
    name: body.name,
    description: body.description ?? "",
    productIds: body.productIds,
    price: Number(body.price),
    imageUrl: body.imageUrl ?? null,
    active: true,
    createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.bundles).add(data);
  res.status(201).json({ id: ref.id, ...data, createdAt: new Date().toISOString() });
});

router.put("/admin/bundles/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.bundles).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Not found" }); return; }
  await ref.update(req.body as Record<string, unknown>);
  const fresh = await ref.get();
  const b = fresh.data() as BundleDoc;
  res.json({ id: fresh.id, ...b, createdAt: b.createdAt instanceof Timestamp ? b.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.delete("/admin/bundles/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.bundles).doc(req.params.id).delete();
  res.status(204).send();
});

// ─── Blog ─────────────────────────────────────────────────────────────────────
router.get("/blog", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.blogPosts).where("published", "==", true).get();
  const posts = snap.docs.map((d) => {
    const p = d.data() as BlogPostDoc;
    return { id: d.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts);
});

router.get("/blog/:id", async (req, res) => {
  const doc = await firestore.collection(COLLECTIONS.blogPosts).doc(req.params.id).get();
  if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
  const p = doc.data() as BlogPostDoc;
  res.json({ id: doc.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.get("/admin/blog", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.blogPosts).get();
  const posts = snap.docs.map((d) => {
    const p = d.data() as BlogPostDoc;
    return { id: d.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts);
});

router.post("/admin/blog", async (req, res) => {
  const body = req.body as { title: string; summary: string; content: string; imageUrl?: string; author?: string; published?: boolean };
  if (!body.title || !body.content) {
    res.status(400).json({ error: "title and content required" });
    return;
  }
  const data: BlogPostDoc = {
    title: body.title,
    summary: body.summary ?? "",
    content: body.content,
    imageUrl: body.imageUrl ?? null,
    author: body.author ?? "Jojo Collections",
    published: body.published ?? false,
    createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.blogPosts).add(data);
  res.status(201).json({ id: ref.id, ...data, createdAt: new Date().toISOString() });
});

router.put("/admin/blog/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.blogPosts).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Not found" }); return; }
  await ref.update(req.body as Record<string, unknown>);
  const fresh = await ref.get();
  const p = fresh.data() as BlogPostDoc;
  res.json({ id: fresh.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.delete("/admin/blog/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.blogPosts).doc(req.params.id).delete();
  res.status(204).send();
});

// ─── Stock Alerts ─────────────────────────────────────────────────────────────
router.post("/stock-alerts", async (req, res) => {
  const { email, productId, productName } = req.body as { email: string; productId: string; productName: string };
  if (!email || !productId) { res.status(400).json({ error: "email and productId required" }); return; }
  const existing = await firestore.collection(COLLECTIONS.stockAlerts)
    .where("email", "==", email).where("productId", "==", productId).get();
  if (!existing.empty) { res.json({ message: "Already registered" }); return; }
  await firestore.collection(COLLECTIONS.stockAlerts).add({ email, productId, productName, createdAt: Timestamp.now() });
  res.status(201).json({ message: "Alert registered" });
});

router.get("/admin/stock-alerts", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.stockAlerts).get();
  const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json(alerts);
});

router.get("/admin/low-stock", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.products).get();
  const threshold = 5;
  const products = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
    .filter((p) => p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock);
  res.json(products.map((p) => ({
    id: p.id, name: p.name, brand: p.brand, stock: p.stock, imageUrl: p.imageUrl ?? null,
  })));
});

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get("/settings/public", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  res.json(snap.exists ? snap.data() : { whatsappNumber: "", whatsappMessage: "Hi! I need help.", currencyDefault: "USD" });
});

router.get("/admin/settings", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  res.json(snap.exists ? snap.data() : { whatsappNumber: "", whatsappMessage: "Hi! I need help.", currencyDefault: "USD" });
});

router.put("/admin/settings", async (req, res) => {
  await firestore.collection(COLLECTIONS.settings).doc("public").set(req.body, { merge: true });
  const fresh = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  res.json(fresh.data());
});

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get("/admin/analytics", async (_req, res) => {
  const [ordersSnap, productsSnap] = await Promise.all([
    firestore.collection(COLLECTIONS.orders).get(),
    firestore.collection(COLLECTIONS.products).get(),
  ]);

  const revenueByDay = new Map<string, number>();
  const ordersByDay = new Map<string, number>();
  const salesByProduct = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const d of ordersSnap.docs) {
    const o = d.data() as OrderDoc;
    const day = o.createdAt instanceof Timestamp
      ? o.createdAt.toDate().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(o.total ?? 0));
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
    for (const item of o.items ?? []) {
      const cur = salesByProduct.get(item.productId) ?? { name: item.name, quantity: 0, revenue: 0 };
      cur.quantity += item.quantity;
      cur.revenue += item.price * item.quantity;
      salesByProduct.set(item.productId, cur);
    }
  }

  const productMap = new Map<string, number>();
  for (const d of productsSnap.docs) {
    productMap.set(d.id, (d.data() as ProductDoc).stock);
  }

  const revenueChart = Array.from(revenueByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, revenue]) => ({ date, revenue, orders: ordersByDay.get(date) ?? 0 }));

  const topSelling = Array.from(salesByProduct.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  res.json({ revenueChart, topSelling });
});

export default router;
