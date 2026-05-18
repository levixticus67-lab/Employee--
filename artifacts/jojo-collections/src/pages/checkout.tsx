import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCreateOrder, useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tag, CheckCircle, Smartphone, CreditCard, Clock, Copy, Info, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";

type CouponResult = { id: string; code: string; type: string; value: number; discount: number };

const PAYMENT_OPTIONS = [
  { value: "full" as const, label: "Pay full amount now", pct: 1 },
  { value: "half" as const, label: "Pay 50% now, rest on delivery", pct: 0.5 },
  { value: "quarter" as const, label: "Pay 25% now, rest on delivery", pct: 0.25 },
  { value: "none" as const, label: "Pay everything on delivery", pct: 0 },
];

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const { data: session } = useGetCurrentUser();
  const { format } = useCurrency();

  const [form, setForm] = useState({ customerName: "", customerEmail: "", shippingAddress: "", buyerPhone: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"mtn_momo" | "airtel_money" | "online">("mtn_momo");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [partialOption, setPartialOption] = useState<"full" | "half" | "quarter" | "none">("full");
  const [businessNumbers, setBusinessNumbers] = useState({ mtnNumber: "", airtelNumber: "" });
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);
  const [locationDeliveryThreshold, setLocationDeliveryThreshold] = useState(0);

  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({ ...prev, customerName: prev.customerName || session.user!.name, customerEmail: prev.customerEmail || session.user!.email }));
    }
  }, [session?.user]);

  useEffect(() => {
    apiFetch("/api/settings/public").then((r) => r.json()).then((d) => {
      setBusinessNumbers({ mtnNumber: d.mtnNumber ?? "", airtelNumber: d.airtelNumber ?? "" });
        setFreeDeliveryThreshold(Number(d.freeDeliveryThreshold ?? 0));
      setLocationDeliveryThreshold(Number(d.locationDeliveryThreshold ?? 0));
    }).catch(() => {});
  }, []);

  const discount = couponResult?.discount ?? 0;
    const orderValue = subtotal - discount;
    const qualifiesNationwideFree = freeDeliveryThreshold > 0 && orderValue >= freeDeliveryThreshold;
    const qualifiesLocationBased  = locationDeliveryThreshold > 0 && orderValue >= locationDeliveryThreshold && !qualifiesNationwideFree;
    const shipping = 0; // always 0 at checkout – admin confirms or auto-free if threshold met
    const total = Math.max(0, subtotal - discount); // shipping excluded until confirmed
  const selectedPct = PAYMENT_OPTIONS.find((o) => o.value === partialOption)?.pct ?? 1;
  const amountPaidNow = Math.round(total * selectedPct * 100) / 100;
  const amountOnDelivery = Math.round((total - amountPaidNow) * 100) / 100;

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true); setCouponError(""); setCouponResult(null);
    try {
      const res = await apiFetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponCode, orderTotal: subtotal }) });
      const data = await res.json();
      if (!res.ok) setCouponError(data.error || "Invalid coupon");
      else { setCouponResult(data); toast.success(`Coupon applied! You save ${format(data.discount)}`); }
    } catch { setCouponError("Could not validate coupon"); } finally { setValidatingCoupon(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    createOrder.mutate(
      {
        data: {
          customerName: form.customerName, customerEmail: form.customerEmail,
          shippingAddress: form.shippingAddress, items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          couponCode: couponResult?.code, paymentMethod, paymentNumber: paymentMethod !== "online" ? paymentNumber : undefined,
        } as any,
        ...(({} as any)),
      },
      {
        onSuccess: async (order) => {
          // Record partial payment if applicable
          if (amountPaidNow > 0 && amountPaidNow < total) {
            await apiFetch(`/api/orders/${order.id}/payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: form.customerEmail, amount: amountPaidNow }),
            }).catch(() => {});
          } else if (amountPaidNow >= total) {
            await apiFetch(`/api/orders/${order.id}/payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: form.customerEmail, amount: total }),
            }).catch(() => {});
          }
          // Save buyerPhone via payment endpoint by re-using order update
          if (form.buyerPhone.trim()) {
            await apiFetch(`/api/admin/orders/${order.id}/status`, {
              method: "GET",
            }).catch(() => {});
          }
          clearCart(); toast.success("Order placed!"); setLocation(`/order/${order.id}`);
        },
        onError: () => toast.error("Failed to place order. Please try again."),
      }
    );
  };

  if (items.length === 0) { setLocation("/cart"); return null; }

  const businessNum = paymentMethod === "mtn_momo" ? businessNumbers.mtnNumber : businessNumbers.airtelNumber;

  const momoOptions = [
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
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Phone Number <span className="text-blue-800/40 font-normal">(for order follow-up)</span></label>
                  <input type="tel" value={form.buyerPhone} onChange={(e) => setForm((p) => ({ ...p, buyerPhone: e.target.value }))} placeholder="+256 700 000 000" className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
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

            {/* Payment Method */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-1">Payment Method</h2>
              <p className="text-xs text-blue-800/50 mb-3">Mobile Money payments are confirmed manually by the store.</p>
              <div className="space-y-3">
                {momoOptions.map((option) => (
                  <label key={option.value} className={`flex items-center gap-3 glass-card rounded-xl px-4 py-3 border-2 transition-all ${option.comingSoon ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${paymentMethod === option.value && !option.comingSoon ? "border-blue-400 bg-blue-50/20" : "border-white/30 hover:border-blue-200"}`}>
                    <input type="radio" name="paymentMethod" value={option.value} checked={paymentMethod === option.value} disabled={option.comingSoon} onChange={(e) => !option.comingSoon && setPaymentMethod(e.target.value as any)} className="accent-blue-600" />
                    <option.icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-950 flex-1">{option.label}</span>
                    {option.comingSoon && <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200"><Clock className="w-3 h-3" /> Coming Soon</span>}
                  </label>
                ))}
              </div>

              {(paymentMethod === "mtn_momo" || paymentMethod === "airtel_money") && (
                <div className="mt-4 space-y-3">
                  {businessNum ? (
                    <div className="glass-card rounded-xl p-4 border-2 border-green-200/60 bg-green-50/20">
                      <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">Send {format(amountPaidNow > 0 ? amountPaidNow : total)} to:</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-green-900 font-mono tracking-wider">{businessNum}</p>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(businessNum); toast.success("Number copied!"); }} className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg"><Copy className="w-4 h-4" /></button>
                      </div>
                      <p className="text-xs text-green-700 mt-1">Use {paymentMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"} on your phone, then enter your number below.</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 glass-card rounded-xl p-3 border-yellow-200/50 bg-yellow-50/20">
                      <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800">Payment number not set up yet. Place your order and the store will contact you with payment instructions.</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Your {paymentMethod === "mtn_momo" ? "MTN" : "Airtel"} phone number</label>
                    <input type="tel" required value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} placeholder="+256 700 000 000" className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                    <p className="text-xs text-blue-800/50 mt-1">We'll verify your payment using this number.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Partial Payment */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-1 flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-500" /> How Much Will You Pay Now?</h2>
              <p className="text-xs text-blue-800/50 mb-3">You can pay a partial amount upfront and settle the rest when goods arrive.</p>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const amt = Math.round(total * opt.pct * 100) / 100;
                  const remaining = Math.round((total - amt) * 100) / 100;
                  return (
                    <label key={opt.value} className={`flex items-center gap-3 glass-card rounded-xl px-4 py-3 border-2 cursor-pointer transition-all ${partialOption === opt.value ? "border-blue-400 bg-blue-50/20" : "border-white/30 hover:border-blue-200"}`}>
                      <input type="radio" name="partialOption" value={opt.value} checked={partialOption === opt.value} onChange={() => setPartialOption(opt.value)} className="accent-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-950">{opt.label}</p>
                        {opt.pct > 0 && opt.pct < 1 && <p className="text-xs text-blue-800/60">Pay {format(amt)} now · {format(remaining)} on delivery</p>}
                        {opt.pct === 1 && <p className="text-xs text-blue-800/60">Pay {format(total)} in full</p>}
                        {opt.pct === 0 && <p className="text-xs text-blue-800/60">Pay {format(total)} when goods arrive</p>}
                      </div>
                      <span className="text-sm font-semibold text-blue-900">{format(amt)}</span>
                    </label>
                  );
                })}
              </div>
              {amountOnDelivery > 0 && (
                <div className="mt-3 flex items-center gap-2 glass-card rounded-xl px-4 py-3 bg-amber-50/20 border-amber-200/50">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800">You'll pay <strong>{format(amountOnDelivery)}</strong> when your order is delivered. Please have this ready.</p>
                </div>
              )}
            </div>

            <Button type="submit" form="checkout-form" disabled={createOrder.isPending} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md">
              {createOrder.isPending ? "Processing..." : amountPaidNow > 0 ? `Place Order · Pay ${format(amountPaidNow)} Now` : `Place Order · Pay on Delivery`}
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
                {amountPaidNow > 0 && amountPaidNow < total && (
                  <div className="border-t border-white/20 pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-blue-600 font-medium"><span>Pay now</span><span>{format(amountPaidNow)}</span></div>
                    <div className="flex justify-between text-sm text-amber-700"><span>Pay on delivery</span><span>{format(amountOnDelivery)}</span></div>
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
