import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useCurrency } from "@/components/currency-context";
import { Package, Clock, Truck, PackageCheck, XCircle, ChevronDown, ChevronUp, Smartphone, CreditCard, CheckCircle2, Trash2, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { CldImg } from "@/components/cld-img";

type OrderItem = { productId: string; name: string; brand: string; price: number; quantity: number; imageUrl: string | null };
type StatusEntry = { status: string; timestamp: string };
type Order = {
  id: string; createdAt: string; status: string; statusHistory: StatusEntry[];
  total: number; subtotal: number; shipping: number; discount: number;
  couponCode: string | null; paymentMethod: string; paymentNumber: string | null;
  buyerPhone: string | null; amountPaid: number; paymentStatus: string;
  items: OrderItem[]; archived: boolean;
};
type ReceiptItem = { productId: string; name: string; brand: string; price: number; quantity: number; imageUrl: string | null };
type ReceiptData = {
  id: string; orderId: string; customerEmail: string; customerName: string;
  items: ReceiptItem[]; total: number; subtotal: number; shipping: number;
  discount: number; couponCode: string | null; paymentMethod: string;
  createdAt: string; deliveredAt: string; expiresAt: string; collapsed: boolean;
  type?: "delivered" | "cancelled";
  cancellationReason?: string;
};

const STATUS_STEPS = ["pending", "processing", "shipped", "delivered"];
const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock, processing: Package, shipped: Truck, delivered: PackageCheck,
  cancelled: XCircle, received: CheckCircle2,
};
const STATUS_COLORS: Record<string, string> = {
  pending:    "text-yellow-200 bg-yellow-500/20 border border-yellow-400/40",
  processing: "text-sky-200 bg-blue-500/20 border border-blue-400/40",
  shipped:    "text-purple-200 bg-purple-500/20 border border-purple-400/40",
  delivered:  "text-emerald-200 bg-emerald-500/20 border border-emerald-400/40",
  cancelled:  "text-red-200 bg-red-500/20 border border-red-400/40",
  received:   "text-emerald-200 bg-emerald-500/20 border border-emerald-400/40",
};
const PAYMENT_LABELS: Record<string, string> = { online: "Credit/Debit Card", mtn_momo: "MTN Mobile Money", airtel_money: "Airtel Money" };

