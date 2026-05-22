import express, { Router, type IRouter } from "express";
import {
  firestore, COLLECTIONS, Timestamp,
  type OrderDoc, type OrderItemDoc, type ProductDoc,
  type CouponDoc, type CouponUsageDoc, type UserDoc,
  type PaymentTransactionDoc,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { loadOrderById } from "./orders";

const router: IRouter = Router();

// ── Pesapal V3 config ─────────────────────────────────────────────────────────
const PESAPAL_ENV = process.env["PESAPAL_ENV"] ?? "production";
const PESAPAL_BASE =
  PESAPAL_ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";
const CONSUMER_KEY = process.env["PESAPAL_CONSUMER_KEY"] ?? "";
const CONSUMER_SECRET = process.env["PESAPAL_CONSUMER_SECRET"] ?? "";
const STORED_IPN_ID = process.env["PESAPAL_IPN_ID"] ?? "";
/** Frontend base URL — used to build the callback_url after payment */
const FRONTEND_URL = (process.env["FRONTEND_URL"] ?? "").replace(/\/$/, "");
/** Backend public URL — used when auto-registering the IPN endpoint */
const BACKEND_URL = (
  process.env["RENDER_EXTERNAL_URL"] ?? process.env["BACKEND_URL"] ?? ""
).replace(/\/$/, "");

// ── Token cache ───────────────────────────────────────────────────────────────
interface TokenCache { value: string; expiresAt: number }
let tokenCache: TokenCache | null = null;

async function getPesapalToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });
  const data = (await res.json()) as {
    token?: string; expiryDate?: string; error?: unknown; status?: string;
  };
  if (!data.token) throw new Error(`Pesapal auth failed: ${JSON.stringify(data.error ?? data)}`);
  tokenCache = { value: data.token, expiresAt: new Date(data.expiryDate!).getTime() };
  return data.token;
}

// ── IPN registration (cached; register once per server lifetime) ──────────────
let cachedIpnId: string | null = STORED_IPN_ID || null;

async function getOrRegisterIpnId(token: string): Promise<string> {
  if (cachedIpnId) return cachedIpnId;
  const ipnUrl = `${BACKEND_URL}/api/payments/ipn`;
  const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "POST" }),
  });
  const data = (await res.json()) as { ipn_id?: string; error?: unknown; status?: string };
  if (!data.ipn_id) {
    throw new Error(`Pesapal IPN registration failed: ${JSON.stringify(data.error ?? data)}`);
  }
  cachedIpnId = data.ipn_id;
  return cachedIpnId;
}

// ── Transaction status query ──────────────────────────────────────────────────
interface PesapalStatusResponse {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  merchant_reference: string;
  payment_status_description: string;
  message: string;
  payment_account: string;
  status_code: number;
  payment_status_code: string;
  currency: string;
  error: unknown;
  status: string;
}

