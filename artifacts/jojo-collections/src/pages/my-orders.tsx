import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useCurrency } from "@/components/currency-context";
import { Package, Clock, Truck, PackageCheck, XCircle, ChevronDown, ChevronUp, Smartphone, CreditCard, CheckCircle2, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type OrderItem = { productId: string; name: string; brand: string; price: number; quantity: number; imageUrl: string | null };
type StatusEntry = { status: string; timestamp: string };
type Order = {
  id: string; createdAt: string; status: string; statusHistory: StatusEntry[];
  total: number; subtotal: number; shipping: number; discount: number;
  couponCode: string | null; paymentMethod: string; paymentNumber: string | null;
  buyerPhone: string | null; amountPaid: number; paymentStatus: string;
  items: OrderItem[]; archived: boolean;
};

const STATUS_STEPS = ["pending", "processing", "shipped", "delivered"];
const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock, processing: Package, shipped: Truck, delivered: PackageCheck,
  cancelled: XCircle, received: CheckCircle2,
};
const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-100",
  processing: "text-blue-600 bg-blue-100",
  shipped: "text-indigo-600 bg-indigo-100",
  delivered: "text-green-600 bg-green-100",
  cancelled: "text-red-600 bg-red-100",
  received: "text-emerald-600 bg-emerald-100",
};
const PAYMENT_LABELS: Record<string, string> = { online: "Credit/Debit Card", mtn_momo: "MTN Mobile Money", airtel_money: "Airtel Money" };

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
      onRefresh();
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
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50/30 rounded-xl p-3">
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
                <div className="flex justify-between text-xs text-blue-800/70"><span>Paid so far</span><span className="text-green-700 font-medium">{format(order.amountPaid)}</span></div>
                <div className="flex justify-between text-xs text-blue-800/70"><span>Remaining on delivery</span><span className="text-amber-700 font-medium">{format(remaining)}</span></div>
              </div>
            )}
            {order.paymentStatus === "paid" && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> Fully paid</div>
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
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-blue-400">Img</div>}
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
            {order.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>−{format(order.discount)}</span></div>}
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

      <Dialog open={showThankYou} onOpenChange={setShowThankYou}>
        <DialogContent className="max-w-sm text-center border-white/50 shadow-2xl" style={{ background: "linear-gradient(135deg, #fff9f0 0%, #fef3ff 50%, #f0f9ff 100%)" }}>
          <div className="py-4 px-2 space-y-4">
            <div className="text-5xl animate-bounce">🌺</div>
            <h2 className="text-2xl font-serif text-blue-950">Thank You So Much!</h2>
            <p className="text-blue-900/80 leading-relaxed text-sm">
              We are so happy your order arrived safely! 🌸<br /><br />
              Your support truly means the world to us. Every single purchase helps us grow and keep bringing you the finest fragrances.
            </p>
            <p className="text-sm text-purple-700/80 italic">
              We hope you absolutely love your new fragrance. ✨<br />
              We can't wait to see you again soon! 💛
            </p>
            <button
              onClick={() => setShowThankYou(false)}
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

export default function MyOrders() {
  const { data: session, isLoading: sessionLoading } = useGetCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadOrders = (email: string, silent = false) => {
    if (!silent) setLoading(true);
    apiFetch(`/api/orders/by-email/${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => { setOrders(data); hasLoadedRef.current = true; })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    loadOrders(email);
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif text-blue-950 mb-2">My Orders</h1>
          <p className="text-blue-900/70">Tap any order to see details and track its status.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
        ) : orders.length === 0 ? (
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
                onRefresh={() => loadOrders(session.user!.email, true)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
