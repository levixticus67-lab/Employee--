import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FolderOpen, Folder, Plus, Trash2, RotateCcw, Archive, ShoppingCart, BookOpen, Calendar, Eye, Package, CreditCard, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type StorageFolder = { id: string; name: string; description: string; isSystem: boolean; createdAt: string };
type StorageItem = {
  id: string; folderId: string; type: "order_log" | "blog_post";
  referenceId: string; title: string; snapshot: Record<string, unknown>; archivedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-700 bg-yellow-100",
  processing: "text-blue-700 bg-blue-100",
  shipped: "text-indigo-700 bg-indigo-100",
  delivered: "text-green-700 bg-green-100",
  cancelled: "text-red-700 bg-red-100",
  received: "text-emerald-700 bg-emerald-100",
};
const PAYMENT_LABELS: Record<string, string> = { online: "Credit/Debit Card", mtn_momo: "MTN Mobile Money", airtel_money: "Airtel Money" };

function OrderLogDialog({ item, onClose }: { item: StorageItem; onClose: () => void }) {
  const snap = item.snapshot;
  const status = String(snap["status"] ?? "unknown");
  const total = Number(snap["total"] ?? 0);
  const subtotal = Number(snap["subtotal"] ?? 0);
  const shipping = Number(snap["shipping"] ?? 0);
  const discount = Number(snap["discount"] ?? 0);
  const amountPaid = Number(snap["amountPaid"] ?? 0);
  const paymentStatus = String(snap["paymentStatus"] ?? "");
  const paymentMethod = String(snap["paymentMethod"] ?? "online");
  const paymentNumber = snap["paymentNumber"] ? String(snap["paymentNumber"]) : null;
  const couponCode = snap["couponCode"] ? String(snap["couponCode"]) : null;
  const customerName = String(snap["customerName"] ?? "—");
  const customerEmail = String(snap["customerEmail"] ?? "—");
  const buyerPhone = snap["buyerPhone"] ? String(snap["buyerPhone"]) : null;
  const shippingAddress = snap["shippingAddress"] ? String(snap["shippingAddress"]) : null;
  const createdAt = snap["createdAt"] ? String(snap["createdAt"]) : null;
  const giftWrapping = Boolean(snap["giftWrapping"]);
  const giftNote = snap["giftNote"] ? String(snap["giftNote"]) : null;
  const items = Array.isArray(snap["items"]) ? snap["items"] as { name: string; brand?: string; quantity: number; price: number; imageUrl?: string }[] : [];
  const statusHistory = Array.isArray(snap["statusHistory"]) ? snap["statusHistory"] as { status: string; timestamp: string }[] : [];

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl glass-panel-heavy border-white/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif text-blue-950 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Order Log — #{item.referenceId.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <p className="text-xs text-blue-800/50 mt-1">Archived {new Date(item.archivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · Read-only snapshot</p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Status badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[status] ?? "text-gray-700 bg-gray-100"}`}>
              {status}
            </span>
            {paymentStatus && (
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${paymentStatus === "paid" ? "bg-green-100 text-green-800" : paymentStatus === "partial" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                {paymentStatus === "paid" ? "Fully paid" : paymentStatus === "partial" ? "Partial payment" : "Unpaid"}
              </span>
            )}
            {giftWrapping && <span className="text-sm px-3 py-1 rounded-full font-medium bg-pink-100 text-pink-800">🎁 Gift Wrapped</span>}
          </div>

          {/* Customer */}
          <div className="glass-card rounded-xl p-4 border-white/30 space-y-1.5">
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Customer</p>
            <p className="text-sm font-semibold text-blue-950">{customerName}</p>
            <p className="text-sm text-blue-800/70">{customerEmail}</p>
            {buyerPhone && <p className="text-sm text-blue-800/70">📞 {buyerPhone}</p>}
            {shippingAddress && <p className="text-sm text-blue-800/70">📍 {shippingAddress}</p>}
            {createdAt && <p className="text-xs text-blue-800/40 mt-1">Placed {new Date(createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-3">Items Ordered</p>
              <div className="space-y-2.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 glass-card rounded-lg bg-white/40 flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" /> : <Package className="w-4 h-4 text-blue-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-950 truncate">{item.name}</p>
                      {item.brand && <p className="text-xs text-blue-800/60">{item.brand}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-blue-900">{fmt(item.price * item.quantity)}</p>
                      <p className="text-xs text-blue-800/50">× {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="glass-card rounded-xl p-4 border-white/30 space-y-1.5 text-sm">
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Order Totals</p>
            <div className="flex justify-between text-blue-900/70"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{couponCode ? ` (${couponCode})` : ""}</span><span>−{fmt(discount)}</span></div>}
            <div className="flex justify-between text-blue-900/70"><span>Shipping</span><span>{shipping === 0 ? "Free" : fmt(shipping)}</span></div>
            <div className="flex justify-between font-semibold text-blue-950 pt-1.5 border-t border-white/20"><span>Total</span><span>{fmt(total)}</span></div>
            {paymentStatus === "partial" && (
              <>
                <div className="flex justify-between text-green-700 text-xs"><span>Amount paid</span><span>{fmt(amountPaid)}</span></div>
                <div className="flex justify-between text-amber-700 text-xs"><span>Balance on delivery</span><span>{fmt(Math.max(0, total - amountPaid))}</span></div>
              </>
            )}
          </div>

          {/* Payment */}
          <div className="glass-card rounded-xl p-4 border-white/30">
            <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Payment</p>
            <div className="flex items-center gap-2 text-sm text-blue-900">
              {paymentMethod === "online" ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              <span>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</span>
              {paymentNumber && <span className="text-blue-800/50">· {paymentNumber}</span>}
            </div>
          </div>

          {/* Gift note */}
          {giftWrapping && giftNote && (
            <div className="glass-card rounded-xl p-4 border-pink-200/40 bg-pink-50/20">
              <p className="text-xs font-medium text-pink-800/60 uppercase tracking-wider mb-2">Gift Message</p>
              <p className="text-sm text-pink-950 italic">"{giftNote}"</p>
            </div>
          )}

          {/* Status history */}
          {statusHistory.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider mb-2">Status History</p>
              <div className="space-y-1.5">
                {statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === "received" || h.status === "delivered" ? "bg-green-500" : h.status === "cancelled" ? "bg-red-400" : "bg-blue-400"}`} />
                    <span className="capitalize text-blue-950 font-medium">{h.status}</span>
                    <span className="text-blue-800/50 text-xs">{new Date(h.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
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
      toast.success("Item restored");
      loadItems();
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

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3"><Archive className="w-7 h-7 text-blue-600" /> Storage</h1>
          <p className="text-blue-900/70">Archived orders and journal posts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Folder</Button>
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
                    {selectedFolder === folder.id ? <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />}
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
              {/* Filters */}
              <div className="glass-panel rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
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
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === "order_log" ? "bg-green-100" : "bg-blue-100"}`}>
                        {item.type === "order_log" ? <ShoppingCart className="w-5 h-5 text-green-600" /> : <BookOpen className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-blue-950 truncate">{item.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === "order_log" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                            {item.type === "order_log" ? "Order" : "Journal"}
                          </span>
                          <span className="text-xs text-blue-800/50">{new Date(item.archivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          {item.type === "order_log" && item.snapshot && (
                            <span className="text-xs text-blue-800/50">
                              {String(item.snapshot["customerName"] ?? "")} · ${Number(item.snapshot["total"] ?? 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {item.type === "order_log" && (
                          <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Tap to view order details</p>
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
              <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 2024 Orders" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Description (optional)</label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="glass-card rounded-xl">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{creating ? "Creating…" : "Create Folder"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order log detail view */}
      {viewItem && <OrderLogDialog item={viewItem} onClose={() => setViewItem(null)} />}
    </AdminLayout>
  );
}
