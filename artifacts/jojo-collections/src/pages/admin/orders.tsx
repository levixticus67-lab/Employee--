import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package, MapPin, CreditCard, Phone, Wallet, Trash2, CheckCircle2,
  Truck, Gift, ShieldCheck, AlertCircle, Loader2, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useListAdminOrders } from "@workspace/api-client-react";
import { useCurrency } from "@/components/currency-context";

const ALL_STATUSES       = ["pending","processing","shipped","delivered","cancelled","received"];
const ADMIN_SET_STATUSES = ["pending","processing","shipped","delivered","cancelled"];
const ACTIVE_FILTER      = "active";
const FILTERS = [ACTIVE_FILTER, "all", ...ALL_STATUSES];

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-400/20 text-yellow-200 border-yellow-400/40",
  processing: "bg-blue-400/20 text-sky-200 border-blue-400/40",
  shipped:    "bg-purple-400/20 text-purple-200 border-purple-400/40",
  delivered:  "bg-green-400/20 text-green-200 border-green-400/40",
  cancelled:  "bg-red-400/20 text-red-300 border-red-400/40",
  received:   "bg-emerald-400/20 text-emerald-200 border-emerald-400/40",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid:  "bg-white/10 text-slate-300",
  partial: "bg-amber-400/20 text-amber-200",
  paid:    "bg-green-400/20 text-green-200",
  pending: "bg-blue-400/20 text-sky-200",
  failed:  "bg-red-400/20 text-red-300",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pesapal:          "Pesapal",
  mtn_momo:         "MTN MoMo",
  airtel_money:     "Airtel Money",
  cash_on_delivery: "Cash on Delivery",
  online:           "Online",
};

