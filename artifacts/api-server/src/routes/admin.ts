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
  type StorageFolderDoc,
  type StorageItemDoc,
} from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateReviewStatusBody,
} from "@workspace/api-zod";
import { loadProductsWithStats } from "./products";
import { loadAllOrders, loadOrderById, type OrderDto } from "./orders";
import { toReviewDto } from "./reviews";

const router: IRouter = Router();

// ─── Storage helpers ──────────────────────────────────────────────────────────
async function ensureOrderLogsFolder(): Promise<string> {
  const existing = await firestore.collection(COLLECTIONS.storageFolders)
    .where("isSystem", "==", true).where("name", "==", "Order Logs").get();
  if (!existing.empty) return existing.docs[0]!.id;
  const ref = await firestore.collection(COLLECTIONS.storageFolders).add({
    name: "Order Logs",
    description: "Automatically archived completed and cancelled orders",
    isSystem: true,
    createdAt: Timestamp.now(),
  } satisfies StorageFolderDoc);
  return ref.id;
}

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

  const allOrders = await loadAllOrders(undefined, false);
  const recentOrders = allOrders.slice(0, 5);

  const products = await loadProductsWithStats({});
  const topProducts = [...products]
    .sort((a, b) => (b.averageRating ?? 0) * b.reviewCount - (a.averageRating ?? 0) * a.reviewCount)
    .slice(0, 5);

  const revenueChart = Array.from(revenueByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, revenue]) => ({ date, revenue }));

  res.json({
    totalRevenue, ordersCount: ordersSnap.size, pendingOrdersCount: pendingOrders,
    productsCount: productsSnap.size, outOfStockCount: outOfStock, lowStockCount: lowStock,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    pendingReviewsCount: pendingReviews, recentOrders, topProducts, revenueChart,
  });
});

// ─── Products ─────────────────────────────────────────────────────────────────
router.post("/admin/products", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid product payload" }); return; }
  const b = parsed.data;
  const body = req.body as Record<string, unknown>;
  const data: ProductDoc = {
    name: b.name, brand: b.brand, description: b.description, category: b.category,
    collection: (body["collection"] as string) || null, price: b.price, sizeMl: b.sizeMl ?? null,
    sizes: (body["sizes"] as ProductDoc["sizes"]) ?? [], stock: b.stock, featured: b.featured,
    imageUrl: b.imageUrl ?? null, images: (body["images"] as string[]) ?? [], notes: b.notes,
    topNotes: b.topNotes ?? null, heartNotes: b.heartNotes ?? null, baseNotes: b.baseNotes ?? null,
    salePrice: (body["salePrice"] as number) || null, saleEndsAt: (body["saleEndsAt"] as string) || null,
    createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.products).add(data);
  const all = await loadProductsWithStats({});
  res.status(201).json(all.find((p) => p.id === ref.id));
});

