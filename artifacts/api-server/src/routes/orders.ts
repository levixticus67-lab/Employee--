import { Router, type IRouter } from "express";
import {
  firestore, COLLECTIONS, Timestamp,
  type OrderDoc, type OrderItemDoc, type ProductDoc,
  type CouponDoc, type CouponUsageDoc, type UserDoc,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();
// Simple in-memory rate limiter — prevents bots spamming POST /orders
const orderRateLimiter = new Map<string, { count: number; resetAt: number }>();
function checkOrderRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15-minute window
  const maxPerWindow = 8; // max 8 orders per IP per 15 min
  const entry = orderRateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    orderRateLimiter.set(ip, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= maxPerWindow) return false;
  entry.count++;
  return true;
}
// Purge old entries every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of orderRateLimiter) { if (now > v.resetAt) orderRateLimiter.delete(k); }
}, 30 * 60 * 1000);



function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export type OrderDto = {
  id: string; customerName: string; customerEmail: string; shippingAddress: string;
  buyerPhone: string | null; items: OrderItemDoc[];
  subtotal: number; shipping: number; total: number; amountPaid: number;
  paymentStatus: string; discount: number; couponCode: string | null;
  paymentMethod: string; paymentNumber: string | null; status: string;
  shippingConfirmed: boolean; freeDelivery: boolean;
  statusHistory: { status: string; timestamp: string }[]; createdAt: string;
  archived: boolean; txRef: string | null; pesapalTrackingId: string | null;
  giftWrapping: boolean; giftNote: string | null;
};

function docToDto(id: string, d: OrderDoc): OrderDto {
  const raw = d as OrderDoc & Record<string, unknown>;
  return {
    id, customerName: d.customerName, customerEmail: d.customerEmail,
    shippingAddress: d.shippingAddress, buyerPhone: d.buyerPhone ?? null,
    items: d.items ?? [],
    subtotal: Number(d.subtotal), shipping: Number(d.shipping), total: Number(d.total),
    amountPaid: Number(d.amountPaid ?? 0), paymentStatus: d.paymentStatus ?? "unpaid",
    discount: Number(d.discount ?? 0), couponCode: d.couponCode ?? null,
    paymentMethod: d.paymentMethod ?? "online", paymentNumber: d.paymentNumber ?? null,
    shippingConfirmed: d.shippingConfirmed ?? false, freeDelivery: d.freeDelivery ?? false,
    status: d.status,
    statusHistory: (d.statusHistory ?? []) as { status: string; timestamp: string }[],
    createdAt: tsToIso(d.createdAt), archived: d.archived ?? false,
    txRef: (raw["txRef"] as string | null) ?? null,
    pesapalTrackingId: (raw["pesapalTrackingId"] as string | null) ?? null,
    giftWrapping: Boolean(raw["giftWrapping"] ?? false),
    giftNote: (raw["giftNote"] as string | null) ?? null,
  };
}

export async function loadOrderById(id: string): Promise<OrderDto | null> {
  const doc = await firestore.collection(COLLECTIONS.orders).doc(id).get();
  if (!doc.exists) return null;
  return docToDto(doc.id, doc.data() as OrderDoc);
}

export async function loadAllOrders(filterStatus?: string, includeArchived?: boolean): Promise<OrderDto[]> {
  const snap = await firestore.collection(COLLECTIONS.orders).get();
  let orders = snap.docs.map((d) => docToDto(d.id, d.data() as OrderDoc));
  if (filterStatus) orders = orders.filter((o) => o.status === filterStatus);
  if (!includeArchived) orders = orders.filter((o) => !o.archived);
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return orders;
}

// Customer: list orders by email — excludes orders hidden by the customer
router.get("/orders/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const snap = await firestore.collection(COLLECTIONS.orders).where("customerEmail", "==", email).get();
    const orders = snap.docs
      // Filter on raw Firestore data before DTO conversion (hiddenByCustomer is not in the DTO)
      .filter((d) => !d.data()["hiddenByCustomer"])
      .map((d) => docToDto(d.id, d.data() as OrderDoc))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(orders);
  } catch { res.json([]); }
});

