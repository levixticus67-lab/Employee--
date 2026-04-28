import { useGetAdminDashboard } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { DollarSign, ShoppingCart, Package, AlertCircle, MessageSquare, Star } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard();

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
    { title: "Pending Orders", value: summary.pendingOrdersCount, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-100/50" },
    { title: "Total Products", value: summary.productsCount, icon: Package, color: "text-indigo-600", bg: "bg-indigo-100/50" },
    { title: "Out of Stock", value: summary.outOfStockCount, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100/50" },
    { title: "Pending Reviews", value: summary.pendingReviewsCount, icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-100/50" },
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-blue-950 mb-2">Dashboard Overview</h1>
        <p className="text-blue-900/70">Welcome back. Here's what's happening with your store today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 border-white/40 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
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
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
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
