import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, MapPin, CreditCard, Phone, Wallet, Trash2, CheckCircle2, Truck, Gift } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useListAdminOrders } from "@workspace/api-client-react";
import { useCurrency } from "@/components/currency-context";

const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled", "received"];
const ADMIN_SET_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const ACTIVE_FILTER = "active";
const FILTERS = [ACTIVE_FILTER, "all", ...ALL_STATUSES];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  received: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

const FLOWERS = ["🌸", "🌺", "🌼", "🌻", "🌹", "💐", "🌷", "✨"];

function loadSeenReceived(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("jojo-seen-received") ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function FlowerCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    emoji: FLOWERS[i % FLOWERS.length]!,
    left: Math.round((i / 32) * 98 + Math.random() * 4 - 2),
    delay: parseFloat((Math.random() * 1.8).toFixed(2)),
    duration: parseFloat((2.2 + Math.random() * 1.6).toFixed(2)),
    size: Math.round(20 + Math.random() * 24),
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <style>{`
        @keyframes flowerRise {
          0%   { transform: translateY(0)      rotate(0deg);   opacity: 1; }
          75%  { opacity: 1; }
          100% { transform: translateY(-115vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: "-60px",
            fontSize: `${p.size}px`,
            animation: `flowerRise ${p.duration}s ${p.delay}s ease-out forwards`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

export default function AdminOrders() {
  const [filterMode, setFilterMode] = useState(ACTIVE_FILTER);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [shippingInput, setShippingInput] = useState("");
  const [settingShipping, setSettingShipping] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const { format, symbol } = useCurrency();

  const seenReceivedRef = useRef<Set<string>>(loadSeenReceived());

  const queryStatus = !["active", "all"].includes(filterMode) ? filterMode : undefined;
  const includeArchived = filterMode === "all";

  const { data: rawOrders, refetch, isLoading } = useListAdminOrders({
    status: queryStatus,
    ...(includeArchived ? { includeArchived: "true" } : {}),
  } as any);

  useEffect(() => {
    if (!rawOrders) return;
    const newReceived = (rawOrders as any[]).filter(
      (o) => o.status === "received" && !seenReceivedRef.current.has(o.id)
    );
    if (newReceived.length > 0) {
      newReceived.forEach((o) => seenReceivedRef.current.add(o.id));
      try {
        localStorage.setItem("jojo-seen-received", JSON.stringify([...seenReceivedRef.current]));
      } catch {}
      setShowCelebration(true);
    }
  }, [rawOrders]);

  const orders = filterMode === ACTIVE_FILTER
    ? rawOrders?.filter((o: any) => !o.archived)
    : rawOrders;

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success("Order status updated");
      refetch();
      if (selectedOrder?.id === id) setSelectedOrder((prev: any) => ({ ...prev, status }));
    } catch { toast.error("Failed to update status"); } finally { setUpdatingStatus(false); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Permanently delete this order? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Order deleted");
      setSelectedOrder(null);
      refetch();
    } catch { toast.error("Failed to delete order"); } finally { setDeletingId(null); }
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !selectedOrder) return;
    setRecordingPayment(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      toast.success(`Payment of ${format(amount)} recorded`);
      setSelectedOrder(updated);
      setPaymentAmount("");
      refetch();
    } catch { toast.error("Failed to record payment"); } finally { setRecordingPayment(false); }
  };

  const handleSetShipping = async () => {
    const amount = parseFloat(shippingInput);
    if (isNaN(amount) || amount < 0 || !selectedOrder) return;
    setSettingShipping(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.id}/shipping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping: amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.error ?? "Failed to set delivery fee");
        return;
      }
      const updated = await res.json();
      toast.success(amount === 0 ? "Free delivery confirmed!" : `Delivery fee set to ${format(amount)}`);
      setSelectedOrder(updated);
      setShippingInput("");
      refetch();
    } catch { toast.error("Failed to set delivery fee"); } finally { setSettingShipping(false); }
  };

  const canDelete = (o: any) => ["cancelled", "delivered", "received"].includes(o?.status);

  return (
    <AdminLayout>
      {showCelebration && <FlowerCelebration onDone={() => setShowCelebration(false)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Orders</h1>
          <p className="text-blue-900/70">Manage customer orders and fulfilment</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-white/20 backdrop-blur-md rounded-lg p-1 border border-white/30">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilterMode(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${filterMode === f ? "bg-white text-blue-900 shadow-sm" : "text-blue-800/70 hover:text-blue-900"}`}>
              {f === "active" ? "Active" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel-heavy rounded-3xl border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/20 border-b border-white/30">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Order ID</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Date</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Customer</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Total</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Payment</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : !orders?.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">No orders found.</td></tr>
              ) : (
                orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { setSelectedOrder(order); setPaymentAmount(""); setShippingInput(""); }}>
                    <td className="px-6 py-4 font-mono text-sm text-blue-900">{order.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-blue-800/80">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-blue-950">{order.customerName}</p>
                      <p className="text-xs text-blue-800/70">{order.customerEmail}</p>
                      {order.buyerPhone && <p className="text-xs text-blue-600">{order.buyerPhone}</p>}
                    </td>
                    <td className="px-6 py-4 font-medium text-blue-950">{format(order.total)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "bg-gray-100 text-gray-700"}`}>
                        {order.paymentStatus === "partial" ? `${((order.amountPaid / order.total) * 100).toFixed(0)}% paid` : order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full border capitalize font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
                          {order.status}
                        </span>
                        {order.status === "received" && (
                          <span title="Customer confirmed receipt — please mark as Delivered" className="text-base leading-none">📦</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setPaymentAmount(""); setShippingInput(""); }} className="text-sm text-blue-600 hover:text-blue-800 font-medium mr-3">
                        View
                      </button>
                      {canDelete(order) && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} disabled={deletingId === order.id} className="text-sm text-red-500 hover:text-red-700">
                          {deletingId === order.id ? "..." : "Delete"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-3xl glass-panel-heavy border-white/50 shadow-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-4 pb-4 border-b border-white/20">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <DialogTitle className="text-2xl font-serif text-blue-950">
                  Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {canDelete(selectedOrder) && (
                    <Button onClick={() => handleDeleteOrder(selectedOrder.id)} disabled={deletingId === selectedOrder.id} variant="outline"
                      className="flex items-center gap-1.5 glass-card text-red-600 border-red-200/50 hover:bg-red-50/30 rounded-xl text-sm px-3 py-1.5 h-auto">
                      <Trash2 className="w-3.5 h-3.5" /> {deletingId === selectedOrder.id ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                    disabled={updatingStatus}
                    className={`text-sm px-3 py-1.5 rounded-full border capitalize font-medium outline-none ${STATUS_COLORS[selectedOrder.status] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}
                  >
                    {ADMIN_SET_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-white text-gray-900 capitalize">{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-blue-800/70 mt-1">{new Date(selectedOrder.createdAt).toLocaleString()}</p>

              {selectedOrder.status === "received" && (
                <div className="mt-3 bg-emerald-50/40 border border-emerald-200/60 rounded-xl p-3 flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">📦</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Customer confirmed they received this order!</p>
                    <p className="text-xs text-emerald-700/80 mt-0.5">Use the dropdown above to change the status to <strong>Delivered</strong> to complete the order.</p>
                  </div>
                </div>
              )}
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium"><MapPin className="w-4 h-4 text-blue-600" /> Customer & Shipping</div>
                <p className="text-sm font-medium text-blue-950">{selectedOrder.customerName}</p>
                <p className="text-sm text-blue-800/80">{selectedOrder.customerEmail}</p>
                {selectedOrder.buyerPhone && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-sm text-blue-700">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <a href={`tel:${selectedOrder.buyerPhone}`} className="hover:underline font-medium">{selectedOrder.buyerPhone}</a>
                  </div>
                )}
                <div className="mt-2 text-sm text-blue-800/80 whitespace-pre-line">{selectedOrder.shippingAddress}</div>
              </div>

              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium"><CreditCard className="w-4 h-4 text-blue-600" /> Financial Summary</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-blue-800/80"><span>Subtotal</span><span>{format(selectedOrder.subtotal)}</span></div>
                  {selectedOrder.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{format(selectedOrder.discount)}</span></div>}
                  <div className="flex justify-between text-blue-800/80"><span>Shipping</span><span>{format(selectedOrder.shipping)}</span></div>
                  <div className="flex justify-between font-medium text-blue-950 pt-2 border-t border-white/20"><span>Total</span><span>{format(selectedOrder.total)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-800/70">Payment status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_COLORS[selectedOrder.paymentStatus] ?? ""}`}>{selectedOrder.paymentStatus}</span>
                  </div>
                  {selectedOrder.paymentStatus !== "unpaid" && (
                    <div className="flex justify-between text-xs text-blue-800/80">
                      <span>Amount paid</span><span className="text-green-700 font-medium">{format(selectedOrder.amountPaid)}</span>
                    </div>
                  )}
                  {selectedOrder.paymentStatus === "partial" && (
                    <div className="flex justify-between text-xs text-blue-800/80">
                      <span>Remaining</span><span className="text-amber-700 font-medium">{format(selectedOrder.total - selectedOrder.amountPaid)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!(selectedOrder as any).shippingConfirmed ? (
              <div className="glass-card rounded-xl p-4 border-orange-200/50 bg-orange-50/10 mb-6">
                <div className="flex items-center gap-2 mb-2 text-blue-950 font-medium">
                  <Truck className="w-4 h-4 text-orange-500" /> Set Delivery Fee
                </div>
                <p className="text-xs text-blue-800/70 mb-3">
                  Review the customer's address and items, then enter the delivery cost in <strong>USD</strong> (the app converts it to the customer's currency automatically). Enter 0 for free delivery.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-medium select-none">{symbol}</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={shippingInput}
                      onChange={(e) => setShippingInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full glass-card rounded-xl pl-8 pr-4 py-2 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                    />
                  </div>
                  <Button onClick={handleSetShipping} disabled={settingShipping || shippingInput === ""} className="rounded-xl text-sm h-auto py-2 px-4">
                    {settingShipping ? "..." : "Confirm"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-3 border-green-200/50 bg-green-50/10 mb-6 flex items-center gap-2">
                {(selectedOrder as any).freeDelivery ? <Gift className="w-4 h-4 text-green-600 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                <span className="text-sm text-green-800 font-medium">
                  {(selectedOrder as any).freeDelivery ? "Free delivery confirmed" : `Delivery fee: ${format(selectedOrder.shipping)}`}
                </span>
                <button onClick={() => setSelectedOrder((prev: any) => ({ ...prev, shippingConfirmed: false }))} className="ml-auto text-xs text-blue-500 hover:underline">Change</button>
              </div>
            )}

            {selectedOrder.paymentStatus !== "paid" && (
              <div className="glass-card rounded-xl p-4 border-white/30 mb-6">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium"><Wallet className="w-4 h-4 text-blue-600" /> Record Payment</div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-medium select-none">{symbol}</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      placeholder="Amount received"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full glass-card rounded-xl pl-8 pr-4 py-2.5 text-blue-950 border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <Button onClick={handleRecordPayment} disabled={recordingPayment || !paymentAmount} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5">
                    {recordingPayment ? "..." : "Record"}
                  </Button>
                </div>
                {selectedOrder.paymentStatus === "partial" && (
                  <button onClick={() => setPaymentAmount((selectedOrder.total - selectedOrder.amountPaid).toFixed(2))} className="mt-2 text-xs text-blue-600 hover:underline">
                    Fill remaining: {format(selectedOrder.total - selectedOrder.amountPaid)}
                  </button>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-4 text-blue-950 font-medium">
                <Package className="w-4 h-4 text-blue-600" /> Items ({selectedOrder.items.length})
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((item: any) => (
                  <div key={item.productId} className="flex items-center gap-4 glass-panel rounded-xl p-3 border-white/20">
                    <div className="w-12 h-12 glass-card rounded p-1 flex-shrink-0 bg-white/40">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" /> : <div className="w-full h-full rounded flex items-center justify-center text-[8px] text-blue-400">Img</div>}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-950 text-sm">{item.name}</p>
                      <p className="text-xs text-blue-800/70">{item.brand}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-blue-900/80">{item.quantity} × {format(item.price)}</p>
                      <p className="font-medium text-blue-950">{format(item.quantity * item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AdminLayout>
  );
}