router.post("/orders", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  if (!checkOrderRateLimit(ip)) {
    res.status(429).json({ error: "Too many orders placed from this connection — please wait a few minutes and try again." });
    return;
  }
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid order payload" }); return; }
  const body    = parsed.data;
  const rawBody = req.body as Record<string, unknown>;

  const productRefs   = body.items.map((i) => firestore.collection(COLLECTIONS.products).doc(i.productId));
  const couponInput   = rawBody["couponCode"] as string | undefined;
  const buyerPhone    = (rawBody["buyerPhone"]    as string) || null;
  const paymentNumber = (rawBody["paymentNumber"] as string) || null;
  const requestedAmountPaid = Number(rawBody["amountPaid"] ?? 0);

  // Canonical user identity: Firebase UID preferred, Firestore doc ID as fallback
  const userId       = req.session?.userId      ?? null;
  const firebaseUid  = req.session?.firebaseUid  ?? null;
  const canonicalUid = firebaseUid ?? userId ?? "";

  // Phone binding check
  if (userId && paymentNumber) {
    const phoneQ = await firestore.collection(COLLECTIONS.users)
      .where("phoneNumber", "==", paymentNumber).limit(1).get();
    if (!phoneQ.empty && phoneQ.docs[0]!.id !== userId) {
      res.status(400).json({ error: "This phone number is already linked to another account. Please use your own registered payment number." }); return;
    }
  }

  // Coupon pre-check (outside transaction to give early feedback)
  let preFetchedCouponId: string | null = null;
  if (couponInput) {
    const preCouponSnap = await firestore.collection(COLLECTIONS.coupons)
      .where("code", "==", couponInput.toUpperCase().trim()).limit(1).get();
    if (!preCouponSnap.empty) {
      preFetchedCouponId = preCouponSnap.docs[0]!.id;
      if (canonicalUid) {
        const uByUser = await firestore.collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", preFetchedCouponId).where("userId", "==", canonicalUid).limit(1).get();
        if (!uByUser.empty) { res.status(400).json({ error: "This account has already redeemed this promotion." }); return; }
      }
      if (paymentNumber) {
        const uByPhone = await firestore.collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", preFetchedCouponId).where("payerPhoneNumber", "==", paymentNumber).limit(1).get();
        if (!uByPhone.empty) { res.status(400).json({ error: "This payment number has already redeemed this promotion." }); return; }
      }
    }
  }
  void preFetchedCouponId;

  const settingsSnap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  const freeThreshold = settingsSnap.exists ? Number(settingsSnap.data()?.["freeDeliveryThreshold"] ?? 0) : 0;
  let discount = 0;
  let couponCode: string | null = null;

  try {
    const newOrderRef = firestore.collection(COLLECTIONS.orders).doc();
    await firestore.runTransaction(async (tx) => {
      const productSnaps = await tx.getAll(...productRefs);
      const items: OrderItemDoc[] = [];
      let subtotal = 0;

      for (let i = 0; i < productSnaps.length; i++) {
        const snap    = productSnaps[i]!;
        const reqItem = body.items[i]!;
        if (!snap.exists) throw new Error(`Product ${reqItem.productId} not found`);
        const p = snap.data() as ProductDoc;
        if (p.stock < reqItem.quantity) throw new Error(`Insufficient stock for ${p.name}`);
        const itemPrice = Number(p.salePrice ?? p.price ?? 0);
        items.push({ productId: snap.id, name: p.name ?? "", brand: p.brand ?? "", price: itemPrice, quantity: reqItem.quantity, imageUrl: p.imageUrl ?? null });
        subtotal += itemPrice * reqItem.quantity;
      }

      if (couponInput && preFetchedCouponId) {
        // Use predictable document IDs as mutex locks — strongly consistent inside transaction
        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
        const couponRef   = firestore.collection(COLLECTIONS.coupons).doc(preFetchedCouponId);
        const userLockId  = canonicalUid   ? `${preFetchedCouponId}_u_${sanitize(canonicalUid)}`   : null;
        const phoneLockId = paymentNumber  ? `${preFetchedCouponId}_p_${sanitize(paymentNumber)}` : null;
        const userLockRef  = userLockId  ? firestore.collection(COLLECTIONS.couponUsages).doc(userLockId)  : null;
        const phoneLockRef = phoneLockId ? firestore.collection(COLLECTIONS.couponUsages).doc(phoneLockId) : null;

        // Read the coupon and any existing lock docs inside the transaction (ACID guarantee)
        const couponSnap   = await tx.get(couponRef);
        const userLockSnap  = userLockRef  ? await tx.get(userLockRef)  : null;
        const phoneLockSnap = phoneLockRef ? await tx.get(phoneLockRef) : null;

        if (userLockSnap?.exists)  throw new Error("This account has already redeemed this promotion.");
        if (phoneLockSnap?.exists) throw new Error("This payment number has already redeemed this promotion.");

        if (couponSnap.exists) {
          const c = couponSnap.data() as CouponDoc;
          const expired = c.expiryDate ? new Date(c.expiryDate) < new Date() : false;
          if (c.active && !expired && (c.maxUses === null || c.uses < c.maxUses) && subtotal >= c.minOrder) {
            discount   = c.type === "percentage" ? Math.round((subtotal * c.value / 100) * 100) / 100 : Math.min(c.value, subtotal);
            couponCode = c.code;
            tx.update(couponRef, { uses: (c.uses ?? 0) + 1 });
            // Write lock documents — next concurrent transaction will see these and be blocked
            if (userLockRef)  tx.set(userLockRef,  { couponId: preFetchedCouponId, userId: canonicalUid, type: "user_lock",  createdAt: Timestamp.now() });
            if (phoneLockRef) tx.set(phoneLockRef, { couponId: preFetchedCouponId, userId: canonicalUid, type: "phone_lock", payerPhoneNumber: paymentNumber ?? "", createdAt: Timestamp.now() });
            // Human-readable record for admin history
            tx.set(firestore.collection(COLLECTIONS.couponUsages).doc(), {
              couponId: preFetchedCouponId, userId: canonicalUid,
              payerPhoneNumber: paymentNumber ?? "", createdAt: Timestamp.now(),
            } satisfies CouponUsageDoc);
          }
        }
      }

      const total = Math.max(0, subtotal - discount);
      const qualifyFree = freeThreshold > 0 && total >= freeThreshold;
      const paymentMethod = (rawBody["paymentMethod"] as string) || "online";
      const amountPaid    = Math.min(requestedAmountPaid, total);
      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (amountPaid >= total) paymentStatus = "paid";
      else if (amountPaid > 0) paymentStatus = "partial";

      const order: OrderDoc = {
        customerName: body.customerName, customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress, buyerPhone, items,
        subtotal, shipping: 0, total, amountPaid, paymentStatus,
        discount, couponCode, paymentMethod, paymentNumber,
        shippingConfirmed: qualifyFree, freeDelivery: qualifyFree,
        status: "pending",
        statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
        archived: false, txRef: null, pesapalTrackingId: null, createdAt: Timestamp.now(),
      };
      tx.set(newOrderRef, order);
      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const p    = snap.data() as ProductDoc;
        tx.update(snap.ref, { stock: p.stock - body.items[i]!.quantity });
      }
    });

    if (userId && paymentNumber) {
      try {
        const uRef = firestore.collection(COLLECTIONS.users).doc(userId);
        const uSnap = await uRef.get();
        if (uSnap.exists) { const u = uSnap.data() as UserDoc; if (!u.phoneNumber) await uRef.update({ phoneNumber: paymentNumber }); }
      } catch (err) { req.log.warn({ err }, "Could not bind phone to user"); }
    }

    // Store order ID in session so the customer can retrieve their own order without re-auth
    if (req.session) {
      const ids = req.session.createdOrderIds ?? [];
      req.session.createdOrderIds = [...ids.slice(-19), newOrderRef.id];
      await new Promise<void>((resolve) => { req.session.save(() => resolve()); });
    }
    res.status(201).json(await loadOrderById(newOrderRef.id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to place order" });
  }
});

