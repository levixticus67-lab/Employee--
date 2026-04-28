import { Router, type IRouter } from "express";
import {
  firestore,
  COLLECTIONS,
  Timestamp,
  type OrderDoc,
  type OrderItemDoc,
  type ProductDoc,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SHIPPING_FLAT = 5.0;

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export type OrderDto = {
  id: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  items: OrderItemDoc[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderDoc["status"];
  createdAt: string;
};

function docToDto(id: string, d: OrderDoc): OrderDto {
  return {
    id,
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    shippingAddress: d.shippingAddress,
    items: d.items ?? [],
    subtotal: Number(d.subtotal),
    shipping: Number(d.shipping),
    total: Number(d.total),
    status: d.status,
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

router.post("/orders", async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order payload" });
    return;
  }
  const body = parsed.data;

  const productRefs = body.items.map((i) =>
    firestore.collection(COLLECTIONS.products).doc(i.productId),
  );

  try {
    const newOrderRef = firestore.collection(COLLECTIONS.orders).doc();
    await firestore.runTransaction(async (tx) => {
      const productSnaps = await tx.getAll(...productRefs);
      const items: OrderItemDoc[] = [];
      let subtotal = 0;

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const reqItem = body.items[i]!;
        if (!snap.exists) {
          throw new Error(`Product ${reqItem.productId} not found`);
        }
        const p = snap.data() as ProductDoc;
        if (p.stock < reqItem.quantity) {
          throw new Error(`Insufficient stock for ${p.name}`);
        }
        const itemPrice = Number(p.price ?? 0);
        items.push({
          productId: snap.id,
          name: p.name ?? "Unknown product",
          brand: p.brand ?? "",
          price: itemPrice,
          quantity: reqItem.quantity,
          imageUrl: p.imageUrl ?? null,
        });
        subtotal += itemPrice * reqItem.quantity;
      }

      const shipping = SHIPPING_FLAT;
      const total = subtotal + shipping;

      const order: OrderDoc = {
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress,
        items,
        subtotal,
        shipping,
        total,
        status: "pending",
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
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

export default router;
