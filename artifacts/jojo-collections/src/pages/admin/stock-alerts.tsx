import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Trash2, Phone, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Alert = {
  id: string;
  phone: string;
  productId: string;
  productName: string;
  createdAt: { _seconds: number } | string;
};

type Grouped = {
  productId: string;
  productName: string;
  alerts: Alert[];
};

function formatDate(createdAt: Alert["createdAt"]): string {
  try {
    const ts =
      typeof createdAt === "string"
        ? new Date(createdAt)
        : new Date((createdAt as { _seconds: number })._seconds * 1000);
    return ts.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function buildWaLink(phone: string, productName: string): string {
  const clean = phone.replace(/\s+/g, "");
  const message = encodeURIComponent(
    `Hi! Great news — ${productName} is back in stock at LENZ Fragrances! Shop now: https://lenz-fragrances.web.app`
  );
  return `https://wa.me/${clean.replace(/^\+/, "")}?text=${message}`;
}

export default function AdminStockAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/stock-alerts");
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load stock alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (id: string) => {
    setDismissing((prev) => new Set(prev).add(id));
    try {
      await apiFetch(`/api/admin/stock-alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Alert dismissed");
    } catch {
      toast.error("Failed to dismiss alert");
    } finally {
      setDismissing((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const dismissAll = async (productId: string) => {
    const toRemove = alerts.filter((a) => a.productId === productId);
    await Promise.all(toRemove.map((a) => dismiss(a.id)));
  };

  const grouped: Grouped[] = Object.values(
    alerts.reduce<Record<string, Grouped>>((acc, a) => {
      if (!acc[a.productId]) acc[a.productId] = { productId: a.productId, productName: a.productName, alerts: [] };
      acc[a.productId]!.alerts.push(a);
      return acc;
    }, {})
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif text-sky-50">Stock Alerts</h1>
            <p className="text-sm text-sky-300/50 mt-1">
              Customers waiting to be notified when products are back in stock.
              Tap a WhatsApp button to message them, then dismiss when done.
            </p>
          </div>
          <Button variant="outline" onClick={load} className="gap-2 border-white/20 text-sky-200">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/10">
            <Package className="w-10 h-10 text-sky-400/30 mx-auto mb-3" />
            <p className="text-sky-300/50 text-lg font-serif">No pending stock alerts</p>
            <p className="text-sky-400/40 text-sm mt-1">Customers will appear here when they sign up for restock notifications.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.productId} className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                {/* Product header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/4">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="font-serif text-sky-50 font-medium">{group.productName}</p>
                      <p className="text-xs text-sky-300/45">{group.alerts.length} customer{group.alerts.length !== 1 ? "s" : ""} waiting</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAll(group.productId)}
                    className="text-xs text-sky-400/50 hover:text-red-400 transition-colors"
                  >
                    Dismiss all
                  </button>
                </div>

                {/* Alert rows */}
                <div className="divide-y divide-white/6">
                  {group.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/4 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Phone className="w-4 h-4 text-sky-400/50 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-sky-100 font-mono">{alert.phone}</p>
                          <p className="text-xs text-sky-300/40">{formatDate(alert.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={buildWaLink(alert.phone, alert.productName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                        <button
                          onClick={() => dismiss(alert.id)}
                          disabled={dismissing.has(alert.id)}
                          className="p-1.5 rounded-full text-sky-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Dismiss alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
