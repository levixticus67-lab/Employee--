import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { TrendingUp, ShoppingBag, DollarSign, Package } from "lucide-react";

type ChartPoint = { date: string; revenue: number; orders: number };
type TopSelling = { productId: string; name: string; quantity: number; revenue: number };

export default function AdminAnalytics() {
  const [data, setData] = useState<{ revenueChart: ChartPoint[]; topSelling: TopSelling[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AdminLayout><div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" /></div></AdminLayout>;
  }

  const totalRevenue = data?.revenueChart.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const totalOrders = data?.revenueChart.reduce((s, d) => s + d.orders, 0) ?? 0;
  const maxRevenue = Math.max(...(data?.revenueChart.map((d) => d.revenue) ?? [1]));

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-blue-950 mb-2">Analytics</h1>
        <p className="text-blue-900/70">Revenue and sales performance over the last 30 days</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {[
          { label: "Total Revenue (30d)", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-100/50" },
          { label: "Total Orders (30d)", value: totalOrders, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-100/50" },
          { label: "Top Selling Products", value: data?.topSelling.length ?? 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-100/50" },
        ].map((s, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 border-white/40 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${s.bg}`}>
              <s.icon className={`w-7 h-7 ${s.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900/70">{s.label}</p>
              <p className="text-2xl font-serif text-blue-950">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50 mb-8">
        <h2 className="text-xl font-serif text-blue-950 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" /> Daily Revenue (last 30 days)
        </h2>
        {!data?.revenueChart.length ? (
          <p className="text-blue-800/60 italic text-center py-8">No revenue data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-48 min-w-full" style={{ minWidth: `${(data?.revenueChart.length ?? 0) * 28}px` }}>
              {data?.revenueChart.map((point) => (
                <div key={point.date} className="flex flex-col items-center gap-1 flex-1 min-w-[24px]" title={`${point.date}: $${point.revenue.toFixed(2)} (${point.orders} orders)`}>
                  <div
                    className="w-full bg-blue-500/70 hover:bg-blue-600 rounded-t transition-colors cursor-pointer"
                    style={{ height: `${maxRevenue > 0 ? Math.max(4, (point.revenue / maxRevenue) * 160) : 4}px` }}
                  />
                  <span className="text-[9px] text-blue-800/50 rotate-45 origin-left whitespace-nowrap" style={{ fontSize: "9px" }}>
                    {point.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Selling */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
        <h2 className="text-xl font-serif text-blue-950 mb-6">Top Selling Products</h2>
        {!data?.topSelling.length ? (
          <p className="text-blue-800/60 italic">No sales data yet.</p>
        ) : (
          <div className="space-y-3">
            {data?.topSelling.map((item, i) => {
              const maxQty = data.topSelling[0]?.quantity ?? 1;
              return (
                <div key={item.productId} className="flex items-center gap-4">
                  <span className="w-6 text-sm font-medium text-blue-900/50 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-blue-950 truncate">{item.name}</span>
                      <span className="text-blue-800/70 ml-2 flex-shrink-0">{item.quantity} sold · ${item.revenue.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(item.quantity / maxQty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