router.put("/admin/products/:id", async (req, res) => {
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid product payload" }); return; }
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
  if (!snap.exists) { res.status(404).json({ error: "Product not found" }); return; }
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
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Expected non-empty array" }); return; }
  const batch = firestore.batch();
  let count = 0;
  for (const row of rows) {
    if (!row["name"] || !row["brand"] || !row["price"]) continue;
    const ref = firestore.collection(COLLECTIONS.products).doc();
    batch.set(ref, {
      name: String(row["name"]), brand: String(row["brand"]), description: String(row["description"] ?? ""),
      category: String(row["category"] ?? "Eau de Parfum"), collection: row["collection"] ? String(row["collection"]) : null,
      price: Number(row["price"]), sizeMl: row["sizeMl"] ? Number(row["sizeMl"]) : null, sizes: [],
      stock: row["stock"] ? Number(row["stock"]) : 0, featured: row["featured"] === "true" || row["featured"] === true,
      imageUrl: row["imageUrl"] ? String(row["imageUrl"]) : null, images: [],
      notes: row["notes"] ? String(row["notes"]).split(",").map((n) => n.trim()) : [],
      topNotes: row["topNotes"] ? String(row["topNotes"]) : null,
      heartNotes: row["heartNotes"] ? String(row["heartNotes"]) : null,
      baseNotes: row["baseNotes"] ? String(row["baseNotes"]) : null,
      salePrice: null, saleEndsAt: null, createdAt: Timestamp.now(),
    } satisfies ProductDoc);
    count++;
  }
  await batch.commit();
  res.json({ imported: count });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get("/admin/orders", async (req, res) => {
  const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const includeArchived = req.query["includeArchived"] === "true";
  const orders = await loadAllOrders(status, includeArchived);
  res.json(orders);
});

router.put("/admin/orders/:id/status", async (req, res) => {
  const { status } = req.body as { status?: string };
  const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const existing = snap.data() as OrderDoc;
  const history = existing.statusHistory ?? [];
  history.push({ status: status as OrderDoc["status"], timestamp: new Date().toISOString() });

  const isPaid = existing.paymentStatus === "paid" || Number(existing.amountPaid ?? 0) >= Number(existing.total);
  const shouldArchive = status === "cancelled" || (status === "delivered" && isPaid);
  await ref.update({ status, statusHistory: history, ...(shouldArchive ? { archived: true } : {}) });

  // Auto-archive to storage
  if (shouldArchive) {
    try {
      const folderId = await ensureOrderLogsFolder();
      const alreadyLogged = await firestore.collection(COLLECTIONS.storageItems)
        .where("referenceId", "==", req.params.id).where("type", "==", "order_log").get();
      if (alreadyLogged.empty) {
        await firestore.collection(COLLECTIONS.storageItems).add({
          folderId,
          type: "order_log",
          referenceId: req.params.id,
          title: `Order #${req.params.id.slice(0, 8).toUpperCase()} – ${existing.customerName}`,
          snapshot: {
            id: req.params.id,
            customerName: existing.customerName,
            customerEmail: existing.customerEmail,
            buyerPhone: existing.buyerPhone ?? null,
            shippingAddress: existing.shippingAddress ?? null,
            items: existing.items ?? [],
            subtotal: existing.subtotal,
            shipping: existing.shipping,
            discount: existing.discount ?? 0,
            couponCode: existing.couponCode ?? null,
            total: existing.total,
            amountPaid: existing.amountPaid ?? 0,
            paymentStatus: existing.paymentStatus ?? 'unpaid',
            paymentMethod: existing.paymentMethod,
            paymentNumber: existing.paymentNumber ?? null,
            status,
            statusHistory: existing.statusHistory ?? [],
            shippingConfirmed: existing.shippingConfirmed ?? false,
            freeDelivery: existing.freeDelivery ?? false,
            createdAt: existing.createdAt,
            txRef: existing.txRef ?? null,
            pesapalTrackingId: existing.pesapalTrackingId ?? null,
            giftWrapping: existing.giftWrapping ?? false,
            giftNote: existing.giftNote ?? null,
          } as Record<string, unknown>,
          archivedAt: Timestamp.now(),
        } satisfies StorageItemDoc);
      }
      // Move entirely to storage: delete from the orders collection
      await ref.delete();
    } catch { /* non-critical */ }
    // Order is now in storage only — return archived status without reloading doc
    res.json({ id: req.params.id, status, archived: true });
    return;
  }

  const all = await loadAllOrders(undefined, true);
  const dto = all.find((o) => o.id === req.params.id) as OrderDto;
  res.json(dto);
});

// Admin: record payment against an order
  router.post("/admin/orders/:id/payment", async (req, res) => {
    const { amount } = req.body as { amount?: number };
    if (!amount || amount <= 0) { res.status(400).json({ error: "amount is required" }); return; }
    const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const order = snap.data() as OrderDoc;
    const newAmountPaid = Math.min(Number(order.amountPaid ?? 0) + Number(amount), order.total);
    let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
    if (newAmountPaid >= order.total) paymentStatus = "paid";
    const payUpdates: Record<string, unknown> = { amountPaid: newAmountPaid, paymentStatus };
    // Auto-archive when payment completes a delivered order
    const nowPaidDelivered = paymentStatus === "paid" && order.status === "delivered";
    if (nowPaidDelivered) payUpdates["archived"] = true;
    await ref.update(payUpdates);
    if (nowPaidDelivered) {
      try {
        const folderId = await ensureOrderLogsFolder();
        const alreadyLogged = await firestore.collection(COLLECTIONS.storageItems)
          .where("referenceId", "==", req.params.id).where("type", "==", "order_log").get();
        if (alreadyLogged.empty) {
          await firestore.collection(COLLECTIONS.storageItems).add({
            folderId, type: "order_log" as const, referenceId: req.params.id,
            title: `Order #${req.params.id.slice(0, 8).toUpperCase()} – ${order.customerName}`,
            snapshot: {
              id: req.params.id,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              buyerPhone: order.buyerPhone ?? null,
              shippingAddress: order.shippingAddress ?? null,
              items: order.items ?? [],
              subtotal: Number(order.subtotal ?? 0),
              shipping: Number(order.shipping ?? 0),
              discount: Number(order.discount ?? 0),
              couponCode: order.couponCode ?? null,
              total: order.total,
              amountPaid: newAmountPaid,
              paymentStatus: 'paid',
              paymentMethod: order.paymentMethod,
              paymentNumber: order.paymentNumber ?? null,
              status: order.status,
              statusHistory: order.statusHistory ?? [],
              shippingConfirmed: order.shippingConfirmed ?? false,
              freeDelivery: order.freeDelivery ?? false,
              createdAt: order.createdAt instanceof Timestamp ? order.createdAt.toDate().toISOString() : new Date().toISOString(),
              txRef: (order as Record<string,unknown>)['txRef'] ?? null,
              pesapalTrackingId: (order as Record<string,unknown>)['pesapalTrackingId'] ?? null,
              giftWrapping: Boolean((order as Record<string,unknown>)['giftWrapping'] ?? false),
              giftNote: (order as Record<string,unknown>)['giftNote'] ?? null,
            } as Record<string, unknown>,
            archivedAt: Timestamp.now(),
          } satisfies StorageItemDoc);
        }
        // Move entirely to storage: delete from the orders collection
        await ref.delete();
      } catch { /* non-critical */ }
      // Order is now in storage only — return without reloading doc
      res.json({ id: req.params.id, archived: true, paymentStatus: 'paid', amountPaid: order.total, total: order.total, status: order.status });
      return;
    }
    const all = await loadAllOrders(undefined, true);
    res.json(all.find((o) => o.id === req.params.id));
  });

// Admin: set shipping fee for an order
  router.patch("/admin/orders/:id/shipping", async (req, res) => {
    try {
      const { shipping } = req.body as { shipping?: unknown };
      const shippingAmount = Number(shipping);
      if (isNaN(shippingAmount) || shippingAmount < 0) {
        res.status(400).json({ error: "shipping must be a non-negative number" }); return;
      }
      const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
      const order = snap.data() as OrderDoc;
      const newTotal = Math.max(0, Number(order.subtotal) - Number(order.discount ?? 0) + shippingAmount);
      const amountPaid = Number(order.amountPaid ?? 0);
      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (amountPaid >= newTotal && newTotal > 0) paymentStatus = "paid";
      else if (amountPaid > 0) paymentStatus = "partial";
      await ref.update({ shipping: shippingAmount, total: newTotal, shippingConfirmed: true, freeDelivery: shippingAmount === 0, paymentStatus });
      const dto = await loadOrderById(req.params.id);
      res.json(dto);
    } catch (err) {
      console.error("set shipping error:", err);
      res.status(500).json({ error: "Failed to set delivery fee — please try again" });
    }
  });

  // Admin: delete a completed/cancelled order
  router.delete("/admin/orders/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (!["cancelled", "delivered", "received"].includes(order.status)) {
    res.status(400).json({ error: "Only completed or cancelled orders can be deleted" }); return;
  }
  await ref.delete();
  // Remove storage log entries
  const storageSnap = await firestore.collection(COLLECTIONS.storageItems)
    .where("referenceId", "==", req.params.id).where("type", "==", "order_log").get();
  const batch = firestore.batch();
  for (const d of storageSnap.docs) batch.delete(d.ref);
  await batch.commit();
  res.status(204).send();
});

