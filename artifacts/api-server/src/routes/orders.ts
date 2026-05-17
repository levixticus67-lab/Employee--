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
  items: OrderItemDoc[]; subtotal: number; shipping: number; total: number;
  discount: number; couponCode: string | null; paymentMethod: string;
  paymentNumber: string | null; status: string;
  statusHistory: { status: string; timestamp: string }[]; createdAt: string;
};

function docToDto(id: string, d: OrderDoc): OrderDto {
  return {
    id, customerName: d.customerName, customerEmail: d.customerEmail,
    shippingAddress: d.shippingAddress, items: d.items ?? [],
    subtotal: Number(d.subtotal), shipping: Number(d.shipping), total: Number(d.total),
    discount: Number(d.discount ?? 0), couponCode: d.couponCode ?? null,
    paymentMethod: d.paymentMethod ?? "online", paymentNumber: d.paymentNumber ?? null,
    status: d.status,
    statusHistory: (d.statusHistory ?? []) as { status: string; timestamp: string }[],
    createdAt: tsToIso(d.createdAt),
  };
}

export async function loadOrderById(id: string): Promise<OrderDto | null> {
  const doc = await firestore.collection(COLLECTIONS.orders).doc(id).get();
  if (!doc.exists) return null;
  return docToDto(doc.id, doc.data() as OrderDoc);
}

export async function loadAllOrders(filterStatus?: string): Promise<OrderDto[]> {
  const snap = await firestore.collection(COLLECTIONS.orders).get();
  let orders = snap.docs.map((d) => docToDto(d.id, d.data() as OrderDoc));
  if (filterStatus) orders = orders.filter((o) => o.status === filterStatus);
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

      const shipping = (subtotal - discount) > 100 ? 0 : 15;
      const total = Math.max(0, subtotal - discount + shipping);
      const paymentMethod = (rawBody["paymentMethod"] as string) || "online";
      const paymentNumber = (rawBody["paymentNumber"] as string) || null;

      const order: OrderDoc = {
        customerName: body.customerName, customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress, items, subtotal, shipping, total,
        discount, couponCode, paymentMethod, paymentNumber,
        status: "pending",
        statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
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

export default router;
