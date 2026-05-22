import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tag, CheckCircle, Truck, Info, Loader2, ShieldCheck, Smartphone, CreditCard,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type CouponResult = { id: string; code: string; type: string; value: number; discount: number };
type PaymentMethod = "pesapal" | "cash_on_delivery";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const { data: session } = useGetCurrentUser();
  const { format } = useCurrency();

  const [form, setForm] = useState({ customerName: "", customerEmail: "", shippingAddress: "", buyerPhone: "" });
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>("pesapal");
  const [paymentNumber, setPaymentNumber]   = useState("");
  const [couponCode, setCouponCode]         = useState("");
  const [couponResult, setCouponResult]     = useState<CouponResult | null>(null);
  const [couponError, setCouponError]       = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);

  useEffect(() => {
    if (session?.user) {
      setForm((p) => ({
        ...p,
        customerName:  p.customerName  || session.user!.name,
        customerEmail: p.customerEmail || session.user!.email,
      }));
    }
  }, [session?.user]);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => { setFreeDeliveryThreshold(Number(d.freeDeliveryThreshold ?? 0)); })
      .catch(() => {});
  }, []);

  const discount = couponResult?.discount ?? 0;
  const total    = Math.max(0, subtotal - discount);
  const isOnline = paymentMethod === "pesapal";

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const res  = await apiFetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, orderTotal: subtotal }),
      });
      const data = await res.json();
      if (!res.ok) setCouponError(data.error || "Invalid coupon");
      else { setCouponResult(data); toast.success(`Coupon applied! You save ${format(data.discount)}`); }
    } catch { setCouponError("Could not validate coupon"); }
    finally   { setValidatingCoupon(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:    form.customerName,
          customerEmail:   form.customerEmail,
          shippingAddress: form.shippingAddress,
          buyerPhone:      form.buyerPhone || undefined,
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          couponCode:    couponResult?.code,
          paymentMethod,
          paymentNumber: isOnline && paymentNumber.trim() ? paymentNumber : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to place order. Please try again.", { duration: 7000 });
        setSubmitting(false);
        return;
      }

      if (paymentMethod === "cash_on_delivery") {
        clearCart();
        toast.success("Order placed! We'll confirm delivery details with you shortly.");
        setLocation(`/order/${data.id}`);
      } else {
        // Redirect to Pesapal hosted payment page
        if (!data.redirectUrl) {
          toast.error("Could not get payment link. Please try again.");
          setSubmitting(false);
          return;
        }
        clearCart();
        // Navigate to Pesapal — they'll redirect back to /order/{id} after payment
        window.location.href = data.redirectUrl as string;
      }
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (items.length === 0) { setLocation("/cart"); return null; }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ── Form ──────────────────────────────────────────────────────── */}
          <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 space-y-8">

            {/* Shipping details */}
            <div>
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Shipping Details</h2>
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Full Name</label>
                  <input required type="text" value={form.customerName}
                    onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Email</label>
                  <input required type="email" value={form.customerEmail}
                    onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">
                    Contact Phone <span className="text-blue-800/40 font-normal">(for order follow-up)</span>
                  </label>
                  <input type="tel" value={form.buyerPhone}
                    onChange={(e) => setForm((p) => ({ ...p, buyerPhone: e.target.value }))}
                    placeholder="+256 700 000 000"
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Shipping Address</label>
                  <textarea required rows={3} placeholder="Street, building, city, country"
                    value={form.shippingAddress}
                    onChange={(e) => setForm((p) => ({ ...p, shippingAddress: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none" />
                </div>
              </form>
            </div>

            {/* Promo Code */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" /> Promo Code
              </h2>
              {couponResult ? (
                <div className="flex items-center gap-3 glass-card rounded-xl px-4 py-3 border-green-200/50 bg-green-50/20">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Code <span className="font-mono">{couponResult.code}</span> applied!</p>
                    <p className="text-xs text-green-700">You save {format(couponResult.discount)}</p>
                  </div>
                  <button onClick={() => { setCouponResult(null); setCouponCode(""); }} className="text-xs text-green-600 hover:text-green-800 underline">Remove</button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleValidateCoupon())}
                      className="flex-1 glass-card rounded-xl px-4 py-2.5 text-blue-950 font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 uppercase placeholder:normal-case" />
                    <Button type="button" onClick={handleValidateCoupon}
                      disabled={validatingCoupon || !couponCode.trim()} variant="outline"
                      className="glass-card text-blue-900 border-white/40 rounded-xl px-5">
                      {validatingCoupon ? "..." : "Apply"}
                    </Button>
                  </div>
                  {couponError && <p className="text-xs text-red-700 mt-1">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-1">Payment Method</h2>
              <p className="text-xs text-blue-800/50 mb-3">
                Secure online payments are processed by Pesapal — supporting MTN Mobile Money, Airtel Money, and major cards.
              </p>
              <div className="space-y-3">
                {/* Pesapal (online) */}
                <label className={`flex items-start gap-3 glass-card rounded-xl px-4 py-4 border-2 cursor-pointer transition-all ${paymentMethod === "pesapal" ? "border-blue-400 bg-blue-50/20" : "border-white/30 hover:border-blue-200"}`}>
                  <input type="radio" name="paymentMethod" value="pesapal"
                    checked={paymentMethod === "pesapal"}
                    onChange={() => setPaymentMethod("pesapal")}
                    className="accent-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-medium text-blue-950">Pay Online via Pesapal</p>
                    </div>
                    <p className="text-xs text-blue-800/60 mt-0.5">MTN Mobile Money · Airtel Money · Visa / Mastercard</p>
                    {paymentMethod === "pesapal" && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-blue-800/70">
                          You'll be securely redirected to Pesapal to choose your preferred payment method and complete the transaction. Mobile money users receive a PIN prompt directly on their phone.
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-blue-900/70 mb-1">
                            Mobile money number <span className="text-blue-800/40 font-normal">(optional — for faster checkout on Pesapal)</span>
                          </label>
                          <input type="tel" value={paymentNumber}
                            onChange={(e) => setPaymentNumber(e.target.value)}
                            placeholder="+256 700 000 000"
                            className="w-full glass-card rounded-xl px-4 py-2 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                {/* Cash on delivery */}
                <label className={`flex items-start gap-3 glass-card rounded-xl px-4 py-3.5 border-2 cursor-pointer transition-all ${paymentMethod === "cash_on_delivery" ? "border-blue-400 bg-blue-50/20" : "border-white/30 hover:border-blue-200"}`}>
                  <input type="radio" name="paymentMethod" value="cash_on_delivery"
                    checked={paymentMethod === "cash_on_delivery"}
                    onChange={() => setPaymentMethod("cash_on_delivery")}
                    className="accent-blue-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-medium text-blue-950">Pay on Delivery</p>
                    </div>
                    <p className="text-xs text-blue-800/60 mt-0.5">Cash payment when your order arrives</p>
                  </div>
                </label>
              </div>

              {paymentMethod === "cash_on_delivery" && (
                <div className="mt-4 flex items-start gap-2 glass-card rounded-xl px-4 py-3 bg-blue-50/20 border-blue-200/40">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Your order will be processed immediately. Our team will confirm delivery details and cost before dispatch. Payment is collected at delivery.
                  </p>
                </div>
              )}
            </div>

            <Button type="submit" form="checkout-form" disabled={submitting}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isOnline ? "Redirecting to Pesapal…" : "Placing order…"}
                </span>
              ) : isOnline ? (
                `Pay via Pesapal · ${format(total)}`
              ) : (
                "Place Order · Pay on Delivery"
              )}
            </Button>

            {isOnline && (
              <p className="text-center text-[11px] text-blue-800/40 flex items-center justify-center gap-1.5 -mt-4">
                <ShieldCheck className="w-3 h-3" />
                Payments secured by Pesapal. We never store your card or PIN details.
              </p>
            )}
          </div>

          {/* ── Order summary ─────────────────────────────────────────────── */}
          <div>
            <div className="glass-panel rounded-3xl p-8 border-white/40 sticky top-24">
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 glass-card rounded-lg p-1 flex-shrink-0">
                      {item.product.imageUrl
                        ? <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                        : <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">Img</div>}
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
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount ({couponResult?.code})</span><span>−{format(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-blue-900/80"><span>Shipping</span><span>TBC by store</span></div>
                {freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold && (
                  <div className="text-xs text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Qualifies for free delivery!
                  </div>
                )}
                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <span className="font-medium text-blue-950">Total</span>
                  <span className="text-2xl font-serif text-blue-950">{format(total)}</span>
                </div>
                {isOnline && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                    <p className="text-xs text-blue-800/60">Full amount charged via Pesapal at checkout</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