// ─── Storage ──────────────────────────────────────────────────────────────────
router.get("/admin/storage/folders", async (_req, res) => {
  await ensureOrderLogsFolder();
  const snap = await firestore.collection(COLLECTIONS.storageFolders).get();
  const folders = snap.docs.map((d) => {
    const f = d.data() as StorageFolderDoc;
    return { id: d.id, ...f, createdAt: f.createdAt instanceof Timestamp ? f.createdAt.toDate().toISOString() : new Date().toISOString() };
  });
  // System folders first
  folders.sort((a, b) => (b.isSystem ? 1 : 0) - (a.isSystem ? 1 : 0) || a.name.localeCompare(b.name));
  res.json(folders);
});

router.post("/admin/storage/folders", async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const data: StorageFolderDoc = {
    name: name.trim(), description: description?.trim() ?? "", isSystem: false, createdAt: Timestamp.now(),
  };
  const ref = await firestore.collection(COLLECTIONS.storageFolders).add(data);
  res.status(201).json({ id: ref.id, ...data, createdAt: new Date().toISOString() });
});

router.delete("/admin/storage/folders/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.storageFolders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Folder not found" }); return; }
  const folder = snap.data() as StorageFolderDoc;
  if (folder.isSystem) { res.status(400).json({ error: "System folders cannot be deleted" }); return; }
  // Move items to Order Logs
  const orderLogsId = await ensureOrderLogsFolder();
  const itemsSnap = await firestore.collection(COLLECTIONS.storageItems).where("folderId", "==", req.params.id).get();
  const batch = firestore.batch();
  for (const d of itemsSnap.docs) batch.update(d.ref, { folderId: orderLogsId });
  batch.delete(ref);
  await batch.commit();
  res.status(204).send();
});

