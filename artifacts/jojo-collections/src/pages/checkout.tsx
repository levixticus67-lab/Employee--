import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tag, CheckCircle, Smartphone, Truck, Info, Copy, Loader2, ShieldCheck, AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type CouponResult = { id: string; code: string; type: string; value: number; discount: number };
type PaymentMethod = "mtn_momo" | "airtel_money" | "cash_on_delivery";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; sub: string; isMobileMoney: boolean }[] = [
  { value: "mtn_momo", label: "MTN Mobile Money", sub: "Instant USSD PIN prompt on your phone", isMobileMoney: true },
  { value: "airtel_money", label: "Airtel Money", sub: "Instant USSD PIN prompt on your phone", isMobileMoney: true },
  { value: "cash_on_delivery", label: "Pay on Delivery", sub: "Cash when your order arrives", isMobileMoney: false },
];

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const { data: session } = useGetCurrentUser();
  const { format } = useCurrency();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    shippingAddress: "",
    buyerPhone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mtn_momo");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [businessNumbers, setBusinessNumbers] = useState({ mtnNumber: "", airtelNumber: "" });
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);

  useEffect(() => {
    if (session?.user) {
      setForm((p) => ({
        ...p,
        customerName: p.customerName || session.user!.name,
        customerEmail: p.customerEmail || session.user!.email,
      }));
    }
  }, [session?.user]);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        setBusinessNumbers({ mtnNumber: d.mtnNumber ?? "", airtelNumber: d.airtelNumber ?? "" });
        setFreeDeliveryThreshold(Number(d.freeDeliveryThreshold ?? 0));
      })
      .catch(() => {});
  }, []);

  // Poll order status once STK push is initiated
  useEffect(() => {
    if (!awaitingPayment || !pendingOrderId) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 3 minutes at 3 s intervals

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await apiFetch(`/api/orders/${pendingOrderId}`);
        if (!res.ok) return;
        const order = await res.json();
        if (order.paymentStatus === "paid") {
          clearInterval(interval);
          clearCart();
          setLocation(`/order/${pendingOrderId}`);
        } else if (order.paymentStatus === "failed") {
          clearInterval(interval);
          setAwaitingPayment(false);
          setPendingOrderId(null);
          setSubmitting(false);
          toast.error(
            "Payment was declined or failed. Please check your mobile money balance and try again.",
            { duration: 8000 },
          );
        }
      } catch {
        /* ignore transient errors */
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        setAwaitingPayment(false);
        setSubmitting(false);
        toast.error(
          "Payment confirmation is taking longer than expected. Check your order status page or contact us.",
          { duration: 10000 },
        );
        clearCart();
        setLocation(`/order/${pendingOrderId}`);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [awaitingPayment, pendingOrderId]);

  const discount = couponResult?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const isMobileMoney = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.isMobileMoney ?? false;
  const businessNum = paymentMethod === "mtn_momo" ? businessNumbers.mtnNumber : businessNumbers.airtelNumber;

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const res = await apiFetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, orderTotal: subtotal }),
      });
      const data = await res.json();
      if (!res.ok) setCouponError(data.error || "Invalid coupon");
      else {
        setCouponResult(data);
        toast.success(`Coupon applied! You save ${format(data.discount)}`);
      }
    } catch {
      setCouponError("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (isMobileMoney && !paymentNumber.trim()) {
      toast.error("Please enter your mobile money phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          shippingAddress: form.shippingAddress,
          buyerPhone: form.buyerPhone || undefined,
          items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          couponCode: couponResult?.code,
          paymentMethod,
          paymentNumber: isMobileMoney ? paymentNumber : undefined,
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
        toast.success("Order placed! We'll contact you with delivery details.");
        setLocation(`/order/${data.id}`);
      } else {
        // Mobile money — await webhook confirmation
        setPendingOrderId(data.id);
        setAwaitingPayment(true);
        toast.success("Mobile money request sent! Check your phone for a PIN prompt.");
      }
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    setLocation("/cart");
    return null;
  }

  // ── Payment awaiting screen ───────────────────────────────────────────────
  if (awaitingPayment) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="glass-panel-heavy rounded-3xl p-10 border-white/50 space-y-6">
            <div className="w-20 h-20 rounded-full bg-blue-100/60 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-serif text-blue-950 mb-3">Waiting for Payment</h2>
              <p className="text-blue-800/70 text-sm leading-relaxed mb-2">
                A PIN prompt has been sent to
              </p>
              <p className="font-bold text-blue-950 text-lg mb-4">{paymentNumber}</p>
              <div className="glass-card rounded-xl px-4 py-3 bg-amber-50/30 border-amber-200/50 text-left space-y-1.5">
                <p className="text-sm font-medium text-amber-900">What to do:</p>
                <p className="text-sm text-amber-800">1. Open the mobile money prompt on your phone</p>
                <p className="text-sm text-amber-800">2. Enter your mobile money PIN</p>
                <p className="text-sm text-amber-800">3. This page will update automatically</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-800/50 justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secured by Flutterwave · Do not close this page</span>
            </div>
            <button
              onClick={() => {
                setAwaitingPayment(false);
                setSubmitting(false);
                if (pendingOrderId) {
                  clearCart();
                  setLocation(`/order/${pendingOrderId}`);
                }
              }}
              className="text-xs text-blue-600 underline hover:no-underline"
            >
              Check order status page instead
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ── Left column: form ───────────────────────────────────────── */}
          <div className="glass-panel-heavy rounded-3xl p-8 border-white/50 space-y-8">

            {/* Shipping Details */}
            <div>
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Shipping Details</h2>
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">
                    Contact Phone{" "}
                    <span className="text-blue-800/40 font-normal">(for order follow-up)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.buyerPhone}
                    onChange={(e) => setForm((p) => ({ ...p, buyerPhone: e.target.value }))}
                    placeholder="+256 700 000 000"
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">
                    Shipping Address
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Street, building, city, country"
                    value={form.shippingAddress}
                    onChange={(e) => setForm((p) => ({ ...p, shippingAddress: e.target.value }))}
                    className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none"
                  />
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
                    <p className="text-sm font-medium text-green-800">
                      Code <span className="font-mono">{couponResult.code}</span> applied!
                    </p>
                    <p className="text-xs text-green-700">You save {format(couponResult.discount)}</p>
                  </div>
                  <button
                    onClick={() => { setCouponResult(null); setCouponCode(""); }}
                    className="text-xs text-green-600 hover:text-green-800 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleValidateCoupon())
                      }
                      className="flex-1 glass-card rounded-xl px-4 py-2.5 text-blue-950 font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 uppercase placeholder:normal-case"
                    />
                    <Button
                      type="button"
                      onClick={handleValidateCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      variant="outline"
                      className="glass-card text-blue-900 border-white/40 rounded-xl px-5"
                    >
                      {validatingCoupon ? "..." : "Apply"}
                    </Button>
                  </div>
                  {couponError && <p className="text-xs text-red-700 mt-1">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <h2 className="text-lg font-serif text-blue-950 mb-1">Payment Method</h2>
              <p className="text-xs text-blue-800/50 mb-3">
                Mobile money payments are processed instantly and securely via Flutterwave.
              </p>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-start gap-3 glass-card rounded-xl px-4 py-3.5 border-2 cursor-pointer transition-all ${
                      paymentMethod === method.value
                        ? "border-blue-400 bg-blue-50/20"
                        : "border-white/30 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => setPaymentMethod(method.value)}
                      className="accent-blue-600 mt-0.5"
                    />
                    <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-950">{method.label}</p>
                      <p className="text-xs text-blue-800/60">{method.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Mobile money phone input */}
              {isMobileMoney && (
                <div className="mt-5 space-y-4">
                  {businessNum ? (
                    <div className="glass-card rounded-xl p-4 border-2 border-green-200/60 bg-green-50/20">
                      <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">
                        Send{" "}
                        <span className="font-bold text-green-900">{format(total)}</span> to:
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-green-900 font-mono tracking-wider">
                          {businessNum}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(businessNum);
                            toast.success("Number copied!");
                          }}
                          className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        {paymentMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"} · When you
                        click Pay Now below, you'll receive a PIN prompt automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2 glass-card rounded-xl p-3 border-yellow-200/50 bg-yellow-50/20">
                      <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800">
                        Store payment number not configured yet. Place your order and we'll contact
                        you.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">
                      Your {paymentMethod === "mtn_momo" ? "MTN" : "Airtel"} phone number
                    </label>
                    <input
                      type="tel"
                      required
                      value={paymentNumber}
                      onChange={(e) => setPaymentNumber(e.target.value)}
                      placeholder="+256 700 000 000"
                      className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                    />
                    <p className="text-xs text-blue-800/50 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      A secure PIN prompt will be sent to this number instantly.
                    </p>
                  </div>
                </div>
              )}

              {!isMobileMoney && (
                <div className="mt-4 flex items-start gap-2 glass-card rounded-xl px-4 py-3 bg-blue-50/20 border-blue-200/40">
                  <Truck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Your order will be processed and our team will confirm the delivery details.
                    Payment is collected at delivery.
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isMobileMoney ? "Sending PIN prompt…" : "Placing order…"}
                </span>
              ) : isMobileMoney ? (
                `Pay Now · ${format(total)}`
              ) : (
                `Place Order · Pay on Delivery`
              )}
            </Button>

            {isMobileMoney && (
              <p className="text-center text-[11px] text-blue-800/40 flex items-center justify-center gap-1.5 -mt-4">
                <ShieldCheck className="w-3 h-3" />
                Payments secured by Flutterwave. We never store your PIN.
              </p>
            )}
          </div>

          {/* ── Right column: order summary ──────────────────────────────── */}
          <div>
            <div className="glass-panel rounded-3xl p-8 border-white/40 sticky top-24">
              <h2 className="text-2xl font-serif text-blue-950 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 glass-card rounded-lg p-1 flex-shrink-0">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">
                          Img
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-950 truncate">{item.product.name}</p>
                      <p className="text-xs text-blue-800/70">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-blue-900">
                      {format(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/30 pt-4 space-y-3">
                <div className="flex justify-between text-sm text-blue-900/80">
                  <span>Subtotal</span>
                  <span>{format(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount ({couponResult?.code})</span>
                    <span>−{format(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-blue-900/80">
                  <span>Shipping</span>
                  <span>TBC by store</span>
                </div>
                {freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold && (
                  <div className="text-xs text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Qualifies for free delivery!
                  </div>
                )}
                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <span className="font-medium text-blue-950">Total</span>
                  <span className="text-2xl font-serif text-blue-950">{format(total)}</span>
                </div>
                {isMobileMoney && (
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-green-700 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Full amount charged immediately via mobile money
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
