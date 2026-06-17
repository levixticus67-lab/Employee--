import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, Truck, Gift, MapPin, Package } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CldImg } from "@/components/cld-img";

export default function Cart() {
  const { items, bundles, updateQuantity, removeFromCart, removeBundleFromCart, subtotal, totalItems } = useCart();
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);
  const [locationDeliveryThreshold, setLocationDeliveryThreshold] = useState(0);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        setFreeDeliveryThreshold(Number(d.freeDeliveryThreshold ?? 0));
        setLocationDeliveryThreshold(Number(d.locationDeliveryThreshold ?? 0));
      })
      .catch(() => {});
  }, []);

  const qualifiesNationwideFree = freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold;
  const qualifiesLocationBased  = locationDeliveryThreshold > 0 && subtotal >= locationDeliveryThreshold && !qualifiesNationwideFree;
  const amountToFree = freeDeliveryThreshold > 0 ? Math.max(0, freeDeliveryThreshold - subtotal) : 0;
  const isEmpty = items.length === 0 && bundles.length === 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8">Your Cart</h1>

        {isEmpty ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-blue-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-serif text-blue-950 mb-4">Your cart is empty</h2>
            <Link href="/shop">
              <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Delivery banner ──────────────────────────────────────────── */}
            {qualifiesNationwideFree && (
              <div className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 bg-green-50/40 border border-green-200/60">
                <Gift className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">You qualify for free delivery anywhere in the country!</p>
                  <p className="text-xs text-green-700/80 mt-0.5">Your order will be shipped at no extra delivery cost, nationwide.</p>
                </div>
              </div>
            )}

            {qualifiesLocationBased && (
              <div className="mb-6 rounded-2xl px-5 py-4 flex items-start gap-3 bg-blue-50/40 border border-blue-200/50">
                <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">You could get free delivery depending on your location!</p>
                  <p className="text-xs text-blue-800/70 mt-0.5">
                    The store will review your order and location — delivery may be on us.
                    {freeDeliveryThreshold > 0 && amountToFree > 0 && (
                      <> Add <span className="font-bold">${amountToFree.toFixed(2)}</span> more to guarantee free delivery nationwide.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {!qualifiesNationwideFree && !qualifiesLocationBased && freeDeliveryThreshold > 0 && (
              <div className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 bg-orange-50/30 border border-orange-200/50">
                <Truck className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-sm text-orange-800">
                  Add <span className="font-bold">${amountToFree.toFixed(2)}</span> more to your cart for{" "}
                  <span className="font-bold">free delivery</span> anywhere in the country!
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-4">
                {/* Regular items */}
                {items.map((item) => (
                  <div key={item.product.id} className="glass-panel rounded-2xl p-4 flex gap-4 items-center border-white/40 relative">
                    <div className="w-24 h-24 glass-card rounded-xl overflow-hidden flex-shrink-0 p-2">
                      {item.product.imageUrl ? (
                        <CldImg src={item.product.imageUrl} w={200} alt={item.product.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-blue-50/50 rounded flex items-center justify-center text-xs text-blue-400">No Img</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-serif text-blue-950 text-lg">{item.product.name}</h3>
                      <p className="text-sm text-blue-800/70 mb-2">{item.product.brand}</p>
                      <p className="font-medium text-blue-900">${item.product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="glass-panel flex items-center rounded-full px-1 py-0.5 border-white/50">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1.5 text-blue-800 hover:text-blue-950 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-medium text-blue-950 text-sm w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))} className="p-1.5 text-blue-800 hover:text-blue-950 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Bundle items — shown as single entries */}
                {bundles.map((bundle) => (
                  <div key={bundle.bundleId} className="glass-panel rounded-2xl p-4 border-white/40 relative">
                    <div className="flex gap-4 items-start">
                      <div className="w-24 h-24 glass-card rounded-xl overflow-hidden flex-shrink-0 p-2 bg-gradient-to-br from-blue-50 to-indigo-100">
                        {bundle.imageUrl ? (
                          <CldImg src={bundle.imageUrl} w={200} alt={bundle.bundleName} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-blue-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-100/70 rounded-full px-2 py-0.5">Bundle</span>
                          <h3 className="font-serif text-blue-950 text-lg">{bundle.bundleName}</h3>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {bundle.products.slice(0, 5).map((p) => (
                            <span key={(p as any).id} className="text-xs text-blue-800/70 bg-white/40 rounded-full px-2 py-0.5 border border-white/50">
                              {(p as any).name}
                            </span>
                          ))}
                          {bundle.products.length > 5 && (
                            <span className="text-xs text-blue-600 bg-blue-50/60 rounded-full px-2 py-0.5">
                              +{bundle.products.length - 5} more
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-blue-900">${bundle.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeBundleFromCart(bundle.bundleId)} className="text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="md:col-span-1">
                <div className="glass-panel-heavy rounded-2xl p-6 border-white/50 sticky top-24">
                  <h3 className="text-lg font-serif text-blue-950 mb-4">Order Summary</h3>
                  <div className="space-y-3 text-sm text-blue-900/80 mb-4">
                    <div className="flex justify-between">
                      <span>Items ({totalItems})</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Delivery</span>
                      {qualifiesNationwideFree ? (
                        <span className="text-green-700 font-semibold flex items-center gap-1 text-xs"><Gift className="w-3 h-3" /> Free nationwide</span>
                      ) : qualifiesLocationBased ? (
                        <span className="text-blue-600 text-xs flex items-center gap-1 italic"><MapPin className="w-3 h-3" /> May be free</span>
                      ) : (
                        <span className="text-xs italic text-blue-700/60">Confirmed after order</span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-white/30 pt-4 mb-6 flex justify-between items-center">
                    <span className="font-medium text-blue-950">Subtotal</span>
                    <span className="text-xl font-medium text-blue-950">${subtotal.toFixed(2)}</span>
                  </div>
                  <Link href="/checkout">
                    <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md">
                      Proceed to Checkout
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