function PaymentBadge({ order }: { order: any }) {
  if (order.paymentStatus === "paid" && (order.pesapalTrackingId || order.txRef)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-400/20 text-green-200 border border-green-400/30">
        <ShieldCheck className="w-3 h-3" /> Verified · Pesapal
      </span>
    );
  }
  if (order.paymentStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-400/20 text-sky-200 border border-blue-400/30 animate-pulse">
        <Loader2 className="w-3 h-3 animate-spin" /> Awaiting Pesapal
      </span>
    );
  }
  if (order.paymentStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-400/20 text-red-300 border border-red-400/30">
        <AlertCircle className="w-3 h-3" /> Payment Failed
      </span>
    );
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "bg-white/10 text-slate-300"}`}>
      {order.paymentStatus === "partial"
        ? `${((order.amountPaid / order.total) * 100).toFixed(0)}% paid`
        : order.paymentStatus}
    </span>
  );
}

export default function AdminOrders() {
  const [filterMode,      setFilterMode]      = useState(ACTIVE_FILTER);
  const [selectedOrder,   setSelectedOrder]   = useState<any>(null);
  const [updatingStatus,  setUpdatingStatus]  = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [paymentAmount,   setPaymentAmount]   = useState("");
  const [recordingPayment,setRecordingPayment]= useState(false);
  const [shippingInput,   setShippingInput]   = useState("");
  const [settingShipping, setSettingShipping] = useState(false);

  const { format, symbol, convert, rates, currency } = useCurrency();
  const queryStatus    = !["active","all"].includes(filterMode) ? filterMode : undefined;
  const includeArchived = filterMode === "all";

  const { data: rawOrders, refetch, isLoading } = useListAdminOrders({
    status: queryStatus,
    ...(includeArchived ? { includeArchived: "true" } : {}),
  } as any);

  // Sync selectedOrder with fresh list data — prevents stale-cache showing wrong shippingConfirmed
  useEffect(() => {
    if (selectedOrder && rawOrders) {
      const fresh = (rawOrders as any[]).find((o: any) => o.id === selectedOrder.id);
      if (fresh) setSelectedOrder(fresh);
    }
  }, [rawOrders]);

  const orders = filterMode === ACTIVE_FILTER ? rawOrders?.filter((o: any) => !o.archived) : rawOrders;

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success("Order status updated"); refetch();
      if (selectedOrder?.id === id) setSelectedOrder((p: any) => ({ ...p, status }));
    } catch { toast.error("Failed to update status"); } finally { setUpdatingStatus(false); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Permanently delete this order? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Order deleted"); setSelectedOrder(null); refetch();
    } catch { toast.error("Failed to delete order"); } finally { setDeletingId(null); }
  };

  const handleRecordPayment = async () => {
    const displayAmount = parseFloat(paymentAmount);
    if (!displayAmount || displayAmount <= 0 || !selectedOrder) return;
    // Convert from display currency back to USD for the API
    const rate = rates[currency] ?? 1;
    const amount = displayAmount / rate;
    setRecordingPayment(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.id}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      toast.success(`Payment of ${format(amount)} recorded`);
      setSelectedOrder(updated); setPaymentAmount(""); refetch();
    } catch { toast.error("Failed to record payment"); } finally { setRecordingPayment(false); }
  };

  const handleSetShipping = async () => {
    const displayAmount = parseFloat(shippingInput);
    if (isNaN(displayAmount) || displayAmount < 0 || !selectedOrder) return;
    // Convert from display currency back to USD for the API
    const rate = rates[currency] ?? 1;
    const amount = displayAmount / rate;
    setSettingShipping(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.id}/shipping`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping: amount }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error((e as any)?.error ?? "Failed to set delivery fee"); return; }
      const updated = await res.json();
      toast.success(amount === 0 ? "Free delivery confirmed!" : `Delivery fee set to ${format(amount)}`);
      setSelectedOrder(updated); setShippingInput(""); refetch();
    } catch { toast.error("Failed to set delivery fee"); } finally { setSettingShipping(false); }
  };

  const canDelete         = (o: any) => ["cancelled","delivered","received"].includes(o?.status);
  const needsManualPayment= (o: any) => o?.paymentMethod === "cash_on_delivery" && o?.paymentStatus !== "paid";

  return (
    <AdminLayout>
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
                {["Order ID","Date","Customer","Total","Payment","Status","Action"].map((h) => (
                  <th key={h} className="px-6 py-4 text-sm font-medium text-blue-950">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : !orders?.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">No orders found.</td></tr>
              ) : orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => { setSelectedOrder(order); setPaymentAmount(""); setShippingInput(""); }}>
                  <td className="px-6 py-4 font-mono text-sm text-blue-900">{order.id.slice(0,8)}</td>
                  <td className="px-6 py-4 text-sm text-blue-800/80">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-blue-950">{order.customerName}</p>
                      {order.giftWrapping && <span title="Gift order" className="text-base leading-none">🎁</span>}
                    </div>
                    <p className="text-xs text-blue-800/70">{order.customerEmail}</p>
                    {order.buyerPhone && (
                      <p className="text-[11px] text-blue-600 font-medium mt-0.5">📞 {order.buyerPhone}</p>
                    )}
                    {order.paymentNumber && <p className="text-xs text-blue-600/70 font-mono">{order.paymentNumber}</p>}
                  </td>
                  <td className="px-6 py-4 font-medium text-blue-950">{format(order.total)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <PaymentBadge order={order} />
                      <span className="text-[10px] text-blue-800/50">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border capitalize font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>{order.status}</span>
                      {order.status === "received" && <span title="Customer confirmed receipt" className="text-base leading-none">📦</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setPaymentAmount(""); setShippingInput(""); }} className="text-sm text-blue-600 hover:text-blue-800 font-medium mr-3">View</button>
                    {canDelete(order) && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} disabled={deletingId === order.id} className="text-sm text-red-500 hover:text-red-700">
                        {deletingId === order.id ? "..." : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
                  Order #{selectedOrder.id.slice(0,8).toUpperCase()}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {canDelete(selectedOrder) && (
                    <Button onClick={() => handleDeleteOrder(selectedOrder.id)} disabled={deletingId === selectedOrder.id}
                      variant="outline" className="flex items-center gap-1.5 glass-card text-red-600 border-red-200/50 hover:bg-red-50/30 rounded-xl text-sm px-3 py-1.5 h-auto">
                      <Trash2 className="w-3.5 h-3.5" /> {deletingId === selectedOrder.id ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                  <select value={selectedOrder.status}
                    onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                    disabled={updatingStatus}
                    className={`text-sm px-3 py-1.5 rounded-full border capitalize font-medium outline-none ${STATUS_COLORS[selectedOrder.status] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
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
                    <p className="text-xs text-emerald-700/80 mt-0.5">Use the dropdown to change status to <strong>Delivered</strong>.</p>
                  </div>
                </div>
              )}
              {selectedOrder.paymentStatus === "pending" && (
                <div className="mt-3 bg-blue-50/40 border border-blue-200/60 rounded-xl p-3 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-800">Awaiting Pesapal payment confirmation.</p>
                </div>
              )}
              {selectedOrder.paymentStatus === "failed" && (
                <div className="mt-3 bg-red-50/40 border border-red-200/60 rounded-xl p-3 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">Pesapal payment was not completed.</p>
                </div>
              )}
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                  <MapPin className="w-4 h-4 text-blue-600" /> Customer & Shipping
                </div>
                <p className="text-sm font-medium text-blue-950">{selectedOrder.customerName}</p>
                <p className="text-sm text-blue-800/80">{selectedOrder.customerEmail}</p>
                {selectedOrder.buyerPhone && (
                  <div className="mt-2 flex items-center gap-2.5 bg-blue-50/50 border border-blue-200/50 rounded-lg px-3 py-2">
                    <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Follow-up contact</p>
                      <a href={"tel:" + selectedOrder.buyerPhone} className="text-sm font-semibold text-blue-900 hover:underline">{selectedOrder.buyerPhone}</a>
                    </div>
                  </div>
                )}
                <div className="mt-2 text-sm text-blue-800/80 whitespace-pre-line">{selectedOrder.shippingAddress}</div>
              </div>

              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                  <CreditCard className="w-4 h-4 text-blue-600" /> Financial Summary
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-blue-800/80"><span>Subtotal</span><span>{format(selectedOrder.subtotal)}</span></div>
                  {selectedOrder.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{format(selectedOrder.discount)}</span></div>}
                  <div className="flex justify-between text-blue-800/80"><span>Shipping</span><span>{format(selectedOrder.shipping)}</span></div>
                  <div className="flex justify-between font-medium text-blue-950 pt-2 border-t border-white/20"><span>Total</span><span>{format(selectedOrder.total)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-800/70">Payment method</span>
                    <span className="text-xs font-medium text-blue-800">{PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod] ?? selectedOrder.paymentMethod}</span>
                  </div>
                  {selectedOrder.paymentNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-800/70">Payer number</span>
                      <span className="text-xs font-mono text-blue-800">{selectedOrder.paymentNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-800/70">Payment status</span>
                    <PaymentBadge order={selectedOrder} />
                  </div>
                  {selectedOrder.paymentStatus === "paid" && (
                    <div className="flex justify-between text-xs text-blue-800/80">
                      <span>Amount paid</span><span className="text-green-700 font-medium">{format(selectedOrder.amountPaid)}</span>
                    </div>
                  )}
                  {/* Pesapal reference IDs */}
                  {(selectedOrder.pesapalTrackingId || selectedOrder.txRef) && (
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Pesapal Verification
                      </p>
                      {selectedOrder.pesapalTrackingId && (
                        <p className="text-[10px] text-blue-800/60 font-mono break-all">
                          Tracking ID: {selectedOrder.pesapalTrackingId}
                        </p>
                      )}
                      {selectedOrder.txRef && (
                        <p className="text-[10px] text-blue-800/50 font-mono break-all">
                          Merchant Ref: {selectedOrder.txRef}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* Gift order indicator */}
            {selectedOrder.giftWrapping && (
              <div className="glass-card rounded-xl p-4 border-pink-200/50 bg-pink-50/10 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5 flex-shrink-0">🎁</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-pink-800 mb-1">Gift Order — wrap beautifully before delivering</p>
                    {selectedOrder.giftNote ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                          <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wide">Gift message from customer</span>
                        </div>
                        <p className="text-sm text-pink-900 italic leading-relaxed bg-pink-50/60 rounded-lg px-3 py-2.5 border border-pink-200/50">
                          &ldquo;{selectedOrder.giftNote}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-pink-700/70">No personal message — wrap and surprise!</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Shipping fee */}
            {!selectedOrder.shippingConfirmed ? (
              <div className="glass-card rounded-xl p-4 border-orange-200/50 bg-orange-50/10 mb-6">
                <div className="flex items-center gap-2 mb-2 text-blue-950 font-medium">
                  <Truck className="w-4 h-4 text-orange-500" /> Set Delivery Fee
                </div>
                <p className="text-xs text-blue-800/70 mb-3">Review the customer's address and items, then enter the delivery cost. Enter 0 for free delivery.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-blue-700/70 mb-1">Amount in {symbol.trim() ? symbol.trim() : currency}</label>
                    <input type="number" min="0" step={currency === "UGX" ? "1" : "0.01"} value={shippingInput}
                      onChange={(e) => setShippingInput(e.target.value)} placeholder={currency === "UGX" ? "0" : "0.00"}
                      className="w-full glass-card rounded-xl px-4 py-2 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                  </div>
                  <Button onClick={handleSetShipping} disabled={settingShipping || shippingInput === ""} className="rounded-xl text-sm h-auto py-2 px-4">
                    {settingShipping ? "..." : "Confirm"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-3 border-green-200/50 bg-green-50/10 mb-6 flex items-center gap-2">
                {selectedOrder.freeDelivery ? <Gift className="w-4 h-4 text-green-600 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                <span className="text-sm text-green-800 font-medium">
                  {selectedOrder.freeDelivery ? "Free delivery confirmed" : `Delivery fee: ${format(selectedOrder.shipping)}`}
                </span>
                <button onClick={() => setSelectedOrder((p: any) => ({ ...p, shippingConfirmed: false }))} className="ml-auto text-xs text-blue-500 hover:underline">Change</button>
              </div>
            )}

            {/* Manual payment record — COD only */}
            {needsManualPayment(selectedOrder) && (
              <div className="glass-card rounded-xl p-4 border-white/30 mb-6">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                  <Wallet className="w-4 h-4 text-blue-600" /> Record Cash Payment
                </div>
                <p className="text-xs text-blue-800/60 mb-3">Record the amount collected at delivery.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-blue-700/70 mb-1">Amount received in {symbol.trim() ? symbol.trim() : currency}</label>
                    <input type="number" min="0.01" step={currency === "UGX" ? "1" : "0.01"} placeholder={currency === "UGX" ? "0" : "0.00"}
                      value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <Button onClick={handleRecordPayment} disabled={recordingPayment || !paymentAmount}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5">
                    {recordingPayment ? "..." : "Record"}
                  </Button>
                </div>
                <button onClick={() => setPaymentAmount(currency === 'UGX' ? String(Math.round(convert(selectedOrder.total))) : convert(selectedOrder.total).toFixed(2))} className="mt-2 text-xs text-blue-600 hover:underline">
                  Fill full amount: {format(selectedOrder.total)}
                </button>
              </div>
            )}

            {/* Items */}
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
