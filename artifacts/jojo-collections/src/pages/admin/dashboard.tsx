import { useEffect, useRef, useState } from "react";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { DollarSign, ShoppingCart, Package, AlertCircle, MessageSquare, Star, Bell, BellOff, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useStoreName } from "@/lib/use-store-name";

const STORAGE_KEY = "jojo_seen_order_ids";
const STORAGE_KEY_RECEIVED = "jojo_seen_received_ids";

function getSeenIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

type ChartPoint = { date: string; revenue: number; orders: number };
type HistoryPt = { date: string; UGX: number; EUR: number; GBP: number };
type CurrencyChartPt = { label: string; UGX: number; EUR: number; GBP: number };

const CURRENCIES = [
  { key: "UGX" as const, label: "UGX", color: "#3b82f6", grad: "dash_ugxGrad" },
  { key: "EUR" as const, label: "EUR", color: "#818cf8", grad: "dash_eurGrad" },
  { key: "GBP" as const, label: "GBP", color: "#34d399", grad: "dash_gbpGrad" },
];

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-blue-950/90 backdrop-blur-md border border-blue-400/30 rounded-xl px-4 py-3 shadow-xl text-white text-sm">
      <p className="font-medium text-blue-200 mb-1">{label}</p>
      <p className="text-white font-bold">${(payload[0]?.value ?? 0).toFixed(2)}</p>
      {payload[1] && <p className="text-blue-300 text-xs">{payload[1].value} orders</p>}
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-blue-950/90 backdrop-blur-md border border-blue-400/30 rounded-xl px-4 py-3 shadow-xl text-white text-sm min-w-[160px]">
      <p className="font-medium text-blue-200 mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-white text-xs">{p.value > 0 ? "+" : ""}{(p.value as number).toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

function FlowerCelebration({ customerName, storeName, onClose }: { customerName: string; storeName: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm text-center shadow-2xl border border-sky-400/20 !bg-transparent p-0 overflow-hidden">
        <div style={{ background: "linear-gradient(135deg, rgba(8,20,60,0.97) 0%, rgba(12,30,80,0.97) 50%, rgba(16,28,70,0.97) 100%)" }} className="py-6 px-6 space-y-4">
          <div className="text-6xl flex justify-center gap-1 flex-wrap">
            {"🌺🌸🌼🌻🌹🌷".split("").map((f, i) => (
              <span key={i} className="animate-bounce inline-block" style={{ animationDelay: `${i * 0.1}s` }}>{f}</span>
            ))}
          </div>
          <h2 className="text-2xl font-serif text-sky-50">Order Received! 🎉</h2>
          <p className="text-sky-200/80 leading-relaxed text-sm">
            <span className="font-semibold">{customerName}</span> has confirmed they received their order! 🌸<br /><br />
            Another happy customer for {storeName}. Keep up the amazing work! 💛
          </p>
          <p className="text-sm text-sky-300/70 italic">Your hard work is paying off. ✨</p>
          <button
            onClick={onClose}
            className="mt-2 px-7 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full text-sm font-medium transition-all shadow-md"
          >
            Amazing! 🌺
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useOrderNotifications() {
  const storeName = useStoreName();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const seenIds = useRef<Set<string>>(getSeenIds(STORAGE_KEY));
  const seenReceivedIds = useRef<Set<string>>(getSeenIds(STORAGE_KEY_RECEIVED));
  const initialized = useRef(false);
  const [celebrationOrder, setCelebrationOrder] = useState<{ id: string; customerName: string } | null>(null);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Order notifications enabled!");
  };

  const checkNewOrders = async () => {
    try {
      const res = await apiFetch("/api/admin/orders?includeArchived=true");
      if (!res.ok) return;
      const orders: { id: string; customerName: string; total: number; status: string }[] = await res.json();

      const pendingOrders = orders.filter((o) => o.status === "pending");
      const receivedOrders = orders.filter((o) => o.status === "received");

      if (!initialized.current) {
        pendingOrders.forEach((o) => seenIds.current.add(o.id));
        saveSeenIds(STORAGE_KEY, seenIds.current);
        receivedOrders.forEach((o) => seenReceivedIds.current.add(o.id));
        saveSeenIds(STORAGE_KEY_RECEIVED, seenReceivedIds.current);
        initialized.current = true;
        return;
      }

      // Check for new pending orders
      const newOrders = pendingOrders.filter((o) => !seenIds.current.has(o.id));
      if (newOrders.length > 0) {
        newOrders.forEach((o) => seenIds.current.add(o.id));
        saveSeenIds(STORAGE_KEY, seenIds.current);

        if (permission === "granted" && typeof Notification !== "undefined") {
          newOrders.forEach((o) => {
            const title = `New Order — ${storeName}`;
            const opts: NotificationOptions = {
              body: `${o.customerName} placed an order for ${o.total.toFixed(2)}`,
              icon: "/favicon.ico",
              tag: `order-${o.id}`,
            };
            try {
              new Notification(title, opts);
            } catch {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready
                  .then((reg) => reg.showNotification(title, opts))
                  .catch(() => {});
              }
            }
          });
        }

        newOrders.forEach((o) => {
          toast.success(`New order from ${o.customerName}!`, {
            description: `Total: $${o.total.toFixed(2)}`,
            duration: 8000,
            action: { label: "View", onClick: () => { window.location.href = "/admin/orders"; } },
          });
        });
      }

      // Check for newly received orders — trigger flower celebration
      const newReceived = receivedOrders.filter((o) => !seenReceivedIds.current.has(o.id));
      if (newReceived.length > 0) {
        newReceived.forEach((o) => seenReceivedIds.current.add(o.id));
        saveSeenIds(STORAGE_KEY_RECEIVED, seenReceivedIds.current);
        // Show flower celebration for the first new received order
        setCelebrationOrder({ id: newReceived[0]!.id, customerName: newReceived[0]!.customerName });
      }

    } catch {}
  };

  useEffect(() => {
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 30_000);
    return () => clearInterval(interval);
  }, [permission]);

  return { permission, requestPermission, celebrationOrder, clearCelebration: () => setCelebrationOrder(null) };
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard();
  const { permission, requestPermission, celebrationOrder, clearCelebration } = useOrderNotifications();

  // Analytics chart data
  const storeName = useStoreName();
  const [analyticsData, setAnalyticsData] = useState<{ revenueChart: ChartPoint[] } | null>(null);
  const [currencyHistory, setCurrencyHistory] = useState<HistoryPt[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/analytics").then((r) => r.json()).then(setAnalyticsData).catch(() => {});
    apiFetch("/api/admin/exchange-rates/history?days=7").then((r) => r.json()).then(setCurrencyHistory).catch(() => {});
  }, []);

  const revenueChartData = (analyticsData?.revenueChart ?? []).map((d) => ({
    date: d.date.slice(5),
    revenue: d.revenue,
    orders: d.orders,
  }));

  const currencyChartData: CurrencyChartPt[] = (() => {
    if (currencyHistory.length < 2) return [];
    const base = currencyHistory[0]!;
    return currencyHistory.map((pt) => ({
      label: new Date(pt.date).toLocaleString(undefined, { month: "short", day: "numeric" }),
      UGX: parseFloat((((pt.UGX - base.UGX) / base.UGX) * 100).toFixed(3)),
      EUR: parseFloat((((pt.EUR - base.EUR) / base.EUR) * 100).toFixed(3)),
      GBP: parseFloat((((pt.GBP - base.GBP) / base.GBP) * 100).toFixed(3)),
    }));
  })();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!summary) return null;

  const statCards = [
    { title: "Total Revenue", value: `$${summary.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-300", bg: "bg-green-400/15" },
    { title: "Total Orders", value: summary.ordersCount, icon: ShoppingCart, color: "text-sky-300", bg: "bg-blue-400/15" },
    { title: "Pending Orders", value: summary.pendingOrdersCount, icon: AlertCircle, color: "text-orange-300", bg: "bg-orange-400/15", pulse: summary.pendingOrdersCount > 0 },
    { title: "Total Products", value: summary.productsCount, icon: Package, color: "text-indigo-300", bg: "bg-indigo-400/15" },
    { title: "Out of Stock", value: summary.outOfStockCount, icon: AlertCircle, color: "text-red-300", bg: "bg-red-400/15" },
    { title: "Pending Reviews", value: summary.pendingReviewsCount, icon: MessageSquare, color: "text-purple-300", bg: "bg-purple-400/15" },
  ];

  return (
    <AdminLayout>
      {/* Flower celebration when customer marks order received */}
      {celebrationOrder && (
        <FlowerCelebration customerName={celebrationOrder.customerName} storeName={storeName} onClose={clearCelebration} />
      )}

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Dashboard Overview</h1>
          <p className="text-blue-900/70">Welcome back. Here's what's happening with your store today.</p>
        </div>

        <button
          onClick={permission === "granted" ? undefined : requestPermission}
          title={permission === "granted" ? "Order notifications are on" : "Enable order notifications"}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            permission === "granted"
              ? "glass-card border-green-400/40 text-green-200 bg-green-400/10 cursor-default"
              : permission === "denied"
              ? "glass-card border-red-400/30 text-red-300 bg-red-400/8 cursor-not-allowed"
              : "glass-card border-blue-400/30 text-sky-200 hover:bg-blue-400/10 cursor-pointer"
          }`}
        >
          {permission === "granted" ? (
            <><Bell className="w-4 h-4" /> Notifications on</>
          ) : permission === "denied" ? (
            <><BellOff className="w-4 h-4" /> Notifications blocked</>
          ) : (
            <><Bell className="w-4 h-4" /> Enable notifications</>
          )}
        </button>
      </div>

      {permission === "denied" && (
        <div className="mb-6 glass-card rounded-xl p-4 border-yellow-400/30 bg-yellow-400/8 flex gap-3">
          <BellOff className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-800">
            Notifications are blocked in your browser. To re-enable: click the lock icon in your browser's address bar → Notifications → Allow.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <div key={i} className={`glass-panel rounded-2xl p-6 border-white/40 flex items-center gap-4 ${(stat as any).pulse ? "ring-2 ring-orange-300/50" : ""}`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative ${stat.bg}`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
              {(stat as any).pulse && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900/70">{stat.title}</p>
              <p className="text-2xl font-serif text-blue-950">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Orders */}
        <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif text-blue-950">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View All</Link>
          </div>
          <div className="space-y-4">
            {summary.recentOrders.length === 0 ? (
              <p className="text-sm text-blue-800/60 italic">No recent orders.</p>
            ) : (
              summary.recentOrders.map(order => (
                <div key={order.id} className="glass-card rounded-xl p-4 flex justify-between items-center border-white/30">
                  <div>
                    <p className="font-medium text-blue-950">{order.customerName}</p>
                    <p className="text-xs text-blue-800/70">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-blue-900">${order.total.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                      order.status === "delivered" ? "bg-green-400/20 text-green-200" :
                      order.status === "cancelled" ? "bg-red-400/20 text-red-300" :
                      order.status === "pending" ? "bg-yellow-400/20 text-yellow-200" :
                      "bg-blue-400/20 text-sky-200"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif text-blue-950">Top Products</h2>
            <Link href="/admin/products" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Manage</Link>
          </div>
          <div className="space-y-4">
            {summary.topProducts.length === 0 ? (
              <p className="text-sm text-blue-800/60 italic">No products available.</p>
            ) : (
              summary.topProducts.map(product => (
                <div key={product.id} className="glass-card rounded-xl p-4 flex items-center gap-4 border-white/30">
                  <div className="w-12 h-12 glass-panel rounded bg-white/40 flex items-center justify-center flex-shrink-0 p-1">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[8px] text-blue-400">Img</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-950 truncate">{product.name}</p>
                    <p className="text-xs text-blue-800/70">{product.brand}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-yellow-500 text-sm">
                      <Star className="w-3 h-3 fill-current mr-1" />
                      {product.averageRating?.toFixed(1) || "N/A"}
                    </div>
                    <p className="text-xs text-blue-800/60">{product.reviewCount} reviews</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Daily Revenue Chart */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif text-blue-950 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Daily Revenue
          </h2>
          <Link href="/admin/analytics" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Full Analytics</Link>
        </div>
        {revenueChartData.length === 0 ? (
          <p className="text-blue-800/60 italic text-center py-8">No revenue data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dash_revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dash_ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.2)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={55} />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#dash_revenueGrad)" dot={false} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="orders" stroke="#818cf8" strokeWidth={1.5} fill="url(#dash_ordersGrad)" dot={false} activeDot={{ r: 4, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Currency Trends Chart */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif text-blue-950 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Currency Trends
          </h2>
          <Link href="/admin/exchange-rates" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Full Rates</Link>
        </div>
        {currencyChartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-blue-800/40">
            <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Rate history builds up over time — check back later.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-blue-800/40 mb-4">% change over last 7 days relative to start of period</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={currencyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {CURRENCIES.map(({ key, color, grad }) => (
                    <linearGradient key={key} id={grad} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v > 0 ? "+" : ""}${(v as number).toFixed(1)}%`} width={52} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(186,230,253,0.8)", paddingTop: "12px" }} />
                {CURRENCIES.map(({ key, color, grad, label }) => (
                  <Area key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} fill={`url(#${grad})`} dot={false} activeDot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
