import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminOrders, useUpdateOrderStatus, OrderStatus } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, MapPin, CreditCard } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders, refetch, isLoading } = useListAdminOrders({
    status: filterStatus !== "all" ? filterStatus : undefined
  });
  
  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = (id: string, status: any) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast.success("Order status updated");
        refetch();
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder({ ...selectedOrder, status });
        }
      },
      onError: () => toast.error("Failed to update status")
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Orders</h1>
          <p className="text-blue-900/70">Manage customer orders and fulfillment</p>
        </div>
        
        <div className="flex bg-white/20 backdrop-blur-md rounded-lg p-1 border border-white/30">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                filterStatus === s ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-800/70 hover:text-blue-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel-heavy rounded-3xl border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/20 border-b border-white/30">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Order ID</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Date</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Customer</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Total</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : orders?.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">No orders found.</td></tr>
              ) : (
                orders?.map(order => (
                  <tr key={order.id} className="hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="px-6 py-4 font-mono text-sm text-blue-900">{order.id.slice(0,8)}</td>
                    <td className="px-6 py-4 text-sm text-blue-800/80">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-blue-950">{order.customerName}</p>
                      <p className="text-xs text-blue-800/70">{order.customerEmail}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-blue-950">${order.total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border capitalize font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-3xl glass-panel-heavy border-white/50 shadow-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-4 pb-4 border-b border-white/20">
              <div className="flex justify-between items-center">
                <DialogTitle className="text-2xl font-serif text-blue-950">
                  Order #{selectedOrder.id.slice(0,8)}
                </DialogTitle>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                  className={`text-sm px-3 py-1.5 rounded-full border capitalize font-medium outline-none ${getStatusColor(selectedOrder.status)}`}
                >
                  {Object.values(OrderStatus).map(status => (
                    <option key={status} value={status} className="bg-white text-gray-900">{status}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-blue-800/70 mt-1">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                  <MapPin className="w-4 h-4 text-blue-600" /> Customer & Shipping
                </div>
                <p className="text-sm font-medium text-blue-950">{selectedOrder.customerName}</p>
                <p className="text-sm text-blue-800/80">{selectedOrder.customerEmail}</p>
                <div className="mt-2 text-sm text-blue-800/80 whitespace-pre-line">
                  {selectedOrder.shippingAddress}
                </div>
              </div>

              <div className="glass-card rounded-xl p-4 border-white/30">
                <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                  <CreditCard className="w-4 h-4 text-blue-600" /> Financial Summary
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-blue-800/80">
                    <span>Subtotal</span>
                    <span>${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-800/80">
                    <span>Shipping</span>
                    <span>${selectedOrder.shipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-blue-950 pt-2 border-t border-white/20">
                    <span>Total</span>
                    <span>${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4 text-blue-950 font-medium">
                <Package className="w-4 h-4 text-blue-600" /> Order Items ({selectedOrder.items.length})
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((item: any) => (
                  <div key={item.productId} className="flex items-center gap-4 glass-panel rounded-xl p-3 border-white/20">
                    <div className="w-12 h-12 glass-card rounded p-1 flex-shrink-0 bg-white/40">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full rounded flex items-center justify-center text-[8px] text-blue-400">Img</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-950 text-sm">{item.name}</p>
                      <p className="text-xs text-blue-800/70">{item.brand}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-blue-900/80">{item.quantity} × ${item.price.toFixed(2)}</p>
                      <p className="font-medium text-blue-950">${(item.quantity * item.price).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AdminLayout>
  );
}
