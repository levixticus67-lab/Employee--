import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FolderOpen, Folder, Plus, Trash2, RotateCcw, Archive, ShoppingCart, BookOpen,
  Calendar, Eye, Package, MapPin, CreditCard, Phone, Gift, CheckCircle2,
  ShieldCheck, AlertCircle, Loader2, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type StorageFolder = { id: string; name: string; description: string; isSystem: boolean; createdAt: string };
type OrderItem = { productId?: string; name: string; brand?: string; price: number; quantity: number; imageUrl?: string | null };
type StatusEntry = { status: string; timestamp: string };
type StorageItem = {
  id: string; folderId: string; type: "order_log" | "blog_post";
  referenceId: string; title: string; snapshot: Record<string, unknown>; archivedAt: string;
};

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
  online:           "Online / Card",
};

function s(snap: Record<string, unknown>, key: string): string {
  return snap[key] != null ? String(snap[key]) : "";
}
function n(snap: Record<string, unknown>, key: string): number {
  return Number(snap[key] ?? 0);
}
function b(snap: Record<string, unknown>, key: string): boolean {
  return Boolean(snap[key]);
}

function fmt(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function OrderLogDialog({ item, onClose }: { item: StorageItem; onClose: () => void }) {
  const snap = item.snapshot;
  const orderId = s(snap, "id") || item.referenceId;
  const status = s(snap, "status");
  const createdAt = s(snap, "createdAt");
  const customerName = s(snap, "customerName") || "—";
  const customerEmail = s(snap, "customerEmail") || "—";
  const buyerPhone = s(snap, "buyerPhone");
  const shippingAddress = s(snap, "shippingAddress");
  const subtotal = n(snap, "subtotal");
  const shipping = n(snap, "shipping");
  const discount = n(snap, "discount");
  const couponCode = s(snap, "couponCode");
  const total = n(snap, "total");
  const amountPaid = n(snap, "amountPaid");
  const paymentStatus = s(snap, "paymentStatus");
  const paymentMethod = s(snap, "paymentMethod");
  const paymentNumber = s(snap, "paymentNumber");
  const freeDelivery = b(snap, "freeDelivery");
  const shippingConfirmed = b(snap, "shippingConfirmed");
  const giftWrapping = b(snap, "giftWrapping");
  const giftNote = s(snap, "giftNote");
  const txRef = s(snap, "txRef");
  const pesapalTrackingId = s(snap, "pesapalTrackingId");
  const items: OrderItem[] = Array.isArray(snap["items"]) ? snap["items"] as OrderItem[] : [];
  const statusHistory: StatusEntry[] = Array.isArray(snap["statusHistory"]) ? snap["statusHistory"] as StatusEntry[] : [];

  const isPesapalVerified = paymentStatus === "paid" && (pesapalTrackingId || txRef);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl glass-panel-heavy border-white/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4 pb-4 border-b border-white/20">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <DialogTitle className="text-2xl font-serif text-blue-950">
              Order #{orderId.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className={`text-sm px-3 py-1 rounded-full border capitalize font-medium ${STATUS_COLORS[status] ?? "bg-white/10 text-slate-300 border-white/20"}`}>
                {status}
              </span>
              {status === "received" && <span title="Customer confirmed receipt" className="text-lg leading-none">📦</span>}
            </div>
          </div>
          {createdAt && (
            <p className="text-sm text-blue-800/70 mt-1">
              {new Date(createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          <p className="text-xs text-blue-500/70 mt-1 flex items-center gap-1.5">
            <Archive className="w-3 h-3" />
            Archived {new Date(item.archivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · Read-only snapshot
          </p>

          {status === "received" && (
            <div className="mt-3 bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-3 flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">📦</span>
              <div>
                <p className="text-sm font-semibold text-emerald-200">Customer confirmed they received this order!</p>
              </div>
            </div>
          )}
          {paymentStatus === "pending" && (
            <div className="mt-3 bg-blue-400/10 border border-blue-400/30 rounded-xl p-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              <p className="text-sm text-sky-200">Awaiting Pesapal payment confirmation.</p>
            </div>
          )}
          {paymentStatus === "failed" && (
            <div className="mt-3 bg-red-400/10 border border-red-400/30 rounded-xl p-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-300">Pesapal payment was not completed.</p>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Customer & Shipping */}
          <div className="glass-card rounded-xl p-4 border-white/30">
            <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
              <MapPin className="w-4 h-4 text-blue-600" /> Customer & Shipping
            </div>
            <p className="text-sm font-medium text-blue-950">{customerName}</p>
            <p className="text-sm text-blue-800/80">{customerEmail}</p>
            {buyerPhone && (
              <div className="mt-2 flex items-center gap-2.5 bg-blue-400/10 border border-blue-400/25 rounded-lg px-3 py-2">
                <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Follow-up contact</p>
                  <p className="text-sm font-semibold text-blue-900">{buyerPhone}</p>
                </div>
              </div>
            )}
            {shippingAddress && (
              <div className="mt-2 text-sm text-blue-800/80 whitespace-pre-line">{shippingAddress}</div>
            )}
          </div>

          {/* Financial Summary */}
          <div className="glass-card rounded-xl p-4 border-white/30">
            <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
              <CreditCard className="w-4 h-4 text-blue-600" /> Financial Summary
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-blue-800/80"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
                  <span>−{fmt(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-blue-800/80">
                <span>Shipping</span>
                <span>{shippingConfirmed && freeDelivery ? "Free" : fmt(shipping)}</span>
              </div>
              <div className="flex justify-between font-medium text-blue-950 pt-2 border-t border-white/20">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-800/70">Payment method</span>
                <span className="text-xs font-medium text-blue-800">{PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}</span>
              </div>
              {paymentNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-800/70">Payer number</span>
                  <span className="text-xs font-mono text-blue-800">{paymentNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-800/70">Payment status</span>
                {isPesapalVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-400/20 text-green-200 border border-green-400/30">
                    <ShieldCheck className="w-3 h-3" /> Verified · Pesapal
                  </span>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_COLORS[paymentStatus] ?? "bg-white/10 text-slate-300"}`}>
                    {paymentStatus === "partial"
                      ? `${total > 0 ? ((amountPaid / total) * 100).toFixed(0) : 0}% paid`
                      : paymentStatus}
                  </span>
                )}
              </div>
              {paymentStatus === "paid" && amountPaid > 0 && (
                <div className="flex justify-between text-xs text-blue-800/80">
                  <span>Amount paid</span>
                  <span className="text-green-700 font-medium">{fmt(amountPaid)}</span>
                </div>
              )}
              {paymentStatus === "partial" && (
                <>
                  <div className="flex justify-between text-xs text-blue-800/80">
                    <span>Amount paid</span><span className="text-green-700 font-medium">{fmt(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-blue-800/80">
                    <span>Balance</span><span className="text-amber-700 font-medium">{fmt(Math.max(0, total - amountPaid))}</span>
                  </div>
                </>
              )}
              {(pesapalTrackingId || txRef) && (
                <div className="pt-2 border-t border-white/20">
                  <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Pesapal Verification
                  </p>
                  {pesapalTrackingId && (
                    <p className="text-[10px] text-blue-800/60 font-mono break-all">Tracking ID: {pesapalTrackingId}</p>
                  )}
                  {txRef && (
                    <p className="text-[10px] text-blue-800/50 font-mono break-all">Merchant Ref: {txRef}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery status */}
        {shippingConfirmed && (
          <div className="glass-card rounded-xl p-3 border-green-200/50 bg-green-400/10 mb-6 flex items-center gap-2">
            {freeDelivery
              ? <Gift className="w-4 h-4 text-green-600 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
            <span className="text-sm text-green-800 font-medium">
              {freeDelivery ? "Free delivery was confirmed" : `Delivery fee: ${fmt(shipping)}`}
            </span>
          </div>
        )}

        {/* Gift order */}
        {giftWrapping && (
          <div className="glass-card rounded-xl p-4 border-pink-400/25 bg-pink-400/8 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5 flex-shrink-0">🎁</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-pink-800 mb-1">Gift Order — wrapped for delivery</p>
                {giftNote ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                      <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wide">Gift message from customer</span>
                    </div>
                    <p className="text-sm text-pink-200 italic leading-relaxed bg-pink-400/10 rounded-lg px-3 py-2.5 border border-pink-400/25">
                      &ldquo;{giftNote}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-pink-700/70">No personal message included.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 text-blue-950 font-medium">
            <Package className="w-4 h-4 text-blue-600" /> Items ({items.length})
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-blue-800/50 italic">Item details not captured in this snapshot.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 glass-panel rounded-xl p-3 border-white/20">
                  <div className="w-12 h-12 glass-card rounded p-1 flex-shrink-0 bg-white/40">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                      : <div className="w-full h-full rounded flex items-center justify-center text-[8px] text-blue-400">Img</div>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-950 text-sm">{item.name}</p>
                    {item.brand && <p className="text-xs text-blue-800/70">{item.brand}</p>}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-blue-900/80">{item.quantity} × {fmt(item.price)}</p>
                    <p className="font-medium text-blue-950">{fmt(item.quantity * item.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-3">Status History</p>
            <div className="space-y-2">
              {statusHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    h.status === "received" || h.status === "delivered" ? "bg-green-500"
                    : h.status === "cancelled" ? "bg-red-400"
                    : "bg-blue-400"
                  }`} />
                  <span className="capitalize text-blue-950 font-medium">{h.status}</span>
                  <span className="text-blue-800/50 text-xs">
                    {new Date(h.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 pt-4 border-t border-white/20">
          <Button onClick={onClose} className="glass-card border-white/40 text-blue-700 rounded-xl" variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminStorage() {
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewItem, setViewItem] = useState<StorageItem | null>(null);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await apiFetch("/api/admin/storage/folders");
      const data: StorageFolder[] = await res.json();
      setFolders(data);
      if (data.length > 0 && !selectedFolder) setSelectedFolder(data[0]!.id);
    } catch { toast.error("Failed to load folders"); } finally { setLoadingFolders(false); }
  }, [selectedFolder]);

  const loadItems = useCallback(async () => {
    if (!selectedFolder) return;
    setLoadingItems(true);
    try {
      const params = new URLSearchParams({ folderId: selectedFolder });
      if (search) params.set("search", search);
      const res = await apiFetch(`/api/admin/storage/items?${params}`);
      setItems(await res.json());
    } catch { toast.error("Failed to load items"); } finally { setLoadingItems(false); }
  }, [selectedFolder, search]);

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { if (selectedFolder) loadItems(); }, [selectedFolder, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/storage/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      toast.success("Folder created");
      setCreateOpen(false); setNewName(""); setNewDesc(""); loadFolders();
    } catch { toast.error("Failed to create folder"); } finally { setCreating(false); }
  };

  const handleDeleteFolder = async (folder: StorageFolder) => {
    if (!confirm(`Delete folder "${folder.name}"? All items inside will be removed.`)) return;
    try {
      const res = await apiFetch(`/api/admin/storage/folders/${folder.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      toast.success("Folder deleted");
      setSelectedFolder(null); loadFolders();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleRestore = async (item: StorageItem) => {
    try {
      const res = await apiFetch(`/api/admin/storage/items/${item.id}/restore`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      toast.success("Item restored"); loadItems();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Restore failed"); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Remove this item from storage?")) return;
    try {
      const res = await apiFetch(`/api/admin/storage/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Item removed"); loadItems();
    } catch { toast.error("Failed to remove item"); }
  };

  const filteredItems = items.filter((item) => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || item.archivedAt.slice(0, 10) === dateFilter;
    return matchSearch && matchDate;
  });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3">
            <Archive className="w-7 h-7 text-blue-600" /> Storage
          </h1>
          <p className="text-blue-900/70">Archived orders and journal posts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Folder
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: folders */}
        <div className="lg:col-span-1 space-y-2">
          {loadingFolders ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600" /></div>
          ) : folders.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-center">
              <Folder className="w-8 h-8 text-blue-200 mx-auto mb-2" />
              <p className="text-sm text-blue-800/60">No folders yet</p>
            </div>
          ) : (
            folders.map((folder) => (
              <div key={folder.id}
                className={`glass-panel rounded-2xl p-4 cursor-pointer transition-all ${selectedFolder === folder.id ? "ring-2 ring-blue-400 bg-blue-50/20" : "hover:bg-white/20"}`}
                onClick={() => setSelectedFolder(folder.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedFolder === folder.id
                      ? <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      : <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                    <span className="text-sm font-medium text-blue-950 truncate">{folder.name}</span>
                  </div>
                  {!folder.isSystem && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {folder.description && <p className="text-xs text-blue-800/50 mt-1 truncate">{folder.description}</p>}
                {folder.isSystem && <span className="text-[10px] text-blue-500/70 uppercase tracking-wide">System</span>}
              </div>
            ))
          )}
        </div>

        {/* Main: items */}
        <div className="lg:col-span-3">
          {selectedFolder ? (
            <>
              <div className="glass-panel rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text" placeholder="Search items…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <input
                    type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                    className="glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  {dateFilter && (
                    <button onClick={() => setDateFilter("")} className="text-xs text-blue-500 hover:text-blue-700 underline whitespace-nowrap">Clear</button>
                  )}
                </div>
              </div>

              {loadingItems ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="glass-panel rounded-3xl p-12 text-center">
                  <Archive className="w-10 h-10 text-blue-200 mx-auto mb-3" />
                  <p className="text-blue-800/60">{dateFilter ? `No items archived on ${dateFilter}` : "No items in this folder"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`glass-panel rounded-2xl p-4 flex items-start gap-4 transition-all ${item.type === "order_log" ? "cursor-pointer hover:bg-white/25 hover:ring-1 hover:ring-blue-200/50" : ""}`}
                      onClick={() => { if (item.type === "order_log") setViewItem(item); }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === "order_log" ? "bg-green-400/15" : "bg-blue-400/15"}`}>
                        {item.type === "order_log"
                          ? <ShoppingCart className="w-5 h-5 text-green-600" />
                          : <BookOpen className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-blue-950 truncate">{item.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === "order_log" ? "bg-green-400/15 text-green-200" : "bg-blue-400/15 text-sky-200"}`}>
                            {item.type === "order_log" ? "Order" : "Journal"}
                          </span>
                          <span className="text-xs text-blue-800/50">
                            {new Date(item.archivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          {item.type === "order_log" && item.snapshot && (
                            <span className="text-xs text-blue-800/50">
                              {String(item.snapshot["customerName"] ?? "")} · ${Number(item.snapshot["total"] ?? 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {item.type === "order_log" && (
                          <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Tap to view full order details
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {item.type === "blog_post" && (
                          <button onClick={() => handleRestore(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Restore">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <FolderOpen className="w-12 h-12 text-blue-200 mx-auto mb-4" />
              <p className="text-blue-800/60">Select a folder to view its contents</p>
            </div>
          )}
        </div>
      </div>

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-serif text-blue-950">New Storage Folder</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Folder Name</label>
              <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 2024 Orders"
                className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Description (optional)</label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="glass-card rounded-xl">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{creating ? "Creating…" : "Create Folder"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order log full detail view */}
      {viewItem && <OrderLogDialog item={viewItem} onClose={() => setViewItem(null)} />}
    </AdminLayout>
  );
}
