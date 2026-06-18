import express, { Router, type IRouter } from "express";
  import {
    firestore, COLLECTIONS, Timestamp,
    type OrderDoc, type OrderItemDoc, type ProductDoc,
    type CouponDoc, type CouponUsageDoc, type UserDoc,
    type PaymentTransactionDoc,
  } from "@workspace/db";
  import { CreateOrderBody } from "@workspace/api-zod";
  import { loadOrderById } from "./orders";
import { getUsdToUgxRate } from "../lib/exchangeRate";

  const router: IRouter = Router();

  const PESAPAL_ENV  = process.env["PESAPAL_ENV"] ?? "production";
  const PESAPAL_BASE = PESAPAL_ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";
  const CONSUMER_KEY    = process.env["PESAPAL_CONSUMER_KEY"]    ?? "";
  const CONSUMER_SECRET = process.env["PESAPAL_CONSUMER_SECRET"] ?? "";
  const STORED_IPN_ID   = process.env["PESAPAL_IPN_ID"]          ?? "";
  const FRONTEND_URL    = (process.env["FRONTEND_URL"]            ?? "").replace(/\/$/, "");
  const BACKEND_URL     = (process.env["RENDER_EXTERNAL_URL"] ?? process.env["BACKEND_URL"] ?? "").replace(/\/$/, "");

  // Currency: DB prices are stored in USD. Pesapal transacts in UGX.
  // Exchange rate is fetched live from open.er-api.com (1h cache) via getUsdToUgxRate().
  // Set PESAPAL_CURRENCY if you ever switch currency (default UGX).
  const PESAPAL_CURRENCY = process.env["PESAPAL_CURRENCY"] ?? "UGX";

  interface TokenCache { value: string; expiresAt: number }
  let tokenCache: TokenCache | null = null;

  async function getPesapalToken(): Promise<string> {
    if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;
    const res  = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
    });
    const data = (await res.json()) as { token?: string; expiryDate?: string; error?: unknown };
    if (!data.token) throw new Error(`Pesapal auth failed: ${JSON.stringify(data.error ?? data)}`);
    tokenCache = { value: data.token, expiresAt: new Date(data.expiryDate!).getTime() };
    return data.token;
  }

  let cachedIpnId: string | null = STORED_IPN_ID || null;
  async function getOrRegisterIpnId(token: string): Promise<string> {
    if (cachedIpnId) return cachedIpnId;
    const ipnUrl = `${BACKEND_URL}/api/payments/ipn`;
    const res = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "POST" }),
    });
    const data = (await res.json()) as { ipn_id?: string; error?: unknown };
    if (!data.ipn_id) throw new Error(`Pesapal IPN registration failed: ${JSON.stringify(data.error ?? data)}`);
    cachedIpnId = data.ipn_id;
    return cachedIpnId;
  }

  interface PesapalStatusResponse {
    payment_method: string; amount: number; created_date: string; confirmation_code: string;
    merchant_reference: string; payment_status_description: string; message: string;
    payment_account: string; status_code: number; payment_status_code: string;
    currency: string; error: unknown; status: string;
  }

  async function queryTransactionStatus(token: string, orderTrackingId: string): Promise<PesapalStatusResponse> {
    const res = await fetch(
      `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    return res.json() as Promise<PesapalStatusResponse>;
  }

  async function rollbackOrder(orderId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
    try {
      const batch = firestore.batch();
      batch.delete(firestore.collection(COLLECTIONS.orders).doc(orderId));
      for (const item of items) {
        const ref  = firestore.collection(COLLECTIONS.products).doc(item.productId);
        const snap = await ref.get();
        if (snap.exists) batch.update(ref, { stock: ((snap.data() as ProductDoc).stock ?? 0) + item.quantity });
      }
      await batch.commit();
    } catch { /* best-effort */ }
  }

  // ── POST /api/payments/initiate ───────────────────────────────────────────────
  router.post("/payments/initiate", async (req, res) => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid order payload" }); return; }
    const body    = parsed.data;
    const rawBody = req.body as Record<string, unknown>;

    const paymentMethod = (rawBody["paymentMethod"] as string) || "pesapal";
    const paymentNumber = (rawBody["paymentNumber"] as string) || null;
    const buyerPhone    = (rawBody["buyerPhone"]    as string) || null;
    const couponInput   = rawBody["couponCode"] as string | undefined;
    // Partial payment: amount (USD) the customer wants to pay now via Pesapal.
    // Must be > 0 and <= order total. Defaults to full total if not provided.
    const partialAmountInput = rawBody["amountToPay"] as number | undefined;
    const giftWrapping = Boolean(rawBody["giftWrapping"] ?? false);
    const giftNote     = (rawBody["giftNote"] as string | undefined) ?? null;
    const isOnline = paymentMethod !== "cash_on_delivery";

    const userId       = req.session?.userId      ?? null;
    const firebaseUid  = req.session?.firebaseUid  ?? null;
    const canonicalUid = firebaseUid ?? userId ?? "";

    if (isOnline && (!CONSUMER_KEY || !CONSUMER_SECRET)) {
      res.status(503).json({ error: "Online payment gateway not configured. Please contact the store." }); return;
    }

    if (isOnline && !BACKEND_URL && !STORED_IPN_ID) {
      res.status(503).json({ error: "Payment gateway misconfigured: PESAPAL_IPN_ID or BACKEND_URL must be set on the server. Contact the store." }); return;
    }

    if (userId && paymentNumber) {
      const phoneQ = await firestore.collection(COLLECTIONS.users).where("phoneNumber", "==", paymentNumber).limit(1).get();
      if (!phoneQ.empty && phoneQ.docs[0]!.id !== userId) {
        res.status(400).json({ error: "This phone number is already linked to another account." }); return;
      }
    }

    if (couponInput) {
      const cSnap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", couponInput.toUpperCase().trim()).limit(1).get();
      if (!cSnap.empty) {
        const couponId = cSnap.docs[0]!.id;
        if (canonicalUid) {
          const uByUser = await firestore.collection(COLLECTIONS.couponUsages)
            .where("couponId", "==", couponId).where("userId", "==", canonicalUid).limit(1).get();
          if (!uByUser.empty) { res.status(400).json({ error: "This account has already redeemed this promotion." }); return; }
        }
        if (paymentNumber) {
          const uByPhone = await firestore.collection(COLLECTIONS.couponUsages)
            .where("couponId", "==", couponId).where("payerPhoneNumber", "==", paymentNumber).limit(1).get();
          if (!uByPhone.empty) { res.status(400).json({ error: "This payment number has already redeemed this promotion." }); return; }
        }
      }
    }

    const settingsSnap  = await firestore.collection(COLLECTIONS.settings).doc("public").get();
    const freeThreshold = settingsSnap.exists ? Number(settingsSnap.data()?.["freeDeliveryThreshold"] ?? 0) : 0;
    const productRefs   = body.items.map((i) => firestore.collection(COLLECTIONS.products).doc(i.productId));
    const newOrderRef   = firestore.collection(COLLECTIONS.orders).doc();
    const orderId = newOrderRef.id;
    const txRef   = `lenz_${orderId}`;
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
          const ri   = body.items[i]!;
          if (!snap.exists) throw new Error(`Product ${ri.productId} not found`);
          const p     = snap.data() as ProductDoc;
          if (p.stock < ri.quantity) throw new Error(`Insufficient stock for "${p.name}"`);
          const price = Number(p.salePrice ?? p.price ?? 0);
          items.push({ productId: snap.id, name: p.name ?? "", brand: p.brand ?? "", price, quantity: ri.quantity, imageUrl: p.imageUrl ?? null });
          subtotal += price * ri.quantity;
        }

        if (couponInput) {
          const cSnap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", couponInput.toUpperCase().trim()).get();
          if (!cSnap.empty) {
            const cDoc = cSnap.docs[0]!;
            const c    = cDoc.data() as CouponDoc;
            const expired = c.expiryDate ? new Date(c.expiryDate) < new Date() : false;
            if (c.active && !expired && (c.maxUses === null || c.uses < c.maxUses) && subtotal >= c.minOrder) {
              discount   = c.type === "percentage" ? Math.round((subtotal * c.value / 100) * 100) / 100 : Math.min(c.value, subtotal);
              couponCode = c.code;
              if (!isOnline) {
                tx.update(cDoc.ref, { uses: (c.uses ?? 0) + 1 });
                tx.set(firestore.collection(COLLECTIONS.couponUsages).doc(), {
                  couponId: cDoc.id, userId: canonicalUid,
                  payerPhoneNumber: paymentNumber ?? "", createdAt: Timestamp.now(),
                } satisfies CouponUsageDoc);
              }
            }
          }
        }

        const total = Math.max(0, subtotal - discount);
        finalTotal  = total;
        const qualifyFree = freeThreshold > 0 && total >= freeThreshold;

        const order: OrderDoc = {
          customerName: body.customerName, customerEmail: body.customerEmail,
          shippingAddress: body.shippingAddress, buyerPhone, items,
          subtotal, shipping: 0, total, shippingConfirmed: qualifyFree, freeDelivery: qualifyFree,
          amountPaid: 0, paymentStatus: isOnline ? "pending" : "unpaid",
          discount, couponCode, paymentMethod, paymentNumber,
          status: "pending",
          statusHistory: [{ status: "pending", timestamp: new Date().toISOString() }],
          archived: false, txRef: isOnline ? txRef : null, pesapalTrackingId: null,
          giftWrapping, giftNote,
          createdAt: Timestamp.now(),
        };
        tx.set(newOrderRef, order);
        for (let i = 0; i < productSnaps.length; i++) {
          tx.update(productSnaps[i]!.ref, { stock: (productSnaps[i]!.data() as ProductDoc).stock - body.items[i]!.quantity });
        }
      });
    } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to place order" }); return; }

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
      req.session.createdOrderIds = [...ids.slice(-19), orderId];
      await new Promise<void>((resolve) => { req.session.save(() => resolve()); });
    }

    if (!isOnline) { res.status(201).json(await loadOrderById(orderId)); return; }

    try {
      const token = await getPesapalToken();
      const ipnId = await getOrRegisterIpnId(token);
      const nameParts = body.customerName.trim().split(" ");
      const firstName = nameParts[0] ?? body.customerName;
      const lastName  = nameParts.slice(1).join(" ") || ".";
      const callbackUrl = `${FRONTEND_URL}/order/${orderId}`;

      // Determine the amount to charge:
      // - If the customer chose to pay a partial deposit, use that amount (clamped to [1, total])
      // - Otherwise charge the full order total
      // Amounts in DB are USD; Pesapal requires UGX — multiply by the exchange rate.
      const ugxRate = await getUsdToUgxRate();
      const chargeUSD = (partialAmountInput && partialAmountInput > 0 && partialAmountInput < finalTotal)
        ? Math.min(partialAmountInput, finalTotal)
        : finalTotal;
      const pesapalAmount = Math.round(chargeUSD * ugxRate);
      const isPartialPayment = chargeUSD < finalTotal;

      const submitRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: txRef, currency: PESAPAL_CURRENCY, amount: pesapalAmount,
          description: `Jojo Collections order ${orderId.slice(0, 8).toUpperCase()}${isPartialPayment ? " (deposit)" : ""}`,
          callback_url: callbackUrl, redirect_mode: "", notification_id: ipnId, branch: "",
          billing_address: {
            email_address: body.customerEmail,
            phone_number: (paymentNumber ?? buyerPhone ?? "").replace(/\D/g, ""),
            country_code: "UG", first_name: firstName, middle_name: "", last_name: lastName,
            line_1: body.shippingAddress.split("\n")[0] ?? "", line_2: "",
            city: "", state: "", postal_code: "", zip_code: "",
          },
        }),
      });

      const submitData = (await submitRes.json()) as {
        order_tracking_id?: string; merchant_reference?: string; redirect_url?: string; error?: unknown; status?: string;
      };

      if (!submitData.order_tracking_id || !submitData.redirect_url) {
          await rollbackOrder(orderId, body.items);
          req.log.error({ pesapalResponse: submitData }, "Pesapal SubmitOrderRequest rejected");
          let pesapalMsg = "Payment initiation failed. Please try again or contact the store.";
          if (submitData.error) {
            if (typeof submitData.error === "object" && submitData.error !== null) {
              const errObj = submitData.error as Record<string, unknown>;
              pesapalMsg = (errObj["message"] as string) ?? (errObj["error_description"] as string) ?? JSON.stringify(submitData.error);
            } else if (typeof submitData.error === "string") {
              pesapalMsg = submitData.error;
            }
          }
          res.status(400).json({ error: pesapalMsg }); return;
        }

      await firestore.collection(COLLECTIONS.orders).doc(orderId).update({
        pesapalTrackingId: submitData.order_tracking_id,
      });
      const dto = await loadOrderById(orderId);
      res.status(201).json({ ...dto, redirectUrl: submitData.redirect_url });
    } catch (err) {
      req.log.error({ err }, "Pesapal submission error");
      await rollbackOrder(orderId, body.items);
      // Surface the underlying Pesapal error so the merchant can act on it
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = /Pesapal|IPN|auth failed|token/i.test(rawMsg)
        ? rawMsg
        : "Could not reach payment gateway. Please try again.";
      res.status(500).json({ error: safeMsg });
    }
  });

  // ── POST /api/payments/ipn ────────────────────────────────────────────────────
  router.post(
    "/payments/ipn",
    (req, _res, next) => {
      const ct = req.headers["content-type"] ?? "";
      if (ct.includes("urlencoded")) express.urlencoded({ extended: false })(req, _res, next);
      else next();
    },
    async (req, res) => {
      const b = req.body as Record<string, string>;
      const q = req.query  as Record<string, string>;
      const orderTrackingId  = b.OrderTrackingId  || b.orderTrackingId  || q.OrderTrackingId  || q.orderTrackingId  || "";
      const merchantRef      = b.OrderMerchantReference || b.orderMerchantReference || q.OrderMerchantReference || q.orderMerchantReference || "";
      const notificationType = b.OrderNotificationType  || q.OrderNotificationType  || "IPNCHANGE";

      res.status(200).json({ orderNotificationType: notificationType, orderTrackingId, orderMerchantReference: merchantRef, status: "200" });
      if (!orderTrackingId && !merchantRef) return;

      try {
        const lookupField = merchantRef ? "txRef" : "pesapalTrackingId";
        const lookupValue = merchantRef || orderTrackingId;
        const ordersSnap  = await firestore.collection(COLLECTIONS.orders).where(lookupField, "==", lookupValue).limit(1).get();
        if (ordersSnap.empty) return;

        const orderRef  = ordersSnap.docs[0]!.ref;
        const orderData = ordersSnap.docs[0]!.data() as OrderDoc;
        if (orderData.paymentStatus === "paid") return;

        const token      = await getPesapalToken();
        const trackId    = orderTrackingId || (orderData as Record<string, unknown>)["pesapalTrackingId"] as string;
        if (!trackId) return;

        const statusData = await queryTransactionStatus(token, trackId);
        const isCompleted = statusData.payment_status_description?.toUpperCase() === "COMPLETED" || statusData.status_code === 1;
        const isFailed    = ["FAILED","INVALID","REVERSED"].includes((statusData.payment_status_description ?? "").toUpperCase());

        if (isFailed && orderData.paymentStatus !== "failed") { await orderRef.update({ paymentStatus: "failed" }); return; }
        if (!isCompleted) return;

        await firestore.runTransaction(async (tx) => {
          const fresh = (await tx.get(orderRef)).data() as OrderDoc;
          if (fresh.paymentStatus === "paid") return;

          // Pesapal reports the confirmed amount in the transaction currency (UGX).
          // Convert back to USD for amountPaid so it's comparable to order.total.
          const confirmedUGX = statusData.amount ?? 0;
          const ipnRate = await getUsdToUgxRate();
          const confirmedUSD = Math.round((confirmedUGX / ipnRate) * 100) / 100;
          const newAmountPaid = confirmedUSD;
          // If the confirmed payment covers the full order total, mark as paid.
          // If only a deposit was paid, mark as pending (balance owed at delivery).
          const newPaymentStatus = newAmountPaid >= fresh.total - 0.01 ? "paid" : "pending";

          tx.update(orderRef, {
            paymentStatus: newPaymentStatus,
            amountPaid: newAmountPaid,
            pesapalTrackingId: trackId,
            status: newPaymentStatus === "paid" ? "processing" : "pending",
            ...(newPaymentStatus === "paid" ? {
              statusHistory: [...(fresh.statusHistory ?? []), { status: "processing", timestamp: new Date().toISOString() }],
            } : {}),
          });

          if (fresh.couponCode && newPaymentStatus === "paid") {
            const cSnap = await firestore.collection(COLLECTIONS.coupons).where("code", "==", fresh.couponCode).limit(1).get();
            if (!cSnap.empty) {
              const cDoc = cSnap.docs[0]!;
              const c    = cDoc.data() as CouponDoc;
              const dup  = await firestore.collection(COLLECTIONS.couponUsages)
                .where("couponId", "==", cDoc.id).where("payerPhoneNumber", "==", fresh.paymentNumber ?? "").limit(1).get();
              if (dup.empty) {
                tx.update(cDoc.ref, { uses: (c.uses ?? 0) + 1 });
                tx.set(firestore.collection(COLLECTIONS.couponUsages).doc(), {
                  couponId: cDoc.id,
                  userId: fresh.paymentNumber ?? fresh.customerEmail,
                  payerPhoneNumber: fresh.paymentNumber ?? "",
                  createdAt: Timestamp.now(),
                } satisfies CouponUsageDoc);
              }
            }
          }
        });

        await firestore.collection(COLLECTIONS.paymentTransactions).add({
          orderId: ordersSnap.docs[0]!.id, amount: statusData.amount ?? 0,
          currency: statusData.currency ?? PESAPAL_CURRENCY,
          payerPhone: statusData.payment_account ?? "", payerName: orderData.customerName,
          payerEmail: orderData.customerEmail, txRef: merchantRef, pesapalTrackingId: trackId,
          confirmationCode: statusData.confirmation_code ?? "", status: "completed",
          createdAt: Timestamp.now(), completedAt: Timestamp.now(),
        } satisfies PaymentTransactionDoc);
      } catch (err) { req.log.error({ err }, "IPN processing error"); }
    },
  );

  // ── GET /api/payments/status/:orderId ─────────────────────────────────────────
  router.get("/payments/status/:orderId", async (req, res) => {
    const orderRef  = firestore.collection(COLLECTIONS.orders).doc(req.params.orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const isAdmin2   = req.session?.isAdmin;
    const isLoggedIn2 = Boolean(req.session?.userId);
    const isOwnOrder2 = (req.session?.createdOrderIds ?? []).includes(req.params.orderId);
    if (!isAdmin2 && !isLoggedIn2 && !isOwnOrder2) {
      res.status(403).json({ error: "Not authorized to view this order" }); return;
    }
    const order = orderSnap.data() as OrderDoc;
    const raw   = order as Record<string, unknown>;
    if (order.paymentStatus !== "pending" || !raw["pesapalTrackingId"]) {
      res.json(await loadOrderById(req.params.orderId)); return;
    }
    try {
      const token      = await getPesapalToken();
      const statusData = await queryTransactionStatus(token, raw["pesapalTrackingId"] as string);
      if (statusData.payment_status_description?.toUpperCase() === "COMPLETED" || statusData.status_code === 1) {
        const statusRate = await getUsdToUgxRate();
      const confirmedUSD = Math.round(((statusData.amount ?? 0) / statusRate) * 100) / 100;
        const newStatus    = confirmedUSD >= order.total - 0.01 ? "paid" : "pending";
        await orderRef.update({ paymentStatus: newStatus, amountPaid: confirmedUSD });
      }
    } catch { /* non-critical */ }
    res.json(await loadOrderById(req.params.orderId));
  });

  export default router;
  