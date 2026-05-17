import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCreateOrder, useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tag, CheckCircle, Smartphone, CreditCard, Clock, Copy, Info } from "lucide-react";

type CouponResult = { id: string; code: string; type: string; value: number; discount: number };

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const { data: session } = useGetCurrentUser();
  const { format } = useCurrency();

  const [form, setForm] = useState({ customerName: "", customerEmail: "", shippingAddress: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"mtn_momo" | "airtel_money" | "online">("mtn_momo");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [businessNumbers, setBusinessNumbers] = useState({ mtnNumber: "", airtelNumber: "" });

  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({ ...prev, customerName: prev.customerName || session.user!.name, customerEmail: prev.customerEmail || session.user!.email }));
    }
  }, [session?.user]);

  useEffect(() => {
    fetch("/api/settings/public").then((r) => r.json()).then((d) => {
      setBusinessNumbers({ mtnNumber: d.mtnNumber ?? "", airtelNumber: d.airtelNumber ?? "" });
    }).catch(() => {});
  }, []);

  const discount = couponResult?.discount ?? 0;
  const shipping = (subtotal - discount) > 100 ? 0 : 15;
  const total = Math.max(0, subtotal - discount + shipping);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true); setCouponError(""); setCouponResult(null);
    try {
      const res = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponCode, orderTotal: subtotal }) });
      const data = await res.json();
      if (!res.ok) setCouponError(data.error || "Invalid coupon");
      else { setCouponResult(data); toast.success(`Coupon applied! You save ${format(data.discount)}`); }
    } catch { setCouponError("Could not validate coupon"); } finally { setValidatingCoupon(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    createOrder.mutate(
      { data: { customerName: form.customerName, customerEmail: form.customerEmail, shippingAddress: form.shippingAddress, items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })), couponCode: couponResult?.code, paymentMethod, paymentNumber: paymentMethod !== "online" ? paymentNumber : undefined } as any },
      {
        onSuccess: (order) => { clearCart(); toast.success("Order placed!"); setLocation(`/order/${order.id}`); },
        onError: () => toast.error("Failed to place order. Please try again."),
      }
    );
  };

  if (items.length === 0) { setLocation("/cart"); return null; }

  const businessNum = paymentMethod === "mtn_momo" ? businessNumbers.mtnNumber : businessNumbers.airtelNumber;

  const paymentOptions = [
    { value: "mtn_momo" as const, label: "MTN Mobile Money", icon: Smartphone, comingSoon: false },
    { value: "airtel_money" as const, label: "Airtel Money", icon: Smartphone, comingSoon: false },
    { value: "online" as const, label: "Pay Online (Credit/Debit Card)", icon: CreditCard, comingSoon: true },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 space-y-8">

            {/* Shipping */}
            <div>
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Shipping Details</h2>
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Full Name</label>
                  <input required type="text" value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Email</label>
                  <input required type="email" value={form.customerEmail} onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))} className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Shipping Address</label>
                  <textarea required rows={3} placeholder="Street, building, apt, city, postal code, country" value={form.shippingAddress} onChange={(e) => setForm((p) => ({ ...p, shippingAddress: e.target.value }))} className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none" />
                </div>
              </form>
            </div>

            {/* Coupon */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-blue-500" /> Promo Code</h2>
              {couponResult ? (
                <div className="flex items-center gap-3 glass-card rounded-xl px-4 py-3 border-green-200/50 bg-green-50/20">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1"><p className="text-sm font-medium text-green-800">Code <span className="font-mono">{couponResult.code}</span> applied!</p><p className="text-xs text-green-700">You save {format(couponResult.discount)}</p></div>
                  <button onClick={() => { setCouponResult(null); setCouponCode(""); }} className="text-xs text-green-600 hover:text-green-800 underline">Remove</button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleValidateCoupon())} className="flex-1 glass-card rounded-xl px-4 py-2.5 text-blue-950 font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 uppercase placeholder:normal-case" />
                    <Button type="button" onClick={handleValidateCoupon} disabled={validatingCoupon || !couponCode.trim()} variant="outline" className="glass-card text-blue-900 border-white/40 rounded-xl px-5">{validatingCoupon ? "..." : "Apply"}</Button>
                  </div>
                  {couponError && <p className="text-xs text-red-700 mt-1">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Payment */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-1">Payment Method</h2>
              <p className="text-xs text-blue-800/50 mb-3">Mobile Money payments are confirmed manually by the store.</p>
              <div className="space-y-3">
                {paymentOptions.map((option) => (
                  <label key={option.value} className={`flex items-center gap-3 glass-card rounded-xl px-4 py-3 border-2 transition-all ${option.comingSoon ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${paymentMethod === option.value && !option.comingSoon ? "border-blue-400 bg-blue-50/20" : "border-white/30 hover:border-blue-200"}`}>
                    <input type="radio" name="paymentMethod" value={option.value} checked={paymentMethod === option.value} disabled={option.comingSoon} onChange={(e) => !option.comingSoon && setPaymentMethod(e.target.value as any)} className="accent-blue-600" />
                    <option.icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-950 flex-1">{option.label}</span>
                    {option.comingSoon && (
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                        <Clock className="w-3 h-3" /> Coming Soon
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {(paymentMethod === "mtn_momo" || paymentMethod === "airtel_money") && (
                <div className="mt-4 space-y-3">
                  {businessNum ? (
                    <div className="glass-card rounded-xl p-4 border-2 border-green-200/60 bg-green-50/20">
                      <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">
                        Step 1 — Send {format(total)} to this number:
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-green-900 font-mono tracking-wider">{businessNum}</p>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(businessNum); toast.success("Number copied!"); }} className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg" title="Copy">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Use {paymentMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"} on your phone to send the payment, then enter your number below.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2 glass-card rounded-xl p-3 border-yellow-200/50 bg-yellow-50/20">
                      <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800">Payment number not set up yet. Place your order and the store will contact you with payment instructions.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">
                      {businessNum ? "Step 2 — " : ""}Your {paymentMethod === "mtn_momo" ? "MTN" : "Airtel"} phone number (so we can confirm your payment)
                    </label>
                    <input type="tel" required value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} placeholder="+256 700 000 000" className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                    <p className="text-xs text-blue-800/50 mt-1">We'll verify your payment using this number and update your order status.</p>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" form="checkout-form" disabled={createOrder.isPending} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md">
              {createOrder.isPending ? "Processing..." : `Place Order • ${format(total)}`}
            </Button>
          </div>

          {/* Order Summary */}
          <div>
            <div className="glass-panel rounded-3xl p-8 border-white/40 sticky top-24">
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 glass-card rounded-lg p-1 flex-shrink-0">
                      {item.product.imageUrl ? <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">Img</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-950 truncate">{item.product.name}</p>
                      <p className="text-xs text-blue-800/70">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-blue-900">{format(item.product.price * item.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/30 pt-4 space-y-3">
                <div className="flex justify-between text-sm text-blue-900/80"><span>Subtotal</span><span>{format(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-green-700"><span>Discount ({couponResult?.code})</span><span>−{format(discount)}</span></div>}
                <div className="flex justify-between text-sm text-blue-900/80"><span>Shipping</span><span>{shipping === 0 ? "Free" : format(shipping)}</span></div>
                {shipping === 0 && <p className="text-xs text-green-700">Free shipping on orders over $100!</p>}
                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <span className="font-medium text-blue-950">Total</span>
                  <span className="text-2xl font-serif text-blue-950">{format(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
