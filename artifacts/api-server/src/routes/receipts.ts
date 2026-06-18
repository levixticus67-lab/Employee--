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

    // Auto-delete expired cancellation notices (2-day window)
    if (data.type === "cancelled" && data.expiresAt < now) {
      collapsePromises.push(doc.ref.delete().catch(() => {}));
      return null;
    }

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
  }).filter((x) => x !== null) as Array<{ id: string; deliveredAt: string; [key: string]: unknown }>;

  // Fire-and-forget — don't block the response
  Promise.all(collapsePromises).catch(() => {});

  // Sort newest delivered first
  receipts.sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

  res.json(receipts);
});

router.delete("/receipts/:id", async (req, res) => {
  const ref  = firestore.collection(COLLECTIONS.receipts).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Receipt not found" }); return; }
  const data    = snap.data() as ReceiptDoc;
  const isAdmin = (req as any).session?.isAdmin;
  const email   = typeof req.query["email"] === "string" ? req.query["email"].toLowerCase().trim() : "";
  if (!isAdmin && email !== data.customerEmail.toLowerCase()) {
    res.status(403).json({ error: "Not authorised to delete this receipt" }); return;
  }
  await ref.delete();
  res.status(204).send();
});

export default router;
