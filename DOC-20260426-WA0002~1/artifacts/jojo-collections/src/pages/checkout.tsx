import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCreateOrder, useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const { data: session } = useGetCurrentUser();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    shippingAddress: "",
  });

  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || session.user!.name,
        customerEmail: prev.customerEmail || session.user!.email,
      }));
    }
  }, [session?.user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const orderItems = items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    createOrder.mutate(
      {
        data: {
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          shippingAddress: form.shippingAddress,
          items: orderItems,
        },
      },
      {
        onSuccess: (order) => {
          clearCart();
          toast.success("Order placed successfully!");
          setLocation(`/order/${order.id}`);
        },
        onError: () => {
          toast.error("Failed to place order. Please try again.");
        },
      },
    );
  };

  if (items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const shipping = subtotal > 100 ? 0 : 15;
  const total = subtotal + shipping;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form */}
          <div className="glass-panel-heavy rounded-3xl p-8 border-white/50">
            <h2 className="text-2xl font-serif text-blue-950 mb-6">Shipping Details</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                  className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Shipping Address</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Street, building, apt, city, postal code, country"
                  value={form.shippingAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingAddress: e.target.value }))}
                  className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={createOrder.isPending}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md mt-4"
              >
                {createOrder.isPending ? "Processing..." : `Place Order • $${total.toFixed(2)}`}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <div className="glass-panel rounded-3xl p-8 border-white/40 sticky top-24">
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 glass-card rounded-lg p-1 flex-shrink-0">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">Img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-950 truncate">{item.product.name}</p>
                      <p className="text-xs text-blue-800/70">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-blue-900">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/30 pt-4 space-y-3">
                <div className="flex justify-between text-sm text-blue-900/80">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-900/80">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <span className="font-medium text-blue-950">Total</span>
                  <span className="text-2xl font-serif text-blue-950">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