router.get("/admin/storage/items", async (req, res) => {
  const folderId = typeof req.query["folderId"] === "string" ? req.query["folderId"] : undefined;
  const search = typeof req.query["search"] === "string" ? req.query["search"].toLowerCase() : undefined;
  const type = typeof req.query["type"] === "string" ? req.query["type"] : undefined;

  let query = firestore.collection(COLLECTIONS.storageItems) as FirebaseFirestore.Query;
  if (folderId) query = query.where("folderId", "==", folderId);
  if (type && (type === "order_log" || type === "blog_post")) query = query.where("type", "==", type);

  const snap = await query.get();
  let items = snap.docs.map((d) => {
    const item = d.data() as StorageItemDoc;
    return { id: d.id, ...item, archivedAt: item.archivedAt instanceof Timestamp ? item.archivedAt.toDate().toISOString() : new Date().toISOString() };
  });

  if (search) items = items.filter((i) => i.title.toLowerCase().includes(search));
  items.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  res.json(items);
});

// Delete storage item (and the underlying resource for order logs)
router.delete("/admin/storage/items/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.storageItems).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Item not found" }); return; }
  const item = snap.data() as StorageItemDoc;

  if (item.type === "order_log") {
    // Also delete the actual order
    await firestore.collection(COLLECTIONS.orders).doc(item.referenceId).delete().catch(() => {});
  }
  await ref.delete();
  res.status(204).send();
});

