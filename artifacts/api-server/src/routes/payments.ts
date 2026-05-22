import { Router, type IRouter } from "express";
import {
  firestore,
  COLLECTIONS,
  Timestamp,
  type OrderDoc,
  type OrderItemDoc,
  type ProductDoc,
  type CouponDoc,
  type CouponUsageDoc,
  type UserDoc,
  type PaymentTransactionDoc,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { loadOrderById } from "./orders";

const router: IRouter = Router();

const FLW_SECRET_KEY = process.env["FLUTTERWAVE_SECRET_KEY"] ?? "";
const FLW_WEBHOOK_SECRET = process.env["FLUTTERWAVE_WEBHOOK_SECRET"] ?? "";
const FLW_BASE = "https://api.flutterwave.com/v3";

async function flwPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: string; message: string; data: Record<string, unknown> }> {
  const res = await fetch(`${FLW_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ status: string; message: string; data: Record<string, unknown> }>;
}

async function flwGet(
  path: string,
): Promise<{ status: string; data: Record<string, unknown> }> {
  const res = await fetch(`${FLW_BASE}${path}`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
  });
  return res.json() as Promise<{ status: string; data: Record<string, unknown> }>;
}

// Rollback order if STK push fails — restore stock and delete order
async function rollbackOrder(
  orderId: string,
  items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  try {
    const batch = firestore.batch();
    batch.delete(firestore.collection(COLLECTIONS.orders).doc(orderId));
    for (const item of items) {
      const ref = firestore.collection(COLLECTIONS.products).doc(item.productId);
      const snap = await ref.get();
      if (snap.exists) {
        const p = snap.data() as ProductDoc;
        batch.update(ref, { stock: (p.stock ?? 0) + item.quantity });
      }
    }
    await batch.commit();
  } catch {
    /* best-effort rollback */
  }
}

// ── POST /api/payments/initiate ───────────────────────────────────────────────
// Creates the order and either triggers an STK push (mobile money) or returns
// the order immediately (cash on delivery).
router.post("/payments/initiate", async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order payload" });
    return;
  }
  const body = parsed.data;
  const rawBody = req.body as Record<string, unknown>;

  const paymentMethod = (rawBody["paymentMethod"] as string) || "mtn_momo";
  const paymentNumber = (rawBody["paymentNumber"] as string) || null;
  const buyerPhone = (rawBody["buyerPhone"] as string) || null;
  const couponInput = rawBody["couponCode"] as string | undefined;
  const userId = req.session?.userId ?? null;
  const isMobileMoney = paymentMethod !== "cash_on_delivery";

  if (isMobileMoney && !paymentNumber) {
    res.status(400).json({ error: "Phone number is required for mobile money payment." });
    return;
  }

  if (isMobileMoney && !FLW_SECRET_KEY) {
    res.status(503).json({
      error: "Payment gateway not configured. Please contact the store.",
    });
    return;
  }

  // ── 1. Phone binding check ────────────────────────────────────────────────
  if (userId && paymentNumber) {
    const phoneQuery = await firestore
      .collection(COLLECTIONS.users)
      .where("phoneNumber", "==", paymentNumber)
      .limit(1)
      .get();
    if (!phoneQuery.empty && phoneQuery.docs[0]!.id !== userId) {
      res.status(400).json({
        error:
          "This phone number is already linked to another account. Please use your own registered payment number.",
      });
      return;
    }
  }

  // ── 2. Coupon pre-check (existence + per-user/per-phone duplicate) ─────────
  let preFetchedCouponId: string | null = null;
  if (couponInput) {
    const preCouponSnap = await firestore
      .collection(COLLECTIONS.coupons)
      .where("code", "==", couponInput.toUpperCase().trim())
      .limit(1)
      .get();
    if (!preCouponSnap.empty) {
      preFetchedCouponId = preCouponSnap.docs[0]!.id;
      if (userId) {
        const usageByUser = await firestore
          .collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", preFetchedCouponId)
          .where("userId", "==", userId)
          .limit(1)
          .get();
        if (!usageByUser.empty) {
          res.status(400).json({
            error: "This account or payment method has already redeemed this promotion.",
          });
          return;
        }
      }
      if (paymentNumber) {
        const usageByPhone = await firestore
          .collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", preFetchedCouponId)
          .where("payerPhoneNumber", "==", paymentNumber)
          .limit(1)
          .get();
        if (!usageByPhone.empty) {
          res.status(400).json({
            error: "This account or payment method has already redeemed this promotion.",
          });
          return;
        }
      }
    }
  }
  // suppress unused var warning — used for early coupon existence check above
  void preFetchedCouponId;

  // ── 3. Fetch settings ─────────────────────────────────────────────────────
  const settingsSnap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  const freeThreshold = settingsSnap.exists
    ? Number(settingsSnap.data()?.["freeDeliveryThreshold"] ?? 0)
    : 0;

  // ── 4. Create order in a Firestore transaction ────────────────────────────
  const productRefs = body.items.map((i) =>
    firestore.collection(COLLECTIONS.products).doc(i.productId),
  );
  const newOrderRef = firestore.collection(COLLECTIONS.orders).doc();
  const orderId = newOrderRef.id;
  const txRef = `jojo_${orderId}_${Date.now()}`;
  let finalTotal = 0;
  let discount = 0;
  let couponCode: string | null = null;

  try {
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

      // Coupon discount — for mobile money, do NOT lock coupon yet (lock on webhook)
      // For COD, lock coupon immediately since no webhook confirmation
      if (couponInput) {
        const couponSnap = await firestore
          .collection(COLLECTIONS.coupons)
          .where("code", "==", couponInput.toUpperCase().trim())
          .get();
        if (!couponSnap.empty) {
          const couponDoc = couponSnap.docs[0]!;
          const c = couponDoc.data() as CouponDoc;
          const isExpired = c.expiryDate ? new Date(c.expiryDate) < new Date() : false;
          if (
            c.active &&
            !isExpired &&
            (c.maxUses === null || c.uses < c.maxUses) &&
            subtotal >= c.minOrder
          ) {
            discount =
              c.type === "percentage"
                ? Math.round(((subtotal * c.value) / 100) * 100) / 100
                : Math.min(c.value, subtotal);
            couponCode = c.code;

            // Lock coupon immediately only for COD (mobile money locks on webhook)
            if (!isMobileMoney) {
              tx.update(couponDoc.ref, { uses: (c.uses ?? 0) + 1 });
              const usageRef = firestore.collection(COLLECTIONS.couponUsages).doc();
              tx.set(usageRef, {
                couponId: couponDoc.id,
                userId: userId ?? "",
                payerPhoneNumber: paymentNumber ?? "",
                createdAt: Timestamp.now(),
              } satisfies CouponUsageDoc);
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discount);
      finalTotal = total;
      const qualifiesFreeDelivery = freeThreshold > 0 && total >= freeThreshold;

      const order: OrderDoc = {
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress,
        buyerPhone,
        items,
        subtotal,
        shipping: 0,
        shippingConfirmed: qualifiesFreeDelivery,
        freeDelivery: qualifiesFreeDelivery,
        total,
        amountPaid: 0,
        paymentStatus: isMobileMoney ? "pending" : "unpaid",
        discount,
        couponCode,
        paymentMethod,
        paymentNumber,
        status: "pending",
        statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
        archived: false,
        txRef: isMobileMoney ? txRef : null,
        flwRef: null,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to place order";
    res.status(400).json({ error: message });
    return;
  }

  // ── 5. Bind phone to user account (first successful use) ──────────────────
  if (userId && paymentNumber) {
    try {
      const userRef = firestore.collection(COLLECTIONS.users).doc(userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const u = userSnap.data() as UserDoc;
        if (!u.phoneNumber) await userRef.update({ phoneNumber: paymentNumber });
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to bind phone number to user");
    }
  }

  // ── 6a. Cash on delivery — return order immediately ───────────────────────
  if (!isMobileMoney) {
    const dto = await loadOrderById(orderId);
    res.status(201).json(dto);
    return;
  }

  // ── 6b. Mobile money — trigger Flutterwave STK push ──────────────────────
  // Normalise for Flutterwave Uganda: strip non-digits, ensure starts with 0 or 256
  const rawPhone = paymentNumber ?? "";
  const digitsOnly = rawPhone.replace(/\D/g, "");
  const normalizedPhone =
    digitsOnly.startsWith("256") ? `0${digitsOnly.slice(3)}` : digitsOnly;

  try {
    const flwRes = await flwPost(`/charges?type=mobile_money_uganda`, {
      phone_number: normalizedPhone,
      amount: Math.round(finalTotal), // UGX is always whole numbers
      currency: "UGX",
      email: body.customerEmail,
      tx_ref: txRef,
      fullname: body.customerName,
      meta: { orderId },
    });

    // Flutterwave returns status:"success" + data.status:"pending" for a queued STK push
    if (flwRes.status === "success" || (flwRes.data as any)?.status === "pending") {
      const dto = await loadOrderById(orderId);
      res.status(201).json({ ...dto, txRef, paymentInitiated: true });
    } else {
      await rollbackOrder(orderId, body.items);
      const msg =
        (flwRes.message as string) ||
        "Payment initiation failed. Please check your number and try again.";
      res.status(400).json({ error: msg });
    }
  } catch {
    await rollbackOrder(orderId, body.items);
    res.status(500).json({
      error: "Could not reach payment gateway. Please try again.",
    });
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────────
// Receives Flutterwave event callbacks. Must return 200 quickly.
router.post("/payments/webhook", async (req, res) => {
  // Verify using the configured webhook secret hash
  const incomingHash = req.headers["verif-hash"] as string | undefined;
  if (!FLW_WEBHOOK_SECRET || incomingHash !== FLW_WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  type FlwEvent = {
    event: string;
    data: {
      id: number;
      tx_ref: string;
      flw_ref: string;
      status: string;
      amount: number;
      charged_amount: number;
      currency: string;
      customer: { email: string; phone_number: string; name: string };
    };
  };

  const event = req.body as FlwEvent;

  // Only process completed charge events
  if (event.event !== "charge.completed") {
    res.status(200).json({ received: true });
    return;
  }

  const { status, tx_ref, flw_ref, charged_amount, customer } = event.data;

  // Find the order by txRef
  const ordersSnap = await firestore
    .collection(COLLECTIONS.orders)
    .where("txRef", "==", tx_ref)
    .limit(1)
    .get();

  if (ordersSnap.empty) {
    res.status(200).json({ received: true, note: "Order not found" });
    return;
  }

  const orderDocRef = ordersSnap.docs[0]!.ref;
  const orderData = ordersSnap.docs[0]!.data() as OrderDoc;

  // Idempotency guard: already processed
  if (orderData.paymentStatus === "paid") {
    res.status(200).json({ received: true, note: "Already processed" });
    return;
  }

  if (status !== "successful") {
    // STK push was declined or failed — mark the order as failed
    await orderDocRef.update({ paymentStatus: "failed" });
    res.status(200).json({ received: true });
    return;
  }

  // ── Re-verify with Flutterwave (defence in depth) ─────────────────────────
  try {
    const verifyRes = await flwGet(`/transactions/${event.data.id}/verify`);
    const vd = verifyRes.data as {
      status: string;
      amount: number;
      currency: string;
      tx_ref: string;
    };
    if (
      verifyRes.status !== "success" ||
      vd.status !== "successful" ||
      vd.tx_ref !== tx_ref ||
      vd.currency !== "UGX"
    ) {
      req.log.warn({ tx_ref }, "Flutterwave re-verification mismatch");
      res.status(200).json({ received: true, note: "Verification mismatch" });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Flutterwave re-verify request failed");
    res.status(200).json({ received: true, note: "Could not verify" });
    return;
  }

  // ── Atomically mark order paid + lock coupon ──────────────────────────────
  try {
    await firestore.runTransaction(async (tx) => {
      const freshSnap = await tx.get(orderDocRef);
      if (!freshSnap.exists) return;
      const fresh = freshSnap.data() as OrderDoc;

      // Guard against double-processing in race condition
      if (fresh.paymentStatus === "paid") return;

      tx.update(orderDocRef, {
        paymentStatus: "paid",
        amountPaid: fresh.total,
        flwRef: flw_ref,
        status: "processing",
        statusHistory: [
          ...(fresh.statusHistory ?? []),
          { status: "processing", timestamp: new Date().toISOString() },
        ],
      });

      // Lock coupon now that payment is confirmed
      if (fresh.couponCode) {
        const couponSnap = await firestore
          .collection(COLLECTIONS.coupons)
          .where("code", "==", fresh.couponCode)
          .limit(1)
          .get();
        if (!couponSnap.empty) {
          const couponDoc = couponSnap.docs[0]!;
          const c = couponDoc.data() as CouponDoc;
          const payerPhone = fresh.paymentNumber ?? "";

          // Final duplicate check (in case of concurrent requests)
          const dupCheck = await firestore
            .collection(COLLECTIONS.couponUsages)
            .where("couponId", "==", couponDoc.id)
            .where("payerPhoneNumber", "==", payerPhone)
            .limit(1)
            .get();

          if (dupCheck.empty) {
            tx.update(couponDoc.ref, { uses: (c.uses ?? 0) + 1 });
            const usageRef = firestore.collection(COLLECTIONS.couponUsages).doc();
            tx.set(usageRef, {
              couponId: couponDoc.id,
              userId: fresh.paymentNumber ?? fresh.customerEmail,
              payerPhoneNumber: payerPhone,
              createdAt: Timestamp.now(),
            } satisfies CouponUsageDoc);
          }
        }
      }
    });

    // Record full transaction in paymentTransactions collection
    await firestore.collection(COLLECTIONS.paymentTransactions).add({
      orderId: ordersSnap.docs[0]!.id,
      amount: charged_amount,
      currency: "UGX",
      payerPhone: customer.phone_number,
      payerName: customer.name,
      payerEmail: customer.email,
      txRef: tx_ref,
      flwRef: flw_ref,
      status: "successful",
      createdAt: Timestamp.now(),
      completedAt: Timestamp.now(),
    } satisfies PaymentTransactionDoc);
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
    // Still return 200 so Flutterwave doesn't retry indefinitely
  }

  res.status(200).json({ received: true });
});

// ── GET /api/payments/transaction/:orderId ────────────────────────────────────
// Admin/frontend can poll for a transaction record by orderId
router.get("/payments/transaction/:orderId", async (req, res) => {
  const snap = await firestore
    .collection(COLLECTIONS.paymentTransactions)
    .where("orderId", "==", req.params.orderId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) {
    res.json(null);
    return;
  }
  const d = snap.docs[0]!.data() as PaymentTransactionDoc;
  res.json({
    id: snap.docs[0]!.id,
    ...d,
    createdAt:
      d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
    completedAt:
      d.completedAt instanceof Timestamp
        ? d.completedAt.toDate().toISOString()
        : null,
  });
});

export default router;
