import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Settings, MessageCircle, DollarSign, AlertTriangle, Smartphone, Info } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type SettingsData = {
  whatsappNumber: string;
  whatsappMessage: string;
  currencyDefault: string;
  lowStockThreshold: number;
  mtnNumber: string;
  airtelNumber: string;
};

const defaults: SettingsData = {
  whatsappNumber: "",
  whatsappMessage: "Hi! I need help with my order.",
  currencyDefault: "USD",
  lowStockThreshold: 5,
  mtnNumber: "",
  airtelNumber: "",
};

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; brand: string; stock: number; imageUrl: string | null }[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/admin/settings")
        .then((r) => r.json())
        .then((d) => setForm({ ...defaults, ...d }))
        .catch(() => {}),
      apiFetch("/api/admin/low-stock")
        .then((r) => r.json())
        .then(setLowStockProducts)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        toast.error("Could not save settings. Please try again.");
      } else {
        toast.success("Settings saved!");
      }
    } catch {
      toast.error("Network error — please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-600" /> Store Settings
        </h1>
        <p className="text-blue-900/70">WhatsApp, payments, currency, and stock alerts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSave} className="space-y-6">

          {/* WhatsApp */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" /> WhatsApp Support Button
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Your WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
                  value={form.whatsappNumber}
                  onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                  placeholder="+256700000000"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <p className="text-xs text-blue-800/50 mt-1">
                  Save this number and a green WhatsApp button will appear on the storefront so customers can contact you.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Default Greeting Message</label>
                <textarea
                  rows={2}
                  value={form.whatsappMessage}
                  onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })}
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Mobile Money */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-1 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-yellow-600" /> Mobile Money — Your Business Numbers
            </h2>
            <div className="flex gap-2 mb-4 glass-card rounded-xl p-3 border-blue-100/50 bg-blue-50/20">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800/70 space-y-1">
                <p className="font-semibold">How it works:</p>
                <ol className="list-decimal ml-3 space-y-0.5">
                  <li>Customer picks MTN or Airtel at checkout</li>
                  <li>Your number shows on their screen so they know where to send money</li>
                  <li>Customer sends the exact amount to your MoMo number</li>
                  <li>You get an SMS when money arrives on your phone</li>
                  <li>Go to <strong>Orders</strong> → change status to <strong>Processing</strong> to confirm</li>
                </ol>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Your MTN Mobile Money Number
                </label>
                <input
                  type="text"
                  value={form.mtnNumber}
                  onChange={(e) => setForm({ ...form, mtnNumber: e.target.value })}
                  placeholder="+256 77X XXX XXX"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Your Airtel Money Number
                </label>
                <input
                  type="text"
                  value={form.airtelNumber}
                  onChange={(e) => setForm({ ...form, airtelNumber: e.target.value })}
                  placeholder="+256 75X XXX XXX"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" /> Default Currency
            </h2>
            <select
              value={form.currencyDefault}
              onChange={(e) => setForm({ ...form, currencyDefault: e.target.value })}
              className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>

          {/* Low Stock */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Low Stock Alert
            </h2>
            <label className="block text-sm font-medium text-blue-900/80 mb-1">Alert when stock falls below</label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-12">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>

        {/* Low Stock Panel */}
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
                  <div className="w-10 h-10 rounded-lg bg-white/40 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-[10px] text-blue-400">Img</span>
                    )}
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
