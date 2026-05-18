import { useRoute, Link } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, MapPin, CreditCard, Clock, Truck, PackageCheck, XCircle, Tag, Smartphone } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Order Placed", icon: Clock, color: "text-yellow-600" },
  processing: { label: "Processing", icon: Package, color: "text-blue-600" },
  shipped: { label: "Shipped", icon: Truck, color: "text-indigo-600" },
  delivered: { label: "Delivered", icon: PackageCheck, color: "text-green-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-600" },
};

const PAYMENT_LABELS: Record<string, string> = {
  online: "Online Payment",
  mtn_momo: "MTN Mobile Money",
  airtel_money: "Airtel Money",
};

export default function OrderConfirmation() {
  const [, params] = useRoute("/order/:id");
  const orderId = params?.id || "";
  const { format } = useCurrency();

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId } as any,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-blue-950">Order not found</h2>
        </div>
      </Layout>
    );
  }

  const o = order as any;
  const statusHistory: { status: string; timestamp: string }[] = o.statusHistory ?? [];
  const allStatuses = ["pending", "processing", "shipped", "delivered"];
  const currentStatusIdx = allStatuses.indexOf(o.status);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mb-10">
          <div className="w-20 h-20 bg-green-100/50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-serif text-blue-950 mb-4">Thank you for your order!</h1>
          <p className="text-lg text-blue-900/70">
            Order #{order.id.slice(0, 8).toUpperCase()} is confirmed and being processed.
          </p>
        </div>

        {/* Order Status Timeline */}
        <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 text-left mb-8">
          <h2 className="text-xl font-serif text-blue-950 mb-6">Order Status</h2>

          {o.status === "cancelled" ? (
            <div className="flex items-center gap-3 text-red-700 bg-red-50/30 rounded-xl p-4">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">This order has been cancelled.</span>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              {allStatuses.map((status, i) => {
                const cfg = STATUS_CONFIG[status]!;
                const Icon = cfg.icon;
                const done = i <= currentStatusIdx;
                const histEntry = statusHistory.find((h) => h.status === status);
                return (
                  <div key={status} className="flex-1 flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 transition-all ${
                      done ? "bg-blue-600 border-blue-600" : "bg-white/30 border-white/40"
                    }`}>
                      <Icon className={`w-5 h-5 ${done ? "text-white" : "text-blue-300"}`} />
                    </div>
                    {i < allStatuses.length - 1 && (
                      <div className={`absolute mt-5 ml-10 h-0.5 w-full max-w-[60%] transition-all ${done ? "bg-blue-500" : "bg-white/30"}`} style={{ left: "50%", top: 0 }} />
                    )}
                    <p className={`text-xs font-medium ${done ? "text-blue-950" : "text-blue-800/50"}`}>{cfg.label}</p>
                    {histEntry && (
                      <p className="text-[10px] text-blue-800/40 mt-0.5">{new Date(histEntry.timestamp).toLocaleDateString()}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 text-left mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                <Package className="w-5 h-5 text-blue-600" /> Order Info
              </div>
              <p className="text-sm text-blue-900/80 mb-1">Status: <span className="capitalize text-blue-700 font-medium">{order.status}</span></p>
              <p className="text-sm text-blue-900/80">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                <MapPin className="w-5 h-5 text-blue-600" /> Shipping
              </div>
              <p className="text-sm text-blue-900/80 mb-1">{order.customerName}</p>
              <p className="text-sm text-blue-900/80 whitespace-pre-line">{order.shippingAddress}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3 text-blue-950 font-medium">
                <CreditCard className="w-5 h-5 text-blue-600" /> Payment
              </div>
              <p className="text-sm text-blue-900/80 mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                {PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod ?? "Online"}
              </p>
              {o.paymentNumber && <p className="text-sm text-blue-900/80 mb-1">{o.paymentNumber}</p>}
              <p className="text-sm text-blue-900/80 mb-1">Subtotal: {format(order.subtotal)}</p>
              {o.discount > 0 && (
                <p className="text-sm text-green-700 mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Discount: −{format(o.discount)} {o.couponCode && `(${o.couponCode})`}
                </p>
              )}
              {(o as any).freeDelivery ? (
                  <p className="text-sm text-green-700 mb-1 font-medium flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Free delivery
                  </p>
                ) : (o as any).shippingConfirmed ? (
                  <p className="text-sm text-blue-900/80 mb-1">Delivery: {format(order.shipping)}</p>
                ) : (
                  <p className="text-sm text-orange-600/90 mb-1 italic">Delivery: Being confirmed by store</p>
                )}
              <p className="text-sm font-medium text-blue-950 border-t border-white/30 mt-1 pt-1">Total: {format(order.total)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border-white/40 text-left mb-10">
          <h3 className="font-serif text-xl text-blue-950 mb-6">Items</h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-4">
                <div className="w-16 h-16 glass-card rounded-lg p-1 flex-shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">Img</div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-md font-medium text-blue-950">{item.name}</p>
                  <p className="text-sm text-blue-800/70">Qty: {item.quantity}</p>
                </div>
                <div className="font-medium text-blue-900">
                  {format(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link href="/shop">
          <Button className="rounded-full bg-white hover:bg-blue-50 text-blue-900 border border-blue-200 px-8 shadow-sm">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </Layout>
  );
}