// ─── Receipt Card ─────────────────────────────────────────────────────────────
function ReceiptCard({ receipt, onDelete }: { receipt: ReceiptData; onDelete?: () => void }) {
  const { format } = useCurrency();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isExpired = receipt.collapsed || new Date(receipt.expiresAt) < new Date();

  const handleDeleteReceipt = async () => {
    if (!confirm("Remove this receipt from your history?")) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/receipts/${receipt.id}?email=${encodeURIComponent(receipt.customerEmail)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Receipt removed");
      onDelete?.();
    } catch { toast.error("Could not remove receipt"); } finally { setDeleting(false); }
  };

  const primaryProductName = receipt.items.length > 0
    ? receipt.items[0]!.name + (receipt.items.length > 1 ? ` +${receipt.items.length - 1} more` : "")
    : "Order";

  const deliveredDate = new Date(receipt.deliveredAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  // Cancellation notice card
  if (receipt.type === "cancelled") {
    return (
      <div className="glass-panel-heavy rounded-2xl border-red-400/30 overflow-hidden ring-1 ring-red-400/20">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/10 transition-colors">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-red-200 bg-red-500/20 border border-red-400/40">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-mono text-sm font-medium text-blue-950">Order #{receipt.orderId.slice(0, 8).toUpperCase()}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-200 border border-red-400/40">Cancelled</span>
            </div>
            <p className="text-xs text-blue-800/50 mt-0.5">
              Ordered {new Date(receipt.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {" · "}{receipt.items.length} item{receipt.items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-red-400/20 p-5 space-y-4">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-400/25 rounded-xl p-3.5">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-200">Your order was cancelled</p>
                {receipt.cancellationReason && (
                  <p className="text-xs text-blue-800/70 mt-1 leading-relaxed">
                    Reason: <span className="italic">{receipt.cancellationReason}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-3">Items</p>
              <div className="space-y-3">
                {receipt.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="w-12 h-12 glass-card rounded-lg p-1 flex-shrink-0 bg-white/40 overflow-hidden">
                      {item.imageUrl
                        ? <CldImg src={item.imageUrl} w={200} alt={item.name} className="w-full h-full object-contain" />
                        : <div className="w-full h-full flex items-center justify-center text-[8px] text-blue-400">Img</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-950 truncate">{item.name}</p>
                      <p className="text-xs text-blue-800/60">{item.brand} · Qty {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-blue-900 flex-shrink-0">{format(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={handleDeleteReceipt} disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Removing..." : "Dismiss"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tombstone — 1 compact line
  if (isExpired) {
    return (
      <div className="glass-panel-heavy rounded-2xl border-white/30 overflow-hidden px-5 py-3.5 flex items-center gap-3 opacity-60">
        <Receipt className="w-4 h-4 text-emerald-400/60 flex-shrink-0" />
        <p className="text-xs text-blue-900/60 font-mono truncate flex-1">
          {primaryProductName} &middot; {deliveredDate} &middot; Order #{receipt.orderId.slice(0, 8).toUpperCase()}
        </p>
        <button onClick={handleDeleteReceipt} disabled={deleting}
          className="flex-shrink-0 text-red-400/50 hover:text-red-500 transition-colors ml-1" title="Remove receipt">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Full receipt (within 2 weeks)
  const daysLeft = Math.ceil((new Date(receipt.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="glass-panel-heavy rounded-2xl border-emerald-400/30 overflow-hidden ring-1 ring-emerald-400/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/10 transition-colors"
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-200 bg-emerald-500/20 border border-emerald-400/40">
          <Receipt className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-sm font-medium text-blue-950">Order #{receipt.orderId.slice(0, 8).toUpperCase()}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
              ✓ Delivered
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-blue-800/50">
              Receipt · {daysLeft}d left
            </span>
          </div>
          <p className="text-xs text-blue-800/50 mt-0.5">
            {new Date(receipt.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}{receipt.items.length} item{receipt.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-blue-950">{format(receipt.total)}</p>
          {expanded ? <ChevronUp className="w-4 h-4 text-blue-400 ml-auto mt-1" /> : <ChevronDown className="w-4 h-4 text-blue-400 ml-auto mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-emerald-400/20 p-5 space-y-5">
          {/* Delivered confirmation */}
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-400/25 rounded-xl p-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-200">Order Delivered</p>
              <p className="text-xs text-blue-800/50 mt-0.5">
                Delivered on {new Date(receipt.deliveredAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Payment method */}
          {receipt.paymentMethod && (
            <div className="glass-card rounded-xl p-4 border-white/30">
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Payment</p>
              <div className="flex items-center gap-2 text-sm text-blue-900">
                {receipt.paymentMethod === "online" ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                <span>{PAYMENT_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fully paid
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-3">Items</p>
            <div className="space-y-3">
              {receipt.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="w-12 h-12 glass-card rounded-lg p-1 flex-shrink-0 bg-white/40 overflow-hidden">
                    {item.imageUrl
                      ? <CldImg src={item.imageUrl} w={200} alt={item.name} className="w-full h-full object-contain" />
                      : <div className="w-full h-full flex items-center justify-center text-[8px] text-blue-400">Img</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-950 truncate">{item.name}</p>
                    <p className="text-xs text-blue-800/60">{item.brand} · Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-blue-900 flex-shrink-0">{format(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-white/20 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-blue-900/70"><span>Subtotal</span><span>{format(receipt.subtotal)}</span></div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-green-300">
                <span>Discount{receipt.couponCode ? ` (${receipt.couponCode})` : ""}</span>
                <span>−{format(receipt.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-blue-900/70"><span>Shipping</span><span>{receipt.shipping === 0 ? "Free" : format(receipt.shipping)}</span></div>
            <div className="flex justify-between font-semibold text-blue-950 pt-1.5 border-t border-white/20"><span>Total</span><span>{format(receipt.total)}</span></div>
          </div>

          {/* Receipt notice */}
          <p className="text-center text-[11px] text-blue-800/40 italic">
            Full receipt visible for {daysLeft} more day{daysLeft !== 1 ? "s" : ""}.
          </p>

          {/* Delete */}
          <div className="flex justify-end">
            <button onClick={handleDeleteReceipt} disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-600 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Removing..." : "Remove receipt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, email, onRefresh }: { order: Order; email: string; onRefresh: () => void }) {
  const { format } = useCurrency();
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const StatusIcon = STATUS_ICONS[order.status] ?? Package;
  const currentIdx = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isReceived = order.status === "received";
  const canMarkReceived = ["delivered", "shipped"].includes(order.status);
  const canDelete = ["cancelled", "received", "delivered"].includes(order.status);
  const remaining = Math.round((order.total - (order.amountPaid ?? 0)) * 100) / 100;

  const handleMarkReceived = async () => {
    setMarking(true);
    try {
      const res = await apiFetch(`/api/orders/${order.id}/received`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setShowThankYou(true);
    } catch { toast.error("Could not update order status"); } finally { setMarking(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Remove this order from your history? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/orders/${order.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      toast.success("Order removed");
      onRefresh();
    } catch { toast.error("Could not delete order"); } finally { setDeleting(false); }
  };

  return (
    <div className="glass-panel-heavy rounded-2xl border-white/50 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/10 transition-colors">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${STATUS_COLORS[order.status] ?? "text-gray-600 bg-gray-100"}`}>
          <StatusIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-sm font-medium text-blue-950">Order #{order.id.slice(0, 8).toUpperCase()}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[order.status]}`}>{order.status}</span>
            {order.paymentStatus === "partial" && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Partial Payment</span>
            )}
          </div>
          <p className="text-xs text-blue-800/50 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-blue-950">{format(order.total)}</p>
          {expanded ? <ChevronUp className="w-4 h-4 text-blue-400 ml-auto mt-1" /> : <ChevronDown className="w-4 h-4 text-blue-400 ml-auto mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/20 p-5 space-y-6">
          {/* Status Timeline */}
          {!isCancelled && !isReceived ? (
            <div>
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-4">Order Progress</p>
              <div className="relative flex items-start justify-between">
                {STATUS_STEPS.map((step, i) => {
                  const Icon = STATUS_ICONS[step] ?? Package;
                  const done = i <= currentIdx;
                  const stepEntry = order.statusHistory?.find((h) => h.status === step);
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center text-center relative">
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`absolute top-4 h-0.5 transition-colors ${done && i < currentIdx ? "bg-blue-500" : "bg-white/30"}`}
                          style={{ left: "50%", right: "-50%", transform: "translateY(-50%)" }} />
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${done ? "bg-blue-600 border-blue-600" : "bg-white/40 border-white/40"}`}>
                        <Icon className={`w-4 h-4 ${done ? "text-white" : "text-blue-300"}`} />
                      </div>
                      <p className={`text-[10px] font-medium mt-1.5 capitalize ${done ? "text-blue-950" : "text-blue-800/40"}`}>{step}</p>
                      {stepEntry && <p className="text-[9px] text-blue-800/40">{new Date(stepEntry.timestamp).toLocaleDateString()}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : isReceived ? (
            <div className="flex items-center gap-2 text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4" /><span className="text-sm font-medium">You confirmed receiving this order.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700 bg-red-50/30 rounded-xl p-3">
              <XCircle className="w-4 h-4" /><span className="text-sm font-medium">This order was cancelled.</span>
            </div>
          )}

          {/* Payment */}
          <div className="glass-card rounded-xl p-4 border-white/30">
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Payment</p>
            <div className="flex items-center gap-2 text-sm text-blue-900 mb-2">
              {order.paymentMethod === "online" ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              <span>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
              {order.paymentNumber && <span className="text-blue-800/50">· {order.paymentNumber}</span>}
            </div>
            {order.paymentStatus === "partial" && (
              <div className="mt-2 space-y-1 border-t border-white/20 pt-2">
                <div className="flex justify-between text-xs text-blue-800/70"><span>Paid so far</span><span className="text-emerald-300 font-medium">{format(order.amountPaid)}</span></div>
                <div className="flex justify-between text-xs text-blue-800/70"><span>Remaining on delivery</span><span className="text-amber-700 font-medium">{format(remaining)}</span></div>
              </div>
            )}
            {order.paymentStatus === "paid" && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> Fully paid</div>
            )}
            {order.paymentStatus === "unpaid" && order.status === "pending" && order.paymentMethod !== "online" && (
              <p className="text-xs text-yellow-700 mt-1.5 bg-yellow-50/30 rounded-lg p-2">
                ⏳ Awaiting payment confirmation from the store.
              </p>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-3">Items Ordered</p>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="w-12 h-12 glass-card rounded-lg p-1 flex-shrink-0 bg-white/40 overflow-hidden">
                    {item.imageUrl ? <CldImg src={item.imageUrl} w={200} alt={item.name} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-blue-400">Img</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-950 truncate">{item.name}</p>
                    <p className="text-xs text-blue-800/60">{item.brand} · Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-blue-900 flex-shrink-0">{format(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-white/20 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-blue-900/70"><span>Subtotal</span><span>{format(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-300"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>−{format(order.discount)}</span></div>}
            <div className="flex justify-between text-blue-900/70"><span>Shipping</span><span>{order.shipping === 0 ? "Free" : format(order.shipping)}</span></div>
            <div className="flex justify-between font-semibold text-blue-950 pt-1.5 border-t border-white/20"><span>Total</span><span>{format(order.total)}</span></div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {canMarkReceived && (
              <Button onClick={handleMarkReceived} disabled={marking} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {marking ? "Updating..." : "I've Received My Order"}
              </Button>
            )}
            {canDelete && (
              <Button onClick={handleDelete} disabled={deleting} variant="outline" className="flex items-center gap-2 glass-card border-red-200/50 text-red-600 hover:text-red-700 hover:bg-red-50/30 rounded-xl px-5 text-sm">
                <Trash2 className="w-4 h-4" />
                {deleting ? "Removing..." : "Remove Order"}
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={showThankYou}
        onOpenChange={(open) => {
          setShowThankYou(open);
          if (!open) onRefresh();
        }}
      >
        <DialogContent className="max-w-sm text-center shadow-2xl border border-sky-400/20 !bg-transparent p-0 overflow-hidden">
          <div style={{ background: "linear-gradient(135deg, rgba(8,20,60,0.97) 0%, rgba(12,30,80,0.97) 50%, rgba(16,28,70,0.97) 100%)" }} className="py-6 px-6 space-y-4">
            <div className="text-5xl animate-bounce">🌺</div>
            <h2 className="text-2xl font-serif text-sky-50">Thank You So Much!</h2>
            <p className="text-sky-200/80 leading-relaxed text-sm">
              We are so happy your order arrived safely! 🌸<br /><br />
              Your support truly means the world to us. Every single purchase helps us grow and keep bringing you the finest fragrances.
            </p>
            <p className="text-sm text-sky-300/70 italic">
              We hope you absolutely love your new fragrance. ✨<br />
              We can't wait to see you again soon! 💛
            </p>
            <button
              onClick={() => { setShowThankYou(false); onRefresh(); }}
              className="mt-2 px-7 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full text-sm font-medium transition-all shadow-md"
            >
              You're Welcome! 💐
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyOrders() {
  const { data: session, isLoading: sessionLoading } = useGetCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadAll = (email: string, silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      apiFetch(`/api/orders/by-email/${encodeURIComponent(email)}`).then((r) => r.json()),
      apiFetch(`/api/receipts/by-email/${encodeURIComponent(email)}`).then((r) => r.json()),
    ])
      .then(([ordersData, receiptsData]) => {
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        hasLoadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    loadAll(email);
  }, [session?.user?.email]);

  if (sessionLoading) {
    return <Layout><div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" /></div></Layout>;
  }

  if (!session?.user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Package className="w-14 h-14 text-blue-200 mx-auto mb-4" />
          <h1 className="text-3xl font-serif text-blue-950 mb-3">My Orders</h1>
          <p className="text-blue-800/60 mb-6">Sign in to see your order history and track deliveries.</p>
          <Link href="/login"><Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8">Sign In</Button></Link>
        </div>
      </Layout>
    );
  }

  const isEmpty = orders.length === 0 && receipts.length === 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif text-blue-950 mb-2">My Orders</h1>
          <p className="text-blue-900/70">Tap any order to see details and track its status.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
        ) : isEmpty ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <Package className="w-12 h-12 text-blue-200 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-blue-950 mb-2">No orders yet</h2>
            <p className="text-blue-800/60 mb-6">Start shopping and your orders will appear here.</p>
            <Link href="/shop"><Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8">Browse Fragrances</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                email={session.user!.email}
                onRefresh={() => loadAll(session.user!.email, true)}
              />
            ))}
            {receipts.length > 0 && orders.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-white/20" />
                <p className="text-xs text-blue-800/40 font-medium uppercase tracking-wider">Completed</p>
                <div className="flex-1 h-px bg-white/20" />
              </div>
            )}
            {receipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} onDelete={() => loadAll(session.user!.email, true)} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
