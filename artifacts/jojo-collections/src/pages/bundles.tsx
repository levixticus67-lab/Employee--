import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { Layout } from "@/components/layout";
import { useCart, type BundleCartItem } from "@/components/cart-context";
import { useTheme } from "@/components/theme-context";
import { useCurrency } from "@/components/currency-context";
import { useListProducts } from "@workspace/api-client-react";
import { ShoppingBag, Package, Tag, Star, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type Bundle = {
  id: string; name: string; description: string; productIds: string[];
  price: number; imageUrl: string | null; active: boolean; createdAt: string;
};

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const { addBundleToCart } = useCart();
  const { format } = useCurrency();
  const [viewingBundle, setViewingBundle] = useState<Bundle | null>(null);
  const { theme } = useTheme();
  const [, navigate] = useLocation();
  const { data: allProducts } = useListProducts();

  useEffect(() => {
    apiFetch("/api/bundles")
      .then((r) => r.json())
      .then((data) => setBundles(Array.isArray(data) ? data.filter((b: Bundle) => b.active) : []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  }, []);

  const getBundleProducts = (bundle: Bundle) =>
    bundle.productIds.map((id) => allProducts?.find((p) => p.id === id)).filter(Boolean) as NonNullable<typeof allProducts>[number][];

  const handleAddBundle = (bundle: Bundle) => {
    const products = getBundleProducts(bundle);
    if (products.length === 0) { toast.error("Bundle products not available"); return; }
    const cartBundle: BundleCartItem = {
      bundleId: bundle.id,
      bundleName: bundle.name,
      price: bundle.price,
      imageUrl: bundle.imageUrl,
      productIds: bundle.productIds,
      products: products as any[],
    };
    addBundleToCart(cartBundle);
    toast.success(`${bundle.name} added to cart`, { description: `${products.length} items included` });
  };

  const calculateSavings = (bundle: Bundle) => {
    const products = getBundleProducts(bundle);
    if (!products.length) return 0;
    const total = products.reduce((sum, p) => sum + (p as any).price, 0);
    return Math.max(0, total - bundle.price);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-5xl font-serif text-foreground mb-4">Gift Sets & Bundles</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">Curated combinations of our finest fragrances at exclusive prices — perfect for gifting or treating yourself.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <Package className="w-16 h-16 text-blue-200 mx-auto mb-6" />
            <h2 className="text-2xl font-serif text-foreground mb-4">No bundles available</h2>
            <p className="text-muted-foreground">Check back soon for curated gift sets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {bundles.map((bundle) => {
              const savings = calculateSavings(bundle);
              const bundleProducts = getBundleProducts(bundle);
              return (
                <div key={bundle.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col group hover:shadow-2xl transition-shadow duration-300">
                  {/* Image area */}
                  <div className="relative h-56 bg-gradient-to-br from-blue-900/40 to-indigo-900/30 overflow-hidden">
                    {bundle.imageUrl ? (
                      <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-20 h-20 text-blue-200" />
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                        <Tag className="w-3 h-3" /> Save {format(savings)}
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                      {bundle.productIds.length} item{bundle.productIds.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1 gap-4">
                    <div>
                      <h2 className="text-2xl font-serif text-foreground mb-2 group-hover:text-sky-300 transition-colors">{bundle.name}</h2>
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{bundle.description}</p>
                    </div>

                    {/* Product avatar strip + View Items */}
                    {bundleProducts.length > 0 && (
                      <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2.5 border border-white/10">
                        <div className="flex items-center gap-2.5">
                          <div className="flex -space-x-2.5">
                            {bundleProducts.slice(0, 5).map((p) => (
                              (p as any).imageUrl
                                ? <img key={(p as any).id} src={(p as any).imageUrl} alt={(p as any).name} title={(p as any).name}
                                    className="w-8 h-8 rounded-full object-cover border-2 border-blue-950/70 bg-white/10" />
                                : <div key={(p as any).id} className="w-8 h-8 rounded-full bg-blue-800/50 border-2 border-blue-950/70 flex items-center justify-center">
                                    <Package className="w-3.5 h-3.5 text-blue-300/50" />
                                  </div>
                            ))}
                            {bundleProducts.length > 5 && (
                              <div className="w-8 h-8 rounded-full bg-blue-700/40 border-2 border-blue-950/70 flex items-center justify-center">
                                <span className="text-[10px] text-blue-200 font-bold">+{bundleProducts.length - 5}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-foreground/50">{bundleProducts.length} item{bundleProducts.length !== 1 ? "s" : ""}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingBundle(bundle); }}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-200 font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Items
                        </button>
                      </div>
                    )}

                    {/* Price and CTA */}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/30">
                      <div>
                        <p className="text-3xl font-bold text-foreground">{format(bundle.price)}</p>
                        {savings > 0 && (
                          <p className="text-xs text-red-500 font-medium">You save {format(savings)}</p>
                        )}
                      </div>
                      <Button onClick={() => handleAddBundle(bundle)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 py-3 flex items-center gap-2 text-sm font-semibold shadow-lg hover:shadow-blue-500/30 transition-all">
                        <ShoppingBag className="w-4 h-4" /> Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bundle Items Modal ── */}
      {viewingBundle && (() => {
        const vProducts = getBundleProducts(viewingBundle);
        const vSavings  = calculateSavings(viewingBundle);
        const isGold      = theme === "gold";
        const panelBg     = isGold ? "rgba(52,22,3,0.97)"     : "rgba(8,15,30,0.97)";
        const panelBorder = isGold ? "rgba(251,191,36,0.30)"  : "rgba(255,255,255,0.15)";
        const footerBg    = isGold ? "rgba(35,12,0,0.65)"      : "rgba(0,0,0,0.42)";
        const divider     = isGold ? "rgba(251,191,36,0.12)"  : "rgba(255,255,255,0.10)";
        const modal = (
          <div
            className="fixed inset-0 flex items-end sm:items-center justify-center pb-16 sm:pb-0"
            style={{ zIndex: 9999 }}
            onClick={() => setViewingBundle(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Sheet */}
            <div
              className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "88vh", background: panelBg, border: `1px solid ${panelBorder}` }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 flex-shrink-0"
                style={{ borderBottom: `1px solid ${divider}` }}>
                <div>
                  <h3 className="text-xl font-serif text-foreground leading-tight">{viewingBundle.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vProducts.length} item{vProducts.length !== 1 ? "s" : ""} in this bundle
                  </p>
                </div>
                <button
                  onClick={() => setViewingBundle(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-muted-foreground transition-colors flex-shrink-0 ml-3"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product list */}
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {vProducts.map((p) => (
                  <div
                    key={(p as any).id}
                    className="glass-card flex gap-3 rounded-2xl p-3 cursor-pointer active:opacity-70 transition-opacity"
                    onClick={() => { if ((p as any).id) { setViewingBundle(null); navigate(`/product/${(p as any).id}`); } }}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                      {(p as any).imageUrl
                        ? <img src={(p as any).imageUrl} alt={(p as any).name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground/40" />
                          </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {(p as any).brand && (
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-0.5">
                          {(p as any).brand}
                        </p>
                      )}
                      <h4 className="text-sm font-serif text-foreground leading-snug">{(p as any).name}</h4>
                      {(p as any).description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {(p as any).description}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-sm font-semibold text-foreground/80">{format((p as any).price)}</p>
                        <span className="text-muted-foreground/50 text-xs">View →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                className="flex-shrink-0 p-5"
                style={{ borderTop: `1px solid ${divider}`, background: footerBg }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{format(viewingBundle.price)}</p>
                    {vSavings > 0 && (
                      <p className="text-xs text-red-400 font-medium mt-0.5">
                        Save {format(vSavings)} vs buying separately
                      </p>
                    )}
                  </div>
                  {vSavings > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      <span className="text-xs font-bold">Bundle Deal</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => { handleAddBundle(viewingBundle); setViewingBundle(null); }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl py-3 h-auto flex items-center justify-center gap-2 text-base font-semibold shadow-lg transition-all"
                >
                  <ShoppingBag className="w-5 h-5" /> Add Bundle to Cart
                </Button>
              </div>
            </div>
          </div>
        );
        return createPortal(modal, document.body);
      })()}
    </Layout>
  );
}
