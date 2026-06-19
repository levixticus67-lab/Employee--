import { useState, useEffect, useRef } from "react";
import { useStoreName } from "@/lib/use-store-name";
  import { useLocation } from "wouter";
  import { useGetCurrentUser } from "@workspace/api-client-react";
  import { Layout } from "@/components/layout";
  import { useCart } from "@/components/cart-context";
  import { useCurrency } from "@/components/currency-context";
  import { Button } from "@/components/ui/button";
  import { toast } from "sonner";
  import {
    Tag, CheckCircle, Truck, Info, Loader2, ShieldCheck, Smartphone, CreditCard,
    MessageCircle, Gift, Package, MapPin, Navigation,
  } from "lucide-react";
  import { apiFetch } from "@/lib/api";
  import { isGuestMode } from "@/lib/guest-mode";

  type CouponResult = { id: string; code: string; type: string; value: number; discount: number };
  type PaymentMethod = "pesapal" | "cash_on_delivery";

  // Deposit presets shown under the Pesapal option
  const DEPOSIT_PRESETS = [0.3, 0.5, 0.7] as const;

  export default function Checkout() {
      const storeName = useStoreName();
  const [, setLocation] = useLocation();
    const { items, bundles, subtotal, clearCart } = useCart();
    const { data: session } = useGetCurrentUser();
    const { format } = useCurrency();
    const guest = isGuestMode();

    const [form, setForm] = useState({
      customerName: "", customerEmail: "", shippingAddress: "", buyerPhone: "",
    });
    const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>("pesapal");
    const [paymentNumber, setPaymentNumber]   = useState("");
    const [couponCode, setCouponCode]         = useState("");
    const [couponResult, setCouponResult]     = useState<CouponResult | null>(null);
    const [couponError, setCouponError]       = useState("");
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [submitting, setSubmitting]         = useState(false);
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);
    const [whatsappNumber, setWhatsappNumber] = useState("");

    // Partial payment state
    const [isPartialPayment, setIsPartialPayment] = useState(false);
    const [partialAmount, setPartialAmount]       = useState(0); // in USD (same units as product prices)
    const [giftWrapping, setGiftWrapping]         = useState(false);
    const [giftNote, setGiftNote]                 = useState("");

    // Location field state
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
    const [gpsLoading, setGpsLoading]             = useState(false);
    const [showSuggestions, setShowSuggestions]   = useState(false);
    const debounceRef = useRef(null);

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
        .then((d: Record<string, unknown>) => {
          setFreeDeliveryThreshold(Number(d["freeDeliveryThreshold"] ?? 0));
          setWhatsappNumber(String(d["whatsappNumber"] ?? ""));
        })
        .catch(() => {});
    }, []);

    const discount = couponResult?.discount ?? 0;
    const total    = Math.max(0, subtotal - discount);
    const isOnline = paymentMethod === "pesapal";

    // When total changes (e.g. coupon applied), reset partial to full
    useEffect(() => { setPartialAmount(total); }, [total]);

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
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) setCouponError((data["error"] as string) || "Invalid coupon");
        else {
          setCouponResult(data as unknown as CouponResult);
          toast.success(`Coupon applied! You save ${format((data as unknown as CouponResult).discount)}`);
        }
      } catch { setCouponError("Could not validate coupon"); }
      finally   { setValidatingCoupon(false); }
    };

    const handleGetGPS = () => {
      if (!navigator.geolocation) {
        toast.error("Your browser doesn't support location access");
        return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await apiFetch(
              `/api/geocode/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
            );
            const data = await res.json();
            if (data.display_name) {
              setForm((p) => ({ ...p, shippingAddress: data.display_name.slice(0, 300) }));
              toast.success("Location filled in — please verify it looks correct");
            } else {
              toast.error("Couldn't read your location. Please type it in.");
            }
          } catch {
            toast.error("Location lookup failed. Please type your address.");
          } finally { setGpsLoading(false); }
        },
        (err) => {
          setGpsLoading(false);
          if (err.code === 1) {
            toast.error("GPS is blocked for this site — type your area in the box and use the suggestions that appear.");
          } else {
            toast.error("Couldn't get your location. Please type your address.");
          }
        },
        { timeout: 10000, maximumAge: 0 }
      );
    };

    const handleAddressChange = (value) => {
      if (value.length > 300) return;
      setForm((p) => ({ ...p, shippingAddress: value }));
      setShowSuggestions(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 3) { setAddressSuggestions([]); return; }
      debounceRef.current = setTimeout(async () => {
        setFetchingSuggestions(true);
        try {
          const res = await apiFetch(`/api/geocode/search?q=${encodeURIComponent(value)}`);
          const suggestions: string[] = await res.json();
          setAddressSuggestions(suggestions);
          if (suggestions.length > 0) setShowSuggestions(true);
        } catch { /* silently ignore suggestion errors */ }
        finally { setFetchingSuggestions(false); }
      }, 600);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (items.length === 0 && bundles.length === 0) return;
      setSubmitting(true);
      try {
        const amountToPay = isOnline && isPartialPayment && partialAmount < total && partialAmount > 0
          ? partialAmount
          : undefined;

        const res = await apiFetch("/api/payments/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName:    form.customerName,
            customerEmail:   form.customerEmail,
            shippingAddress: form.shippingAddress,
            buyerPhone:      form.buyerPhone || undefined,
            items: [
              ...items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
              ...bundles.flatMap((b) => {
                const sumPrices = b.products.reduce((s, p) => s + ((p as any).salePrice ?? (p as any).price ?? 0), 0);
                const ratio = sumPrices > 0 ? b.price / sumPrices : 1;
                return b.products.map((p) => ({
                  productId: (p as any).id,
                  quantity: 1,
                  priceOverride: ((p as any).salePrice ?? (p as any).price ?? 0) * ratio,
                }));
              }),
            ],
            couponCode:    couponResult?.code,
            giftWrapping:  giftWrapping || undefined,
            giftNote:      giftWrapping && giftNote.trim() ? giftNote.trim() : undefined,
            paymentMethod,
            paymentNumber: isOnline && paymentNumber.trim() ? paymentNumber : undefined,
            amountToPay,
          }),
        });

        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) {
          toast.error((data["error"] as string) ?? "Failed to place order. Please try again.", { duration: 7000 });
          setSubmitting(false);
          return;
        }

        if (paymentMethod === "cash_on_delivery") {
          // Show a WhatsApp CTA so the customer can confirm delivery details
          const waClean = whatsappNumber.replace(/\D/g, "");
          const orderId = (data["id"] as string | undefined) ?? "";
          const waMsg   = encodeURIComponent(
            `Hi ${storeName}! I just placed order #${orderId.slice(0, 8).toUpperCase()} and would like to confirm my delivery details.`
          );
          const waUrl = waClean ? `https://wa.me/${waClean}?text=${waMsg}` : null;
          toast.success("Order placed!", {
            description: waUrl
              ? "Contact us on WhatsApp to confirm your delivery time and address."
              : "Our team will reach out to confirm your delivery details.",
            action: waUrl ? {
              label: "WhatsApp us",
              onClick: () => window.open(waUrl, "_blank"),
            } : undefined,
            duration: 12000,
          });
          // Navigate FIRST, then clear cart — clearing first triggers the
          // empty-cart guard which calls setLocation("/cart") and returns null (blank screen)
          setLocation(`/order/${orderId}`);
          clearCart();
        } else {
          if (!data["redirectUrl"]) {
            toast.error("Could not get payment link. Please try again.");
            setSubmitting(false);
            return;
          }
          clearCart();
          window.location.href = data["redirectUrl"] as string;
        }
      } catch {
        toast.error("Network error. Please try again.");
        setSubmitting(false);
      }
    };

    if (items.length === 0 && bundles.length === 0) { setLocation("/cart"); return null; }

    const payingNow    = isOnline && isPartialPayment && partialAmount < total ? partialAmount : total;
    const balanceDue   = total - payingNow;

    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* ── Left: form ──────────────────────────────────────────────── */}
            <div className="glass-panel-heavy rounded-3xl p-8 border border-white/50 space-y-8">

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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-blue-900/80">Shipping Address</label>
                      <button type="button" onClick={handleGetGPS} disabled={gpsLoading}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors">
                        {gpsLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Navigation className="w-3.5 h-3.5" />}
                        {gpsLoading ? "Detecting\u2026" : "Use my location"}
                      </button>
                    </div>

                    <div className="relative">
                      <textarea required rows={3} maxLength={300}
                        placeholder="e.g. Ntinda, Kampala, Uganda"
                        value={form.shippingAddress}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none" />
                      <div className="flex items-center justify-between mt-0.5 px-1">
                        <span className="text-[10px] text-blue-800/40 h-3">
                          {fetchingSuggestions ? "Searching\u2026" : ""}
                        </span>
                        <span className={`text-[10px] ${form.shippingAddress.length >= 280 ? "text-amber-600 font-medium" : "text-blue-800/40"}`}>
                          {form.shippingAddress.length}/300
                        </span>
                      </div>

                      {/* Autocomplete suggestions dropdown */}
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full glass-panel-heavy border border-white/50 rounded-xl shadow-2xl overflow-hidden">
                          {addressSuggestions.map((suggestion, i) => (
                            <button key={i} type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setForm((p) => ({ ...p, shippingAddress: suggestion.slice(0, 300) }));
                                setAddressSuggestions([]);
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-blue-950 hover:bg-blue-50/30 transition-colors border-b border-white/20 last:border-0 flex items-start gap-2.5">
                              <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-2 leading-snug">{suggestion}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                    <button onClick={() => { setCouponResult(null); setCouponCode(""); }}
                      className="text-xs text-green-600 hover:text-green-800 underline">
                      Remove
                    </button>
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


              {/* Gift Wrapping */}
              <div>
                <h2 className="text-lg font-serif text-blue-950 mb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-pink-400" /> Gift Options
                </h2>
                <label
                  className={"flex items-start gap-3 glass-card rounded-xl px-4 py-4 border-2 cursor-pointer transition-all " + (giftWrapping ? "border-pink-300 bg-pink-50/20" : "border-white/30 hover:border-pink-200")}
                >
                  <input
                    type="checkbox"
                    checked={giftWrapping}
                    onChange={(e) => { setGiftWrapping(e.target.checked); if (!e.target.checked) setGiftNote(""); }}
                    className="accent-pink-500 mt-0.5 w-4 h-4 rounded flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-950">Add gift wrapping</p>
                      <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">FREE</span>
                    </div>
                    <p className="text-xs text-blue-800/60 mt-0.5">
                      Your order will be beautifully wrapped and presented as a gift
                    </p>
                    {giftWrapping && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-blue-900/70 mb-1">
                          Personal message{" "}
                          <span className="text-blue-800/40 font-normal">(optional — written on a gift card)</span>
                        </label>
                        <textarea
                          rows={3}
                          maxLength={300}
                          placeholder="e.g. Happy Birthday! Wishing you a wonderful day 🎉"
                          value={giftNote}
                          onChange={(e) => setGiftNote(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full glass-card rounded-xl px-3 py-2.5 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 border-white/40 resize-none"
                        />
                        <p className="text-[10px] text-blue-800/40 text-right mt-0.5">{giftNote.length}/300</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Payment method */}
              <div>
                <h2 className="text-lg font-serif text-blue-950 mb-1">Payment Method</h2>
                <p className="text-xs text-blue-800/50 mb-3">
                  Online payments are processed by Pesapal — MTN Mobile Money, Airtel Money, Visa &amp; Mastercard.
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
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-blue-800/70">
                            You'll be securely redirected to Pesapal to complete payment. Mobile money users receive a PIN prompt directly on their phone.
                          </p>

                          {/* Mobile money number (optional) */}
                          <div>
                            <label className="block text-xs font-medium text-blue-900/70 mb-1">
                              Mobile money number <span className="text-blue-800/40 font-normal">(optional)</span>
                            </label>
                            <input type="tel" value={paymentNumber}
                              onChange={(e) => setPaymentNumber(e.target.value)}
                              placeholder="+256 700 000 000"
                              className="w-full glass-card rounded-xl px-4 py-2 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                          </div>

                          {/* Partial payment / deposit option */}
                          <div className="pt-2 border-t border-white/20">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox" checked={isPartialPayment}
                                onChange={(e) => {
                                  setIsPartialPayment(e.target.checked);
                                  if (!e.target.checked) setPartialAmount(total);
                                }}
                                className="accent-blue-600 w-4 h-4 rounded" />
                              <span className="text-sm font-medium text-blue-900">Pay a deposit now, balance at delivery</span>
                            </label>

                            {isPartialPayment && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-blue-800/60">Choose how much to pay now:</p>
                                <div className="flex gap-2">
                                  {DEPOSIT_PRESETS.map((pct) => {
                                    const amt = Math.round(total * pct * 100) / 100;
                                    const active = Math.abs(partialAmount - amt) < 0.01;
                                    return (
                                      <button key={pct} type="button"
                                        onClick={() => setPartialAmount(amt)}
                                        className={`flex-1 text-xs py-2 rounded-xl border font-medium transition-all ${
                                          active
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "glass-card text-blue-900 border-white/40 hover:border-blue-300"
                                        }`}>
                                        {Math.round(pct * 100)}%
                                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                                          {format(amt)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-2.5 bg-amber-50/20 border-amber-200/30">
                                  <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                  <p className="text-xs text-amber-800">
                                    Balance of <strong>{format(total - partialAmount)}</strong> due at delivery.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>

                  {!guest && (<>
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
                      <p className="text-xs text-blue-800/60 mt-0.5">Full cash payment when your order arrives</p>
                    </div>
                  </label>

                  {/* COD info + WhatsApp CTA */}
                  {paymentMethod === "cash_on_delivery" && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 glass-card rounded-xl px-4 py-3 bg-blue-50/20 border-blue-200/40">
                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800">
                          Your order will be reserved immediately. After placing it, please contact us on WhatsApp to confirm your delivery time, address, and final cost. Payment ({format(total)}) is collected at delivery.
                        </p>
                      </div>
                      {whatsappNumber && (
                        <a
                          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${storeName}! I'd like to confirm my order delivery details.`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/90 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat with us on WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                  </>)}
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="w-full py-4 rounded-full bg-blue-600 text-white font-medium text-base hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing…
                  </span>
                ) : paymentMethod === "pesapal" ? (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {isPartialPayment && partialAmount < total
                      ? `Pay ${format(payingNow)} deposit via Pesapal`
                      : `Pay ${format(total)} via Pesapal`}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Truck className="w-5 h-5" /> Place Order — Pay on Delivery
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-blue-800/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Payments secured by Pesapal · SSL encrypted</span>
              </div>
            </div>

            {/* ── Right: order summary ─────────────────────────────────────── */}
            <div className="lg:sticky lg:top-6 h-fit space-y-4">
              <div className="glass-panel-heavy rounded-3xl p-8 border border-white/50 space-y-5">
                <h2 className="text-2xl font-serif text-blue-950">Order Summary</h2>

                {/* Items */}
                <div className="space-y-4">
                  {bundles.map((bundle) => (
                    <div key={bundle.bundleId} className="flex items-center gap-3">
                      {bundle.imageUrl ? (
                        <img src={bundle.imageUrl} alt={bundle.bundleName}
                          className="w-14 h-14 rounded-xl object-cover bg-white/40 flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-blue-100/40 flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-blue-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100/70 rounded-full px-1.5 py-0.5">Bundle</span>
                          <p className="text-sm font-medium text-blue-950 truncate">{bundle.bundleName}</p>
                        </div>
                        <p className="text-xs text-blue-800/60">{bundle.products.length} items included</p>
                      </div>
                      <p className="text-sm font-semibold text-blue-950 flex-shrink-0">{format(bundle.price)}</p>
                    </div>
                  ))}
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name}
                          className="w-14 h-14 rounded-xl object-cover bg-white/40 flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-blue-100/40 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-950 truncate">{item.product.name}</p>
                        <p className="text-xs text-blue-800/60">{item.product.brand} · Qty {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-blue-950 flex-shrink-0">
                        {format(((item.product as Record<string,unknown>)["salePrice"] as number | null ?? item.product.price) * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-white/30 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-blue-800/70">
                    <span>Subtotal</span><span>{format(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount ({couponResult?.code})</span>
                      <span>−{format(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-blue-800/70">
                    <span>Shipping</span>
                    <span>
                      {freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold
                        ? <span className="text-green-600 font-medium">FREE</span>
                        : "TBD at delivery"}
                    </span>
                  </div>
                  {!(freeDeliveryThreshold > 0 && total >= freeDeliveryThreshold) && (
                    <div className="flex items-start gap-1.5 -mt-0.5">
                      <span className="text-sm leading-none mt-0.5 flex-shrink-0">📦</span>
                      <p className="text-xs text-blue-800/55 italic leading-snug">
                        Any delivery fee is agreed with you directly and paid to the delivery person on arrival — it is not charged here.
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-blue-950 text-base pt-2 border-t border-white/30">
                    <span>Order Total</span><span>{format(total)}</span>
                  </div>
                  {isOnline && isPartialPayment && partialAmount < total && (
                    <>
                      <div className="flex justify-between text-blue-700 font-semibold">
                        <span>Paying now (deposit)</span><span>{format(payingNow)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700">
                        <span>Balance at delivery</span><span>{format(balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Free delivery progress */}
                {freeDeliveryThreshold > 0 && total < freeDeliveryThreshold && (
                  <div className="flex items-center gap-2 glass-card rounded-xl px-4 py-3 bg-blue-50/20 border-blue-200/30">
                    <Truck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-800/70">
                      Add <strong>{format(freeDeliveryThreshold - total)}</strong> more for free delivery
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  