// Restore blog post from storage
router.post("/admin/storage/items/:id/restore", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.storageItems).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Item not found" }); return; }
  const item = snap.data() as StorageItemDoc;
  if (item.type !== "blog_post") { res.status(400).json({ error: "Only blog posts can be restored" }); return; }
  // Recreate the blog post document from the stored snapshot (original was deleted on archive)
  const snapshot = item.snapshot as Record<string, unknown>;
  await firestore.collection('blog').doc(item.referenceId).set({
    title: snapshot['title'] ?? '',
    summary: snapshot['summary'] ?? '',
    content: snapshot['content'] ?? '',
    imageUrl: snapshot['imageUrl'] ?? null,
    author: snapshot['author'] ?? 'Jojo Collections',
    published: false, // restore as draft — admin can re-publish manually
    createdAt: Timestamp.now(),
  });
  // Remove from storage now that it is restored
  await ref.delete();
  res.json({ message: 'Restored' });
});

// Archive blog post to a storage folder
router.post("/admin/storage/blog/:blogId/archive", async (req, res) => {
  const { folderId } = req.body as { folderId?: string };
  if (!folderId) { res.status(400).json({ error: "folderId is required" }); return; }
  // Blog posts live in the "blog" collection (managed by blog.ts routes)
  const blogRef = firestore.collection("blog").doc(req.params.blogId);
  const blogSnap = await blogRef.get();
  if (!blogSnap.exists) { res.status(404).json({ error: "Blog post not found" }); return; }
  const post = blogSnap.data() as BlogPostDoc;
  // Store full blog content in snapshot so it can be fully restored later
  await firestore.collection(COLLECTIONS.storageItems).add({
    folderId,
    type: 'blog_post',
    referenceId: req.params.blogId,
    title: post.title,
    snapshot: {
      title: post.title,
      summary: post.summary ?? '',
      content: post.content ?? '',
      imageUrl: post.imageUrl ?? null,
      author: post.author ?? 'Jojo Collections',
    } as Record<string, unknown>,
    archivedAt: Timestamp.now(),
  } satisfies StorageItemDoc);
  // Move entirely: delete the original blog post from the collection
  await blogRef.delete();
  res.json({ message: 'Archived' });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────
router.get("/admin/reviews", async (req, res) => {
  const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const snap = await firestore.collection(COLLECTIONS.reviews).get();
  const productSnap = await firestore.collection(COLLECTIONS.products).get();
  const productNames = new Map<string, string>();
  for (const d of productSnap.docs) productNames.set(d.id, (d.data() as ProductDoc).name);
  let reviews = snap.docs.map((d) =>
    toReviewDto(d.id, d.data() as ReviewDoc, productNames.get((d.data() as ReviewDoc).productId)),
  );
  if (status) reviews = reviews.filter((r) => r.status === status);
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(reviews);
});

router.put("/admin/reviews/:id", async (req, res) => {
  const parsed = UpdateReviewStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid status payload" }); return; }
  const ref = firestore.collection(COLLECTIONS.reviews).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Review not found" }); return; }
  await ref.update({ status: parsed.data.status });
  const fresh = await ref.get();
  const data = fresh.data() as ReviewDoc;
  const productSnap = await firestore.collection(COLLECTIONS.products).doc(data.productId).get();
  const productName = productSnap.exists ? (productSnap.data() as ProductDoc).name : undefined;
  res.json(toReviewDto(fresh.id, data, productName));
});

router.delete("/admin/reviews/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.reviews).doc(req.params.id).delete();
  res.status(204).send();
});

// ─── Coupons ──────────────────────────────────────────────────────────────────
router.get("/admin/coupons", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.coupons).get();
  const coupons = snap.docs.map((d) => { const c = d.data() as CouponDoc; return { id: d.id, ...c, createdAt: c.createdAt instanceof Timestamp ? c.createdAt.toDate().toISOString() : new Date().toISOString() }; });
  res.json(coupons);
});

