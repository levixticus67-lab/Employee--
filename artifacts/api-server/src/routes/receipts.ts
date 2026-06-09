import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, type ReceiptDoc } from "@workspace/db";

const router: IRouter = Router();

router.get("/receipts/by-email/:email", async (req, res) => {
  const email = req.params.email;
  if (!email) { res.status(400).json({ error: "email required" }); return; }

  const snap = await firestore
    .collection(COLLECTIONS.receipts)
    .where("customerEmail", "==", email)
    .get();

  const now = new Date().toISOString();
  const collapsePromises: Promise<void>[] = [];

  const receipts = snap.docs.map((doc) => {
    const data = doc.data() as ReceiptDoc;

    // Auto-collapse expired full receipts to tombstone
    if (!data.collapsed && data.expiresAt < now) {
      collapsePromises.push(
        doc.ref.update({
          collapsed: true,
          items: [],
          subtotal: 0,
          shipping: 0,
          discount: 0,
          couponCode: null,
          paymentMethod: "",
        }).catch(() => {})
      );
      return {
        id: doc.id,
        orderId: data.orderId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        items: [],
        total: data.total,
        subtotal: 0,
        shipping: 0,
        discount: 0,
        couponCode: null,
        paymentMethod: "",
        createdAt: data.createdAt,
        deliveredAt: data.deliveredAt,
        expiresAt: data.expiresAt,
        collapsed: true,
      };
    }

    return { id: doc.id, ...data };
  });

  // Fire-and-forget — don't block the response
  Promise.all(collapsePromises).catch(() => {});

  // Sort newest delivered first
  receipts.sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

  res.json(receipts);
});

export default router;
