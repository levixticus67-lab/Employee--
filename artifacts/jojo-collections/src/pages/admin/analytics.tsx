import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { TrendingUp, ShoppingBag, DollarSign, Package } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartPoint = { date: string; revenue: number; orders: number };
type TopSelling = { productId: string; name: string; quantity: number; revenue: number };

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

export default function AdminAnalytics() {
  const [data, setData] = useState<{ revenueChart: ChartPoint[]; topSelling: TopSelling[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/analytics").then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AdminLayout><div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" /></div></AdminLayout>;
  }

  const totalRevenue = data?.revenueChart.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const totalOrders = data?.revenueChart.reduce((s, d) => s + d.orders, 0) ?? 0;

  const chartData = (data?.revenueChart ?? []).map((d) => ({
    date: d.date.slice(5),
    revenue: d.revenue,
    orders: d.orders,
  }));

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

      {/* Revenue Area Chart */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50 mb-8">
        <h2 className="text-xl font-serif text-blue-950 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" /> Daily Revenue (last 30 days)
        </h2>
        {!chartData.length ? (
          <p className="text-blue-800/60 italic text-center py-8">No revenue data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.2)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={55}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#818cf8"
                strokeWidth={1.5}
                fill="url(#ordersGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Selling */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
        <h2 className="text-xl font-serif text-blue-950 mb-6">Top Selling Products</h2>
        {!data?.topSelling.length ? (
          <p className="text-blue-800/60 italic">No sales data yet.</p>
        ) : (
          <div className="space-y-4">
            {data?.topSelling.map((item, i) => {
              const maxQty = data.topSelling[0]?.quantity ?? 1;
              return (
                <div key={item.productId} className="flex items-center gap-4">
                  <span className="w-6 text-sm font-bold text-blue-400 text-right">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-blue-950 truncate">{item.name}</span>
                      <span className="text-blue-700 font-semibold ml-2 flex-shrink-0">{item.quantity} sold · ${item.revenue.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-blue-100/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.quantity / maxQty) * 100}%`,
                          background: `linear-gradient(90deg, #3b82f6, #818cf8)`,
                        }}
                      />
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