router.post("/admin/coupons", async (req, res) => {
  const body = req.body as { code: string; type: string; value: number; minOrder?: number; maxUses?: number | null; expiryDate?: string | null };
  if (!body.code || !body.type || !body.value) { res.status(400).json({ error: "code, type and value are required" }); return; }
  if (!body.maxUses || Number(body.maxUses) < 1) { res.status(400).json({ error: "maxUses is required and must be at least 1 — unlimited coupons are not allowed for security reasons" }); return; }
  const couponValue = Number(body.value);
  if (body.type === "percentage" && couponValue > 80) { res.status(400).json({ error: "Percentage coupons cannot exceed 80% — set a fixed-amount coupon for larger discounts" }); return; }
  const data: CouponDoc = { code: body.code.toUpperCase().trim(), type: body.type as "percentage" | "fixed", value: couponValue, minOrder: Number(body.minOrder ?? 0), active: true, uses: 0, maxUses: Number(body.maxUses), expiryDate: body.expiryDate ?? null, createdAt: Timestamp.now() };
  const ref = await firestore.collection(COLLECTIONS.coupons).add(data);
  res.status(201).json({ id: ref.id, ...data, createdAt: new Date().toISOString() });
});

router.put("/admin/coupons/:id", async (req, res) => {
  const ref = firestore.collection(COLLECTIONS.coupons).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Not found" }); return; }
  const updates = req.body as Record<string, unknown>;
  if (updates["maxUses"] !== undefined && (Number(updates["maxUses"]) < 1 || updates["maxUses"] === null)) {
    res.status(400).json({ error: "maxUses cannot be removed or set below 1" }); return;
  }
  if (updates["type"] === "percentage" || (snap.data() as CouponDoc).type === "percentage") {
    if (updates["value"] !== undefined && Number(updates["value"]) > 80) {
      res.status(400).json({ error: "Percentage coupons cannot exceed 80%" }); return;
    }
  }
  await ref.update(updates);
  const fresh = await ref.get();
  const c = fresh.data() as CouponDoc;
  res.json({ id: fresh.id, ...c, createdAt: c.createdAt instanceof Timestamp ? c.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.delete("/admin/coupons/:id", async (req, res) => {
  await firestore.collection(COLLECTIONS.coupons).doc(req.params.id).delete();
  res.status(204).send();
});

// Rate limiter for coupon validation — prevents bulk probing of codes
const validateRateLimiter = new Map<string, { count: number; resetAt: number }>();
function checkValidateRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = validateRateLimiter.get(ip);
  if (!entry || now > entry.resetAt) { validateRateLimiter.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

router.post("/coupons/validate", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  if (!checkValidateRateLimit(ip)) { res.status(429).json({ error: "Too many requests — slow down" }); return; }
  const { code, orderTotal } = req.body as { code: string; orderTotal: number };
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  const snap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", code.toUpperCase().trim()).get();
  if (snap.empty) { res.status(404).json({ error: "Invalid coupon code" }); return; }
  const doc = snap.docs[0]!;
  const c = doc.data() as CouponDoc;
  if (!c.active) { res.status(400).json({ error: "Coupon is no longer active" }); return; }
  if (c.expiryDate && new Date(c.expiryDate) < new Date()) { res.status(400).json({ error: "This coupon has expired" }); return; }
  if (c.maxUses !== null && c.uses >= c.maxUses) { res.status(400).json({ error: "Coupon usage limit reached" }); return; }
  if (orderTotal < c.minOrder) { res.status(400).json({ error: `Minimum order ${c.minOrder} required` }); return; }
  // Return only what the frontend needs — never expose uses, maxUses, or internal id
  const discount = c.type === "percentage" ? (orderTotal * c.value) / 100 : Math.min(c.value, orderTotal);
  res.json({ code: c.code, discount: Math.round(discount * 100) / 100 });
});

// ─── Bundles ──────────────────────────────────────────────────────────────────
router.get("/bundles", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.bundles).where("active", "==", true).get();
  const bundles = snap.docs.map((d) => { const b = d.data() as BundleDoc; return { id: d.id, ...b, createdAt: b.createdAt instanceof Timestamp ? b.createdAt.toDate().toISOString() : new Date().toISOString() }; });
  res.json(bundles);
});

router.get("/admin/bundles", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.bundles).get();
  const bundles = snap.docs.map((d) => { const b = d.data() as BundleDoc; return { id: d.id, ...b, createdAt: b.createdAt instanceof Timestamp ? b.createdAt.toDate().toISOString() : new Date().toISOString() }; });
  res.json(bundles);
});