async function queryTransactionStatus(
  token: string,
  orderTrackingId: string,
): Promise<PesapalStatusResponse> {
  const res = await fetch(
    `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  return res.json() as Promise<PesapalStatusResponse>;
}

// ── Stock rollback if Pesapal submission fails ────────────────────────────────
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
  } catch { /* best-effort */ }
}

// ── POST /api/payments/initiate ───────────────────────────────────────────────
// Creates the Firestore order then either:
//   • Submits to Pesapal and returns a redirect_url (online payment)
//   • Returns the order directly (cash on delivery)
router.post("/payments/initiate", async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid order payload" }); return; }
  const body = parsed.data;
  const rawBody = req.body as Record<string, unknown>;

  const paymentMethod = (rawBody["paymentMethod"] as string) || "pesapal";
  const paymentNumber = (rawBody["paymentNumber"] as string) || null;
  const buyerPhone   = (rawBody["buyerPhone"]   as string) || null;
  const couponInput  = rawBody["couponCode"] as string | undefined;
  const userId       = req.session?.userId ?? null;
  const isOnline     = paymentMethod !== "cash_on_delivery";

  if (isOnline && (!CONSUMER_KEY || !CONSUMER_SECRET)) {
    res.status(503).json({ error: "Online payment gateway not configured. Please contact the store." });
    return;
  }

  // ── Phone binding check ──────────────────────────────────────────────────
  if (userId && paymentNumber) {
    const phoneQ = await firestore.collection(COLLECTIONS.users)
      .where("phoneNumber", "==", paymentNumber).limit(1).get();
    if (!phoneQ.empty && phoneQ.docs[0]!.id !== userId) {
      res.status(400).json({
        error: "This phone number is already linked to another account. Please use your own registered number.",
      });
      return;
    }
  }

  // ── Coupon pre-check ─────────────────────────────────────────────────────
  if (couponInput) {
    const couponSnap = await firestore.collection(COLLECTIONS.coupons)
      .where("code", "==", couponInput.toUpperCase().trim()).limit(1).get();
    if (!couponSnap.empty) {
      const couponId = couponSnap.docs[0]!.id;
      if (userId) {
        const uByUser = await firestore.collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", couponId).where("userId", "==", userId).limit(1).get();
        if (!uByUser.empty) {
          res.status(400).json({ error: "This account has already redeemed this promotion." });
          return;
        }
      }
      if (paymentNumber) {
        const uByPhone = await firestore.collection(COLLECTIONS.couponUsages)
          .where("couponId", "==", couponId).where("payerPhoneNumber", "==", paymentNumber).limit(1).get();
        if (!uByPhone.empty) {
          res.status(400).json({ error: "This payment number has already redeemed this promotion." });
          return;
        }
      }
    }
  }

  // ── Free delivery threshold ──────────────────────────────────────────────
  const settingsSnap = await firestore.collection(COLLECTIONS.settings).doc("public").get();
  const freeThreshold = settingsSnap.exists
    ? Number(settingsSnap.data()?.["freeDeliveryThreshold"] ?? 0) : 0;

  // ── Create order in a Firestore transaction ──────────────────────────────
  const productRefs = body.items.map((i) =>
    firestore.collection(COLLECTIONS.products).doc(i.productId));
  const newOrderRef = firestore.collection(COLLECTIONS.orders).doc();
  const orderId = newOrderRef.id;
  const txRef   = `jojo_${orderId}`;
  let finalTotal = 0;
  let discount   = 0;
  let couponCode: string | null = null;

  try {
    await firestore.runTransaction(async (tx) => {
      const productSnaps = await tx.getAll(...productRefs);
      const items: OrderItemDoc[] = [];
      let subtotal = 0;

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const req  = body.items[i]!;
        if (!snap.exists) throw new Error(`Product ${req.productId} not found`);
        const p = snap.data() as ProductDoc;
        if (p.stock < req.quantity) throw new Error(`Insufficient stock for "${p.name}"`);
        const price = Number(p.salePrice ?? p.price ?? 0);
        items.push({ productId: snap.id, name: p.name ?? "", brand: p.brand ?? "",
          price, quantity: req.quantity, imageUrl: p.imageUrl ?? null });
        subtotal += price * req.quantity;
      }

      // Coupon — for online payments: store code, lock ONLY after IPN confirms payment
      //          for COD: lock immediately (no async confirmation)
      if (couponInput) {
        const cSnap = await firestore.collection(COLLECTIONS.coupons)
          .where("code", "==", couponInput.toUpperCase().trim()).get();
        if (!cSnap.empty) {
          const cDoc = cSnap.docs[0]!;
          const c = cDoc.data() as CouponDoc;
          const expired = c.expiryDate ? new Date(c.expiryDate) < new Date() : false;
          if (c.active && !expired && (c.maxUses === null || c.uses < c.maxUses) && subtotal >= c.minOrder) {
            discount = c.type === "percentage"
              ? Math.round((subtotal * c.value / 100) * 100) / 100
              : Math.min(c.value, subtotal);
            couponCode = c.code;
            if (!isOnline) {
              // COD — lock now
              tx.update(cDoc.ref, { uses: (c.uses ?? 0) + 1 });
              const uRef = firestore.collection(COLLECTIONS.couponUsages).doc();
              tx.set(uRef, {
                couponId: cDoc.id, userId: userId ?? "",
                payerPhoneNumber: paymentNumber ?? "", createdAt: Timestamp.now(),
              } satisfies CouponUsageDoc);
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discount);
      finalTotal  = total;
      const qualifyFreeDelivery = freeThreshold > 0 && total >= freeThreshold;

      const order: OrderDoc = {
        customerName: body.customerName, customerEmail: body.customerEmail,
        shippingAddress: body.shippingAddress, buyerPhone, items,
        subtotal, shipping: 0, total,
        shippingConfirmed: qualifyFreeDelivery, freeDelivery: qualifyFreeDelivery,
        amountPaid: 0,
        paymentStatus: isOnline ? "pending" : "unpaid",
        discount, couponCode, paymentMethod, paymentNumber,
        status: "pending",
        statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
        archived: false,
        txRef: isOnline ? txRef : null,
        pesapalTrackingId: null,
        createdAt: Timestamp.now(),
      };
      tx.set(newOrderRef, order);
      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i]!;
        const p = snap.data() as ProductDoc;
        tx.update(snap.ref, { stock: p.stock - body.items[i]!.quantity });
      }
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to place order" });
    return;
  }

  // ── Bind phone to user account (first use) ───────────────────────────────
  if (userId && paymentNumber) {
    try {
      const uRef  = firestore.collection(COLLECTIONS.users).doc(userId);
      const uSnap = await uRef.get();
      if (uSnap.exists) {
        const u = uSnap.data() as UserDoc;
        if (!u.phoneNumber) await uRef.update({ phoneNumber: paymentNumber });
      }
    } catch (err) { req.log.warn({ err }, "Could not bind phone to user"); }
  }

  // ── Cash on delivery — return order immediately ───────────────────────────
  if (!isOnline) {
    const dto = await loadOrderById(orderId);
    res.status(201).json(dto);
    return;
  }

  // ── Submit to Pesapal ─────────────────────────────────────────────────────
  try {
    const token = await getPesapalToken();
    const ipnId = await getOrRegisterIpnId(token);

    const nameParts  = body.customerName.trim().split(" ");
    const firstName  = nameParts[0] ?? body.customerName;
    const lastName   = nameParts.slice(1).join(" ") || ".";
    const callbackUrl = `${FRONTEND_URL}/order/${orderId}`;

    const submitRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: txRef,
        currency: "UGX",
        amount: Math.round(finalTotal),
        description: `Jojo Collections order ${orderId.slice(0, 8).toUpperCase()}`,
        callback_url: callbackUrl,
        redirect_mode: "",
        notification_id: ipnId,
        branch: "",
        billing_address: {
          email_address: body.customerEmail,
          phone_number: (paymentNumber ?? buyerPhone ?? "").replace(/\D/g, ""),
          country_code: "UG",
          first_name: firstName,
          middle_name: "",
          last_name: lastName,
          line_1: body.shippingAddress.split("\n")[0] ?? "",
          line_2: "",
          city: "",
          state: "",
          postal_code: "",
          zip_code: "",
        },
      }),
    });

    const submitData = (await submitRes.json()) as {
      order_tracking_id?: string;
      merchant_reference?: string;
      redirect_url?: string;
      error?: unknown;
      status?: string;
    };

    if (!submitData.order_tracking_id || !submitData.redirect_url) {
      await rollbackOrder(orderId, body.items);
      const msg =
        typeof submitData.error === "object" && submitData.error !== null
          ? ((submitData.error as Record<string, unknown>)["message"] as string | undefined) ??
            "Payment initiation failed. Please try again."
          : (submitData.error as string) ?? "Payment initiation failed. Please try again.";
      res.status(400).json({ error: msg });
      return;
    }

    // Store Pesapal tracking ID on the order
    await firestore.collection(COLLECTIONS.orders).doc(orderId)
      .update({ pesapalTrackingId: submitData.order_tracking_id });

    const dto = await loadOrderById(orderId);
    res.status(201).json({ ...dto, redirectUrl: submitData.redirect_url });

  } catch (err) {
    req.log.error({ err }, "Pesapal submission error");
    await rollbackOrder(orderId, body.items);
    res.status(500).json({ error: "Could not reach payment gateway. Please try again." });
  }
});

// ── POST /api/payments/ipn ────────────────────────────────────────────────────
// Pesapal calls this endpoint when a transaction status changes.
// Pesapal V3 sends URL-encoded POST body:
//   OrderTrackingId=xxx&OrderMerchantReference=xxx&OrderNotificationType=IPNCHANGE
// We must reply with JSON: { orderNotificationType, orderTrackingId, orderMerchantReference, status:"200" }
router.post(
  "/payments/ipn",
  // Handle both application/x-www-form-urlencoded (Pesapal) and application/json
  (req, _res, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("urlencoded")) {
      express.urlencoded({ extended: false })(req, _res, next);
    } else {
      next();
    }
  },
  async (req, res) => {
    const b = req.body as Record<string, string>;
    const q = req.query  as Record<string, string>;

    const orderTrackingId = b.OrderTrackingId  || b.orderTrackingId  || q.OrderTrackingId  || q.orderTrackingId  || "";
    const merchantRef     = b.OrderMerchantReference || b.orderMerchantReference || q.OrderMerchantReference || q.orderMerchantReference || "";
    const notificationType = b.OrderNotificationType || q.OrderNotificationType || "IPNCHANGE";

    // Always ACK to Pesapal first (they retry if we don't respond promptly)
    res.status(200).json({
      orderNotificationType: notificationType,
      orderTrackingId,
      orderMerchantReference: merchantRef,
      status: "200",
    });

    if (!orderTrackingId && !merchantRef) return;

    try {
      // Find order by txRef (our merchant reference) for reliability
      const lookupField = merchantRef ? "txRef" : "pesapalTrackingId";
      const lookupValue = merchantRef || orderTrackingId;
      const ordersSnap  = await firestore.collection(COLLECTIONS.orders)
        .where(lookupField, "==", lookupValue).limit(1).get();
      if (ordersSnap.empty) return;

      const orderRef  = ordersSnap.docs[0]!.ref;
      const orderData = ordersSnap.docs[0]!.data() as OrderDoc;

      // Idempotency — already processed
      if (orderData.paymentStatus === "paid") return;

      // Query Pesapal for the actual status
      const token   = await getPesapalToken();
      const trackId = orderTrackingId || (orderData as any).pesapalTrackingId;
      if (!trackId) return;

      const statusData = await queryTransactionStatus(token, trackId);

      const isCompleted = statusData.payment_status_description?.toUpperCase() === "COMPLETED"
        || statusData.status_code === 1;
      const isFailed    = ["FAILED", "INVALID", "REVERSED"].includes(
        (statusData.payment_status_description ?? "").toUpperCase());

      if (isFailed && orderData.paymentStatus !== "failed") {
        await orderRef.update({ paymentStatus: "failed" });
        return;
      }

      if (!isCompleted) return;

      // ── Atomically mark paid + lock coupon ──────────────────────────────
      await firestore.runTransaction(async (tx) => {
        const fresh = (await tx.get(orderRef)).data() as OrderDoc;
        if (fresh.paymentStatus === "paid") return; // double-check in transaction

        tx.update(orderRef, {
          paymentStatus: "paid",
          amountPaid: fresh.total,
          pesapalTrackingId: trackId,
          status: "processing",
          statusHistory: [
            ...(fresh.statusHistory ?? []),
            { status: "processing", timestamp: new Date().toISOString() },
          ],
        });

        if (fresh.couponCode) {
          const cSnap = await firestore.collection(COLLECTIONS.coupons)
            .where("code", "==", fresh.couponCode).limit(1).get();
          if (!cSnap.empty) {
            const cDoc = cSnap.docs[0]!;
            const c    = cDoc.data() as CouponDoc;
            const dup  = await firestore.collection(COLLECTIONS.couponUsages)
              .where("couponId", "==", cDoc.id)
              .where("payerPhoneNumber", "==", fresh.paymentNumber ?? "")
              .limit(1).get();
            if (dup.empty) {
              tx.update(cDoc.ref, { uses: (c.uses ?? 0) + 1 });
              const uRef = firestore.collection(COLLECTIONS.couponUsages).doc();
              tx.set(uRef, {
                couponId: cDoc.id,
                userId: fresh.paymentNumber ?? fresh.customerEmail,
                payerPhoneNumber: fresh.paymentNumber ?? "",
                createdAt: Timestamp.now(),
              } satisfies CouponUsageDoc);
            }
          }
        }
      });

      // Record transaction in paymentTransactions collection
      await firestore.collection(COLLECTIONS.paymentTransactions).add({
        orderId: ordersSnap.docs[0]!.id,
        amount: statusData.amount ?? 0,
        currency: statusData.currency ?? "UGX",
        payerPhone: statusData.payment_account ?? "",
        payerName: orderData.customerName,
        payerEmail: orderData.customerEmail,
        txRef: merchantRef,
        pesapalTrackingId: trackId,
        confirmationCode: statusData.confirmation_code ?? "",
        status: "completed",
        createdAt: Timestamp.now(),
        completedAt: Timestamp.now(),
      } satisfies PaymentTransactionDoc);

    } catch (err) {
      // Log but do not re-throw — we already sent 200 to Pesapal
      req.log.error({ err }, "IPN processing error");
    }
  },
);

// ── GET /api/payments/status/:orderId ─────────────────────────────────────────
// Frontend can call this to force a status sync for a specific order.
router.get("/payments/status/:orderId", async (req, res) => {
  const orderRef  = firestore.collection(COLLECTIONS.orders).doc(req.params.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) { res.status(404).json({ error: "Order not found" }); return; }

  const order = orderSnap.data() as OrderDoc & { pesapalTrackingId?: string };
  // Only poll Pesapal if status is still pending
  if (order.paymentStatus !== "pending" || !order.pesapalTrackingId) {
    const { loadOrderById } = await import("./orders");
    res.json(await loadOrderById(req.params.orderId));
    return;
  }

  try {
    const token      = await getPesapalToken();
    const statusData = await queryTransactionStatus(token, order.pesapalTrackingId);
    const completed  = statusData.payment_status_description?.toUpperCase() === "COMPLETED"
      || statusData.status_code === 1;
    if (completed) {
      await orderRef.update({ paymentStatus: "paid", amountPaid: order.total });
    }
  } catch { /* non-critical */ }

  const { loadOrderById } = await import("./orders");
  res.json(await loadOrderById(req.params.orderId));
});

export default router;
