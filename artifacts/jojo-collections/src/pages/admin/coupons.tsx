import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type Coupon = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number;
  active: boolean;
  uses: number;
  maxUses: number | null;
  createdAt: string;
};

const empty = { code: "", type: "percentage" as const, value: 10, minOrder: 0, maxUses: "" };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch("/api/admin/coupons").then((r) => r.json()).then(setCoupons).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({ code: c.code, type: c.type, value: c.value, minOrder: c.minOrder, maxUses: c.maxUses !== null ? String(c.maxUses) : "" });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, value: Number(form.value), minOrder: Number(form.minOrder), maxUses: form.maxUses ? Number(form.maxUses) : null };
    try {
      if (editing) {
        await apiFetch(`/api/admin/coupons/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Coupon updated");
      } else {
        await apiFetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Coupon created");
      }
      setOpen(false);
      load();
    } catch { toast.error("Failed to save coupon"); } finally { setSaving(false); }
  };

  const toggleActive = async (c: Coupon) => {
    await apiFetch(`/api/admin/coupons/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await apiFetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    toast.success("Coupon deleted");
    load();
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Coupons</h1>
          <p className="text-blue-900/70">Manage discount codes</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Coupon
        </Button>
      </div>

      <div className="glass-panel-heavy rounded-3xl border-white/50 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/20 border-b border-white/30">
            <tr>
              {["Code", "Discount", "Min Order", "Uses", "Status", "Actions"].map((h) => (
                <th key={h} className="px-6 py-4 text-sm font-medium text-blue-950">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">No coupons yet.</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id} className="hover:bg-white/10 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500" />
                    <span className="font-mono font-bold text-blue-950">{c.code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-blue-900">
                  {c.type === "percentage" ? `${c.value}% off` : `$${c.value} off`}
                </td>
                <td className="px-6 py-4 text-sm text-blue-900">${c.minOrder}</td>
                <td className="px-6 py-4 text-sm text-blue-900">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                <td className="px-6 py-4">
                  <button onClick={() => toggleActive(c)} className="flex items-center gap-1 text-sm font-medium">
                    {c.active
                      ? <><ToggleRight className="w-5 h-5 text-green-600" /><span className="text-green-700">Active</span></>
                      : <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-500">Inactive</span></>}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Code</label>
              <input required type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SUMMER20" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Value</label>
                <input required type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Min Order ($)</label>
                <input type="number" min="0" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Max Uses (blank = unlimited)</label>
                <input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="∞" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">{saving ? "Saving..." : editing ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