router.post("/admin/bundles", async (req, res) => {
  const body = req.body as { name: string; description: string; productIds: string[]; price: number; imageUrl?: string };
  if (!body.name || !body.productIds?.length || !body.price) { res.status(400).json({ error: "name, productIds and price required" }); return; }
  const data: BundleDoc = { name: body.name, description: body.description ?? "", productIds: body.productIds, price: Number(body.price), imageUrl: body.imageUrl ?? null, active: true, createdAt: Timestamp.now() };
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
  const posts = snap.docs
    .map((d) => { const p = d.data() as BlogPostDoc; return { id: d.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() }; })
    .filter((p) => !p.storedInFolder)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts);
});

router.get("/blog/:id", async (req, res) => {
  const doc = await firestore.collection(COLLECTIONS.blogPosts).doc(req.params.id).get();
  if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
  const p = doc.data() as BlogPostDoc;
  res.json({ id: doc.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() });
});

router.get("/admin/blog", async (req, res) => {
  const showStored = req.query["showStored"] === "true";
  const snap = await firestore.collection(COLLECTIONS.blogPosts).get();
  let posts = snap.docs
    .map((d) => { const p = d.data() as BlogPostDoc; return { id: d.id, ...p, createdAt: p.createdAt instanceof Timestamp ? p.createdAt.toDate().toISOString() : new Date().toISOString() }; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!showStored) posts = posts.filter((p) => !p.storedInFolder);
  res.json(posts);
});

router.post("/admin/blog", async (req, res) => {
  const body = req.body as { title: string; summary: string; content: string; imageUrl?: string; author?: string; published?: boolean };
  if (!body.title || !body.content) { res.status(400).json({ error: "title and content required" }); return; }
  const data: BlogPostDoc = { title: body.title, summary: body.summary ?? "", content: body.content, imageUrl: body.imageUrl ?? null, author: body.author ?? "Jojo Collections", published: body.published ?? false, storedInFolder: null, createdAt: Timestamp.now() };
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
  const existing = await firestore.collection(COLLECTIONS.stockAlerts).where("email", "==", email).where("productId", "==", productId).get();
  if (!existing.empty) { res.json({ message: "Already registered" }); return; }
  await firestore.collection(COLLECTIONS.stockAlerts).add({ email, productId, productName, createdAt: Timestamp.now() });
  res.status(201).json({ message: "Alert registered" });
});

router.get("/admin/stock-alerts", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.stockAlerts).get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

router.get("/admin/low-stock", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.products).get();
  const products = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
    .filter((p) => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock);
  res.json(products.map((p) => ({ id: p.id, name: p.name, brand: p.brand, stock: p.stock, imageUrl: p.imageUrl ?? null })));
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
  try {
    await firestore.collection(COLLECTIONS.settings).doc("public").set(req.body, { merge: true });
    const fresh = await firestore.collection(COLLECTIONS.settings).doc("public").get();
    res.json(fresh.data() ?? {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save settings";
    res.status(500).json({ error: msg });
  }
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
    const day = o.createdAt instanceof Timestamp ? o.createdAt.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(o.total ?? 0));
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
    for (const item of o.items ?? []) {
      const cur = salesByProduct.get(item.productId) ?? { name: item.name, quantity: 0, revenue: 0 };
      cur.quantity += item.quantity; cur.revenue += item.price * item.quantity;
      salesByProduct.set(item.productId, cur);
    }
  }
  const productMap = new Map<string, number>();
  for (const d of productsSnap.docs) productMap.set(d.id, (d.data() as ProductDoc).stock);
  const revenueChart = Array.from(revenueByDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-30)
    .map(([date, revenue]) => ({ date, revenue, orders: ordersByDay.get(date) ?? 0 }));
  const topSelling = Array.from(salesByProduct.entries()).map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  res.json({ revenueChart, topSelling });
});

export default router;
