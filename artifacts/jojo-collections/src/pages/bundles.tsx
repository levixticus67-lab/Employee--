import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { useListProducts } from "@workspace/api-client-react";
import { ShoppingBag, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Bundle = {
  id: string;
  name: string;
  description: string;
  productIds: string[];
  price: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
};

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { format } = useCurrency();
  const { data: allProducts } = useListProducts();

  useEffect(() => {
    fetch("/api/bundles")
      .then((r) => r.json())
      .then((data) => setBundles(Array.isArray(data) ? data : []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAddBundle = (bundle: Bundle) => {
    const products = bundle.productIds
      .map((id) => allProducts?.find((p) => p.id === id))
      .filter(Boolean) as ReturnType<typeof useListProducts>["data"] extends (infer U)[] | undefined ? U[] : never[];
    if (products.length === 0) {
      toast.error("Bundle products not available");
      return;
    }
    products.forEach((p) => addToCart(p as any, 1));
    toast.success(`${bundle.name} added to cart`, { description: `${products.length} items added` });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-2 text-center">Gift Sets & Bundles</h1>
        <p className="text-center text-blue-800/60 mb-12">Curated combinations at special prices</p>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {bundles.map((bundle) => {
              const bundleProducts = bundle.productIds
                .map((id) => allProducts?.find((p) => p.id === id))
                .filter(Boolean);
              const originalTotal = bundleProducts.reduce((s, p: any) => s + (p?.price ?? 0), 0);
              const savings = originalTotal > bundle.price ? originalTotal - bundle.price : 0;

              return (
                <div key={bundle.id} className="glass-card rounded-3xl p-6 flex flex-col">
                  {bundle.imageUrl ? (
                    <div className="aspect-[16/9] rounded-xl overflow-hidden mb-5">
                      <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-5">
                      <Package className="w-12 h-12 text-blue-400" />
                    </div>
                  )}

                  <h2 className="text-2xl font-serif text-blue-950 mb-2">{bundle.name}</h2>
                  <p className="text-blue-800/70 text-sm mb-4">{bundle.description}</p>

                  {bundleProducts.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Includes</p>
                      <div className="space-y-1">
                        {bundleProducts.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm text-blue-900/80">
                            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-6 h-6 object-contain rounded" />}
                            <span>{p.name}</span>
                            <span className="ml-auto text-blue-800/50">{format(p.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-2xl font-serif text-blue-950">{format(bundle.price)}</span>
                        {savings > 0 && (
                          <span className="ml-2 text-sm text-green-600 font-medium">Save {format(savings)}</span>
                        )}
                      </div>
                      {originalTotal > bundle.price && (
                        <span className="text-sm text-blue-400 line-through">{format(originalTotal)}</span>
                      )}
                    </div>
                    <Button
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleAddBundle(bundle)}
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Add Bundle to Cart
                    </Button>
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
