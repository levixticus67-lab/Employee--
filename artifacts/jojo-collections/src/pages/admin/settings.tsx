import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Settings, MessageCircle, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type SettingsData = {
  whatsappNumber: string;
  whatsappMessage: string;
  currencyDefault: string;
  lowStockThreshold: number;
};

const defaults: SettingsData = { whatsappNumber: "", whatsappMessage: "Hi! I need help with my order.", currencyDefault: "USD", lowStockThreshold: 5 };

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; brand: string; stock: number; imageUrl: string | null }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()).then((d) => setForm({ ...defaults, ...d })),
      fetch("/api/admin/low-stock").then((r) => r.json()).then(setLowStockProducts),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); } finally { setSaving(false); }
  };

  if (loading) {
    return <AdminLayout><div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3"><Settings className="w-7 h-7 text-blue-600" /> Store Settings</h1>
        <p className="text-blue-900/70">Configure WhatsApp support, currency, and stock alerts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSave} className="space-y-6">
          {/* WhatsApp */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-600" /> WhatsApp Support</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Phone Number (with country code)</label>
                <input type="text" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} placeholder="+256700000000" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                <p className="text-xs text-blue-800/50 mt-1">Leave blank to hide the WhatsApp button</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Default Message</label>
                <textarea rows={3} value={form.whatsappMessage} onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" /> Currency</h2>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Default Currency for Storefront</label>
              <select value={form.currencyDefault} onChange={(e) => setForm({ ...form, currencyDefault: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                <option value="USD">USD — US Dollar</option>
                <option value="UGX">UGX — Ugandan Shilling</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
          </div>

          {/* Low Stock Threshold */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Low Stock Alert Threshold</h2>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Alert when stock falls below</label>
              <input type="number" min="1" max="100" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-12">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>

        {/* Low Stock Products */}
        <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
          <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" /> Low Stock Products ({lowStockProducts.length})
          </h2>
          {lowStockProducts.length === 0 ? (
            <p className="text-blue-800/60 italic text-sm">All products are well-stocked.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 glass-card rounded-xl p-3 border-white/30">
                  <div className="w-10 h-10 rounded-lg bg-white/40 flex-shrink-0 flex items-center justify-center">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain rounded-lg" /> : <Package className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-950 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-blue-800/60">{p.brand}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${p.stock === 0 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" x2="12" y1="22" y2="12" />
    </svg>
  );
}