router.get("/orders/:id", async (req, res) => {
  const order = await loadOrderById(req.params.id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const isAdmin = req.session?.isAdmin;
  const isLoggedIn = Boolean(req.session?.userId);
  const isOwnOrder = (req.session?.createdOrderIds ?? []).includes(req.params.id);
  if (!isAdmin && !isLoggedIn && !isOwnOrder) {
    res.status(403).json({ error: "Not authorized to view this order" }); return;
  }
  res.json(order);
});

router.put("/orders/:id/received", async (req, res) => {
  const { email } = req.body as { email?: string };
  const ref  = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) { res.status(403).json({ error: "Unauthorized" }); return; }
  if (!["delivered", "shipped"].includes(order.status)) { res.status(400).json({ error: "Order cannot be marked received in its current state" }); return; }
  const history = [...(order.statusHistory ?? []), { status: "received", timestamp: new Date().toISOString() }];
  await ref.update({ status: "received", statusHistory: history, archived: true });
  res.json(await loadOrderById(req.params.id));
});

router.post("/orders/:id/payment", async (req, res) => {
  const { email, amount } = req.body as { email?: string; amount?: number };
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount is required" }); return; }
  const ref  = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) { res.status(403).json({ error: "Unauthorized" }); return; }
  const newAmountPaid = Math.min(Number(order.amountPaid ?? 0) + Number(amount), order.total);
  let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
  if (newAmountPaid >= order.total) paymentStatus = "paid";
  await ref.update({ amountPaid: newAmountPaid, paymentStatus });
  res.json(await loadOrderById(req.params.id));
});

// Customer delete: soft-delete only — hides the order from the customer's view
// but keeps the order document in Firestore so admin logs remain intact.
router.delete("/orders/:id", async (req, res) => {
  const { email } = req.body as { email?: string };
  const ref  = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) { res.status(403).json({ error: "Unauthorized" }); return; }
  if (!["cancelled", "received", "delivered"].includes(order.status)) {
    res.status(400).json({ error: "Only cancelled or received orders can be removed" }); return;
  }
  // Soft delete: mark as hidden for the customer, do NOT delete the document
  await ref.update({ hiddenByCustomer: true });
  res.status(204).send();
});

export default router;
