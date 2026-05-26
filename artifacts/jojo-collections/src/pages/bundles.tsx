import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useCart, type BundleCartItem } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { useListProducts } from "@workspace/api-client-react";
import { ShoppingBag, Package, Tag, Star } from "lucide-react";
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
          <h1 className="text-5xl font-serif text-blue-950 mb-4">Gift Sets & Bundles</h1>
          <p className="text-blue-800/60 text-lg max-w-xl mx-auto">Curated combinations of our finest fragrances at exclusive prices — perfect for gifting or treating yourself.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <Package className="w-16 h-16 text-blue-200 mx-auto mb-6" />
            <h2 className="text-2xl font-serif text-blue-950 mb-4">No bundles available</h2>
            <p className="text-blue-800/60">Check back soon for curated gift sets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {bundles.map((bundle) => {
              const savings = calculateSavings(bundle);
              const bundleProducts = getBundleProducts(bundle);
              return (
                <div key={bundle.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col group hover:shadow-2xl transition-shadow duration-300">
                  {/* Image area */}
                  <div className="relative h-56 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
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
                    <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm text-blue-950 text-xs font-semibold px-3 py-1.5 rounded-full">
                      {bundle.productIds.length} item{bundle.productIds.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1 gap-4">
                    <div>
                      <h2 className="text-2xl font-serif text-blue-950 mb-2 group-hover:text-blue-700 transition-colors">{bundle.name}</h2>
                      <p className="text-blue-800/60 text-sm leading-relaxed line-clamp-3">{bundle.description}</p>
                    </div>

                    {/* Products included */}
                    {bundleProducts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-blue-900/60 uppercase tracking-wider">Includes</p>
                        <div className="flex flex-wrap gap-2">
                          {bundleProducts.slice(0, 4).map((p) => (
                            <div key={(p as any).id} className="flex items-center gap-1.5 bg-white/40 backdrop-blur-sm rounded-full px-3 py-1 border border-white/50">
                              {(p as any).imageUrl && <img src={(p as any).imageUrl} alt={(p as any).name} className="w-5 h-5 rounded-full object-cover" />}
                              <span className="text-xs text-blue-900 font-medium">{(p as any).name}</span>
                            </div>
                          ))}
                          {bundleProducts.length > 4 && (
                            <div className="flex items-center bg-blue-50/60 rounded-full px-3 py-1">
                              <span className="text-xs text-blue-600 font-medium">+{bundleProducts.length - 4} more</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Price and CTA */}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/30">
                      <div>
                        <p className="text-3xl font-bold text-blue-950">{format(bundle.price)}</p>
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
    </Layout>
  );
}
