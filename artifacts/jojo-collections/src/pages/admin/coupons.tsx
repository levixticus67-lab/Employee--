import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, CalendarDays, Info, AlertTriangle } from "lucide-react";
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
  expiryDate?: string | null;
  createdAt: string;
};

const empty = { code: "", type: "percentage" as const, value: 10, minOrder: 0, maxUses: "", expiryDate: "" };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    apiFetch("/api/admin/coupons").then((r) => r.json()).then(setCoupons).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setFormError(null);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      maxUses: c.maxUses !== null ? String(c.maxUses) : "",
      expiryDate: c.expiryDate ? c.expiryDate.split("T")[0]! : "",
    });
    setOpen(true);
  };

  // Client-side validation that mirrors the server rules
  const validate = (): string | null => {
    if (!form.code.trim()) return "Coupon code is required.";
    if (!form.maxUses || Number(form.maxUses) < 1) return "Max Uses is required and must be at least 1. Unlimited coupons are not allowed for security reasons.";
    if (form.type === "percentage" && Number(form.value) > 80) return "Percentage coupons cannot exceed 80%. Use a fixed-amount coupon for larger discounts.";
    if (Number(form.value) <= 0) return "Discount value must be greater than 0.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const clientError = validate();
    if (clientError) { setFormError(clientError); return; }

    setSaving(true);
    const payload = {
      ...form,
      value: Number(form.value),
      minOrder: Number(form.minOrder),
      maxUses: Number(form.maxUses),
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
    };
    try {
      let res: Response;
      if (editing) {
        res = await apiFetch(`/api/admin/coupons/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await apiFetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as Record<string, string>)["error"] ?? "Failed to save coupon";
        setFormError(msg);
        return;
      }
      toast.success(editing ? "Coupon updated" : "Coupon created");
      setOpen(false);
      load();
    } catch { setFormError("Network error — please check your connection and try again."); } finally { setSaving(false); }
  };

  const toggleActive = async (c: Coupon) => {
    await apiFetch(`/api/admin/coupons/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    await apiFetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    toast.success("Coupon deleted");
    load();
  };

  const isExpired = (c: Coupon) => Boolean(c.expiryDate && new Date(c.expiryDate) < new Date());

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

      {/* Table — horizontally scrollable so no columns are hidden on narrow screens */}
      <div className="glass-panel-heavy rounded-3xl border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-white/20 border-b border-white/30">
              <tr>
                {["Code", "Discount", "Min Order", "Uses", "Expires", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-4 text-sm font-medium text-blue-950 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-blue-800">No coupons yet.</td></tr>
              ) : coupons.map((c) => (
                <tr key={c.id} className={`hover:bg-white/10 transition-colors ${isExpired(c) ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-mono font-bold text-blue-950 text-sm">{c.code}</span>
                      {isExpired(c) && <span className="text-xs text-red-300 font-medium bg-red-400/20 px-1.5 py-0.5 rounded whitespace-nowrap">Expired</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-900 whitespace-nowrap">
                    {c.type === "percentage" ? `${c.value}% off` : `$${c.value} off`}
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-900 whitespace-nowrap">${c.minOrder}</td>
                  <td className="px-4 py-3 text-sm text-blue-900 whitespace-nowrap">
                    {c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-900 whitespace-nowrap">
                    {c.expiryDate ? (
                      <span className={`flex items-center gap-1 ${isExpired(c) ? "text-red-600" : "text-blue-900"}`}>
                        <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                        {new Date(c.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-blue-800/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)} className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
                      {c.active
                        ? <><ToggleRight className="w-5 h-5 text-green-600" /><span className="text-green-700">Active</span></>
                        : <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-500">Inactive</span></>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => openEdit(c)} title="Edit" className="p-2 text-sky-300 hover:bg-blue-400/15 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} title="Delete" className="p-2 text-red-400 hover:bg-red-400/15 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFormError(null); }}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          </DialogHeader>

          {/* Rules info box */}
          <div className="mt-3 rounded-xl bg-blue-400/10 border border-blue-400/25 p-3 flex gap-2.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800/80 space-y-1">
              <p><span className="font-semibold">Max Uses is required</span> — unlimited coupons are not allowed. Set a realistic cap (e.g. 50 or 100).</p>
              <p><span className="font-semibold">Percentage coupons max 80%</span> — if you want a bigger discount, use a fixed-amount coupon instead.</p>
              <p><span className="font-semibold">Set an expiry date</span> — a coupon without an expiry will stay usable forever until you manually deactivate it.</p>
            </div>
          </div>

          {/* Error banner */}
          {formError && (
            <div className="mt-3 rounded-xl bg-red-400/10 border border-red-400/30 p-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                required type="text" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                placeholder="e.g. SUMMER20"
                className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Value <span className="text-blue-600 text-xs font-normal">{form.type === "percentage" ? "(max 80%)" : "(in $)"}</span>
                </label>
                <input
                  required type="number"
                  min="0.01"
                  max={form.type === "percentage" ? 80 : undefined}
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                {form.type === "percentage" && Number(form.value) > 80 && (
                  <p className="text-xs text-red-600 mt-1">Cannot exceed 80%</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Min Order ($)</label>
                <input
                  type="number" min="0" value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Max Uses <span className="text-red-500">*</span>
                </label>
                <input
                  required type="number" min="1"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <p className="text-[10px] text-blue-800/50 mt-1">Required — no unlimited coupons</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Expiry Date
                <span className="text-[10px] text-blue-700/60 font-normal">(recommended — blank means it never expires)</span>
              </label>
              <input
                type="date" value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
