import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, Timestamp, type OrderDoc, type OrderItemDoc, type ProductDoc, type CouponDoc } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export type OrderDto = {
  id: string; customerName: string; customerEmail: string; shippingAddress: string;
  buyerPhone: string | null;
  items: OrderItemDoc[]; subtotal: number; shipping: number; total: number;
  amountPaid: number; paymentStatus: string;
  discount: number; couponCode: string | null; paymentMethod: string;
  paymentNumber: string | null; status: string;
  statusHistory: { status: string; timestamp: string }[]; createdAt: string;
  archived: boolean;
};

function docToDto(id: string, d: OrderDoc): OrderDto {
  return {
    id, customerName: d.customerName, customerEmail: d.customerEmail,
    shippingAddress: d.shippingAddress, buyerPhone: d.buyerPhone ?? null,
    items: d.items ?? [],
    subtotal: Number(d.subtotal), shipping: Number(d.shipping), total: Number(d.total),
    amountPaid: Number(d.amountPaid ?? 0), paymentStatus: d.paymentStatus ?? "unpaid",
    discount: Number(d.discount ?? 0), couponCode: d.couponCode ?? null,
    paymentMethod: d.paymentMethod ?? "online", paymentNumber: d.paymentNumber ?? null,
    shippingConfirmed: d.shippingConfirmed ?? false,
    freeDelivery: d.freeDelivery ?? false,
    status: d.status,
    statusHistory: (d.statusHistory ?? []) as { status: string; timestamp: string }[],
    createdAt: tsToIso(d.createdAt),
    archived: d.archived ?? false,
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

// Customer: lookup orders by email
router.get("/orders/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const snap = await firestore.collection(COLLECTIONS.orders)
      .where("customerEmail", "==", email).get();
    const orders = snap.docs
      .map((d) => docToDto(d.id, d.data() as OrderDoc))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(orders);
  } catch {
    res.json([]);
  }
});

router.post("/orders", async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid order payload" }); return; }
  const body = parsed.data;
  const rawBody = req.body as Record<string, unknown>;

  const productRefs = body.items.map((i) => firestore.collection(COLLECTIONS.products).doc(i.productId));

  let discount = 0;
  let couponCode: string | null = null;
  const couponInput = rawBody["couponCode"] as string | undefined;
  const buyerPhone = (rawBody["buyerPhone"] as string) || null;
  const requestedAmountPaid = Number(rawBody["amountPaid"] ?? 0);

  // Fetch free delivery threshold from store settings
  const settingsSnap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  const freeThreshold = settingsSnap.exists ? Number(settingsSnap.data()?.["freeDeliveryThreshold"] ?? 0) : 0;

  try {
    const newOrderRef = firestore.collection(COLLECTIONS.orders).doc();
    await firestore.runTransaction(async (tx) => {
      const productSnaps = await tx.getAll(...productRefs);
      const items: OrderItemDoc[] = [];
      let subtotal = 0;

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const reqItem = body.items[i]!;
        if (!snap.exists) throw new Error(`Product ${reqItem.productId} not found`);
        const p = snap.data() as ProductDoc;
        if (p.stock < reqItem.quantity) throw new Error(`Insufficient stock for ${p.name}`);
        const itemPrice = Number(p.salePrice ?? p.price ?? 0);
        items.push({ productId: snap.id, name: p.name ?? "Unknown product", brand: p.brand ?? "", price: itemPrice, quantity: reqItem.quantity, imageUrl: p.imageUrl ?? null });
        subtotal += itemPrice * reqItem.quantity;
      }

      if (couponInput) {
        const couponSnap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", couponInput.toUpperCase().trim()).get();
        if (!couponSnap.empty) {
          const couponDoc = couponSnap.docs[0]!;
          const c = couponDoc.data() as CouponDoc;
          if (c.active && (c.maxUses === null || c.uses < c.maxUses) && subtotal >= c.minOrder) {
            discount = c.type === "percentage" ? Math.round((subtotal * c.value) / 100 * 100) / 100 : Math.min(c.value, subtotal);
            couponCode = c.code;
            tx.update(couponDoc.ref, { uses: c.uses + 1 });
          }
        }
      }

      const orderValue = subtotal - discount;
        const qualifiesFreeDelivery = freeThreshold > 0 && orderValue >= freeThreshold;
        const shipping = 0; // always starts at 0 – admin sets it, or it's free
        const shippingConfirmed = qualifiesFreeDelivery;
        const freeDelivery = qualifiesFreeDelivery;
        const total = Math.max(0, subtotal - discount); // shipping is 0 at creation
      const paymentMethod = (rawBody["paymentMethod"] as string) || "online";
      const paymentNumber = (rawBody["paymentNumber"] as string) || null;

      const amountPaid = Math.min(requestedAmountPaid, total);
      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (amountPaid >= total) paymentStatus = "paid";
      else if (amountPaid > 0) paymentStatus = "partial";

      const order: OrderDoc = {
        customerName: body.customerName, customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress, buyerPhone, items, subtotal, shipping, total,
        amountPaid, paymentStatus,
        discount, couponCode, paymentMethod, paymentNumber,
        shippingConfirmed,
        freeDelivery,
        status: "pending",
        statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
        archived: false,
        createdAt: Timestamp.now(),
      };
      tx.set(newOrderRef, order);

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const reqItem = body.items[i]!;
        const p = snap.data() as ProductDoc;
        tx.update(snap.ref, { stock: p.stock - reqItem.quantity });
      }
    });

    const dto = await loadOrderById(newOrderRef.id);
    res.status(201).json(dto);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to place order";
    res.status(400).json({ error: message });
  }
});

router.get("/orders/:id", async (req, res) => {
  const order = await loadOrderById(req.params.id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(order);
});

// User: mark order as received
router.put("/orders/:id/received", async (req, res) => {
  const { email } = req.body as { email?: string };
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    res.status(403).json({ error: "Unauthorized" }); return;
  }
  if (!["delivered", "shipped"].includes(order.status)) {
    res.status(400).json({ error: "Order cannot be marked received in its current state" }); return;
  }
  const history = order.statusHistory ?? [];
  history.push({ status: "received", timestamp: new Date().toISOString() });
  await ref.update({ status: "received", statusHistory: history, archived: true });
  const dto = await loadOrderById(req.params.id);
  res.json(dto);
});

// User: add partial payment
router.post("/orders/:id/payment", async (req, res) => {
  const { email, amount } = req.body as { email?: string; amount?: number };
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount is required" }); return; }
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    res.status(403).json({ error: "Unauthorized" }); return;
  }
  const newAmountPaid = Math.min(Number(order.amountPaid ?? 0) + Number(amount), order.total);
  let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
  if (newAmountPaid >= order.total) paymentStatus = "paid";
  await ref.update({ amountPaid: newAmountPaid, paymentStatus });
  const dto = await loadOrderById(req.params.id);
  res.json(dto);
});

// User: delete their own cancelled or received order
router.delete("/orders/:id", async (req, res) => {
  const { email } = req.body as { email?: string };
  const ref = firestore.collection(COLLECTIONS.orders).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const order = snap.data() as OrderDoc;
  if (email && order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    res.status(403).json({ error: "Unauthorized" }); return;
  }
  if (!["cancelled", "received", "delivered"].includes(order.status)) {
    res.status(400).json({ error: "Only cancelled or received orders can be deleted" }); return;
  }
  await ref.delete();
  res.status(204).send();
});

export default router;
