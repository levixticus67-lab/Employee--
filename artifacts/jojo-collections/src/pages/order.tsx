import { useRoute, Link } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, MapPin, CreditCard } from "lucide-react";

export default function OrderConfirmation() {
  const [, params] = useRoute("/order/:id");
  const orderId = params?.id || "";

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId } as any
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="mb-10">
          <div className="w-20 h-20 bg-green-100/50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-serif text-blue-950 mb-4">Thank you for your order!</h1>
          <p className="text-lg text-blue-900/70">
            Order #{order.id.slice(0,8)} is confirmed and being processed.
          </p>
        </div>

        <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 text-left mb-10">
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
              <p className="text-sm text-blue-900/80 mb-1">Subtotal: ${order.subtotal.toFixed(2)}</p>
              <p className="text-sm text-blue-900/80 mb-1">Shipping: ${order.shipping.toFixed(2)}</p>
              <p className="text-sm font-medium text-blue-950 border-t border-white/30 mt-1 pt-1">Total: ${order.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border-white/40 text-left mb-10">
          <h3 className="font-serif text-xl text-blue-950 mb-6">Items</h3>
          <div className="space-y-4">
            {order.items.map(item => (
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
                  ${(item.price * item.quantity).toFixed(2)}
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
