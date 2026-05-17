import { useEffect, useRef, useState } from "react";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { DollarSign, ShoppingCart, Package, AlertCircle, MessageSquare, Star, Bell, BellOff } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "jojo_seen_order_ids";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

function useOrderNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const seenIds = useRef<Set<string>>(getSeenIds());
  const initialized = useRef(false);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Order notifications enabled!");
  };

  const checkNewOrders = async () => {
    try {
      const res = await apiFetch("/api/admin/orders");
      if (!res.ok) return;
      const orders: { id: string; customerName: string; total: number; status: string }[] = await res.json();

      const pendingOrNew = orders.filter((o) => o.status === "pending");

      if (!initialized.current) {
        // First load — mark all current orders as seen, don't notify
        pendingOrNew.forEach((o) => seenIds.current.add(o.id));
        saveSeenIds(seenIds.current);
        initialized.current = true;
        return;
      }

      const newOrders = pendingOrNew.filter((o) => !seenIds.current.has(o.id));
      if (newOrders.length === 0) return;

      newOrders.forEach((o) => seenIds.current.add(o.id));
      saveSeenIds(seenIds.current);

      if (permission === "granted" && typeof Notification !== "undefined") {
        newOrders.forEach((o) => {
          new Notification("New Order — Jojo Collections", {
            body: `${o.customerName} placed an order for $${o.total.toFixed(2)}`,
            icon: "/favicon.ico",
            tag: `order-${o.id}`,
          });
        });
      }

      // Always show in-app toast too
      newOrders.forEach((o) => {
        toast.success(`New order from ${o.customerName}!`, {
          description: `Total: $${o.total.toFixed(2)}`,
          duration: 8000,
          action: { label: "View", onClick: () => { window.location.href = "/admin/orders"; } },
        });
      });
    } catch {}
  };

  useEffect(() => {
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 30_000);
    return () => clearInterval(interval);
  }, [permission]);

  return { permission, requestPermission };
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard();
  const { permission, requestPermission } = useOrderNotifications();

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
    { title: "Total Revenue", value: `$${summary.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-100/50" },
    { title: "Total Orders", value: summary.ordersCount, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100/50" },
    { title: "Pending Orders", value: summary.pendingOrdersCount, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-100/50", pulse: summary.pendingOrdersCount > 0 },
    { title: "Total Products", value: summary.productsCount, icon: Package, color: "text-indigo-600", bg: "bg-indigo-100/50" },
    { title: "Out of Stock", value: summary.outOfStockCount, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100/50" },
    { title: "Pending Reviews", value: summary.pendingReviewsCount, icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-100/50" },
  ];

  return (
    <AdminLayout>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Dashboard Overview</h1>
          <p className="text-blue-900/70">Welcome back. Here's what's happening with your store today.</p>
        </div>

        {/* Notification toggle */}
        <button
          onClick={permission === "granted" ? undefined : requestPermission}
          title={permission === "granted" ? "Order notifications are on" : "Enable order notifications"}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            permission === "granted"
              ? "glass-card border-green-200/60 text-green-800 bg-green-50/30 cursor-default"
              : permission === "denied"
              ? "glass-card border-red-200/50 text-red-700 bg-red-50/20 cursor-not-allowed"
              : "glass-card border-blue-200/50 text-blue-700 hover:bg-blue-50/30 cursor-pointer"
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
        <div className="mb-6 glass-card rounded-xl p-4 border-yellow-200/50 bg-yellow-50/20 flex gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                      order.status === "delivered" ? "bg-green-100 text-green-800" :
                      order.status === "cancelled" ? "bg-red-100 text-red-800" :
                      order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-blue-100 text-blue-800"
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
    </AdminLayout>
  );
}
