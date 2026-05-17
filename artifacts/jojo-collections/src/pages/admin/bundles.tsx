import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

type Bundle = { id: string; name: string; description: string; productIds: string[]; price: number; imageUrl: string | null; active: boolean; createdAt: string };
const empty = { name: "", description: "", productIds: [] as string[], price: 0, imageUrl: "", active: true };

export default function AdminBundles() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { data: products } = useListProducts();

  const load = () => {
    fetch("/api/admin/bundles").then((r) => r.json()).then(setBundles).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (b: Bundle) => { setEditing(b); setForm({ name: b.name, description: b.description, productIds: b.productIds, price: b.price, imageUrl: b.imageUrl ?? "", active: b.active }); setOpen(true); };

  const toggleProduct = (id: string) => {
    setForm((prev) => ({ ...prev, productIds: prev.productIds.includes(id) ? prev.productIds.filter((x) => x !== id) : [...prev.productIds, id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, imageUrl: form.imageUrl || null };
    try {
      if (editing) {
        await fetch(`/api/admin/bundles/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Bundle updated");
      } else {
        await fetch("/api/admin/bundles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Bundle created");
      }
      setOpen(false); load();
    } catch { toast.error("Failed to save bundle"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    await fetch(`/api/admin/bundles/${id}`, { method: "DELETE" });
    toast.success("Bundle deleted"); load();
  };

  const toggleActive = async (b: Bundle) => {
    await fetch(`/api/admin/bundles/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !b.active }) });
    load();
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Bundles & Gift Sets</h1>
          <p className="text-blue-900/70">Curate product bundles at special prices</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Bundle</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
      ) : bundles.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center"><Package className="w-12 h-12 text-blue-200 mx-auto mb-4" /><p className="text-blue-800/60">No bundles yet. Create your first one.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bundles.map((b) => (
            <div key={b.id} className="glass-panel rounded-2xl p-5 flex gap-4 items-start">
              <div className="w-16 h-16 rounded-lg glass-card flex items-center justify-center flex-shrink-0">
                {b.imageUrl ? <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-6 h-6 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-serif text-lg text-blue-950 truncate">{b.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{b.active ? "Active" : "Inactive"}</span>
                </div>
                <p className="text-sm text-blue-800/60 truncate mb-1">{b.description}</p>
                <p className="text-sm font-medium text-blue-900">${b.price.toFixed(2)} · {b.productIds.length} items</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-xs">{b.active ? "Deactivate" : "Activate"}</button>
                <button onClick={() => openEdit(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Bundle" : "New Bundle"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Bundle Name</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Bundle Price ($)</label>
                <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Description</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Image URL (optional)</label>
              <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-2">Select Products ({form.productIds.length} selected)</label>
              <div className="max-h-48 overflow-y-auto space-y-1 glass-card rounded-lg p-3 border-white/40">
                {products?.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/20 rounded px-2 py-1.5">
                    <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="w-4 h-4 text-blue-600 rounded" />
                    {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-6 h-6 object-contain rounded" />}
                    <span className="text-sm text-blue-950 flex-1">{p.name} — {p.brand}</span>
                    <span className="text-xs text-blue-800/60">${p.price}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={saving || form.productIds.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">{saving ? "Saving..." : editing ? "Save Changes" : "Create Bundle"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
