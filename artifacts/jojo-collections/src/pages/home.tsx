import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useListFeaturedProducts, useListNewArrivals, useListProducts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/currency-context";
import { useWishlist } from "@/components/wishlist-context";
import { Flame, Package, Heart, Tag } from "lucide-react";

type Bundle = { id: string; name: string; description: string; productIds: string[]; price: number; imageUrl: string | null; active: boolean };

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span className="font-mono text-orange-700 font-bold text-sm">{timeLeft}</span>;
}

export default function Home() {
  const { data: featuredProducts } = useListFeaturedProducts();
  const { data: newArrivals } = useListNewArrivals();
  const { data: allProducts } = useListProducts();
  const { format } = useCurrency();
  const { toggle, isWishlisted } = useWishlist();
  const [bundles, setBundles] = useState<Bundle[]>([]);

  useEffect(() => {
    fetch("/api/bundles")
      .then((r) => r.json())
      .then((data) => setBundles(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  const now = new Date().toISOString();
  const flashSales = allProducts?.filter((p: any) => p.salePrice && (p.saleEndsAt === null || p.saleEndsAt > now)) ?? [];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center flex flex-col items-center">
        <div className="glass-card p-12 md:p-20 rounded-3xl max-w-4xl border-white/40 shadow-xl shadow-blue-900/10">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-blue-950 mb-6 leading-tight">
            The Essence of <br /> <span className="text-blue-700 italic font-light">Elegance</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-900/80 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Discover our hand-curated collection of premium fragrances.
            Crafted for the modern connoisseur, each bottle tells a story of luminous beauty and subtle power.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop">
              <Button size="lg" className="rounded-full px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30">
                Explore Collection
              </Button>
            </Link>
            <Link href="/bundles">
              <Button size="lg" variant="outline" className="rounded-full px-8 glass-card text-blue-900 border-white/40">
                Gift Sets
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Flash Sales Section */}
      {flashSales.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-serif text-blue-950 flex items-center gap-3">
              <Flame className="w-7 h-7 text-orange-500" /> Flash Sales
            </h2>
            <Link href="/shop" className="text-blue-600 hover:text-blue-800 text-sm font-medium uppercase tracking-wider">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {flashSales.slice(0, 4).map((product: any) => (
              <Link key={product.id} href={`/product/${product.id}`}>
                <div className="glass-card rounded-2xl p-5 group cursor-pointer relative">
                  <div className="absolute top-3 left-3 z-10 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {Math.round(((product.price - product.salePrice) / product.price) * 100)}% OFF
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-3 right-3 z-10 p-1.5 rounded-full ${isWishlisted(product.id) ? "text-red-500 bg-red-50" : "text-blue-200 hover:text-red-400 bg-white/30"}`}>
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>
                  <div className="aspect-square rounded-xl bg-white/40 mb-4 overflow-hidden flex items-center justify-center p-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full glass-panel rounded-lg flex items-center justify-center">
                        <span className="text-blue-300 font-serif italic">Glass</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">{product.brand}</p>
                  <h3 className="text-md font-serif text-blue-950 truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-orange-600">{format(product.salePrice)}</span>
                    <span className="text-sm text-blue-400 line-through">{format(product.price)}</span>
                  </div>
                  {product.saleEndsAt && (
                    <div className="mt-1 text-xs text-orange-800/70">
                      Ends in <CountdownTimer endsAt={product.saleEndsAt} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl font-serif text-blue-950">Featured Curations</h2>
          <Link href="/shop?featured=true" className="text-blue-600 hover:text-blue-800 text-sm font-medium uppercase tracking-wider">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts?.map((product: any) => {
            const isOnSale = product.salePrice && (product.saleEndsAt === null || product.saleEndsAt > now);
            return (
              <Link key={product.id} href={`/product/${product.id}`}>
                <div className="glass-card rounded-2xl p-6 group cursor-pointer h-full flex flex-col relative">
                  <button onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-3 right-3 z-10 p-1.5 rounded-full ${isWishlisted(product.id) ? "text-red-500 bg-red-50" : "text-blue-200 hover:text-red-400 bg-white/30"}`}>
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>
                  <div className="aspect-[4/5] rounded-xl bg-white/40 mb-6 overflow-hidden flex items-center justify-center p-8 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/50 to-white/20 z-0" />
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full drop-shadow-xl z-10 transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full glass-panel rounded-lg z-10 flex items-center justify-center">
                        <span className="text-blue-300 font-serif italic text-lg">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center mt-auto">
                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">{product.brand}</p>
                    <h3 className="text-xl font-serif text-blue-950 mb-2">{product.name}</h3>
                    <div className="flex items-center justify-center gap-2">
                      {isOnSale ? (
                        <>
                          <span className="text-orange-600 font-semibold">{format(product.salePrice)}</span>
                          <span className="text-blue-400 text-sm line-through">{format(product.price)}</span>
                        </>
                      ) : (
                        <span className="text-blue-900/80">{format(product.price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bundles Section */}
      {bundles.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/20">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-serif text-blue-950 flex items-center gap-3">
              <Package className="w-7 h-7 text-blue-600" /> Gift Sets & Bundles
            </h2>
            <Link href="/bundles" className="text-blue-600 hover:text-blue-800 text-sm font-medium uppercase tracking-wider">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((bundle) => (
              <Link key={bundle.id} href="/bundles">
                <div className="glass-card rounded-2xl overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                  {bundle.imageUrl ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                      <Package className="w-12 h-12 text-blue-400" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-serif text-lg text-blue-950 mb-1">{bundle.name}</h3>
                    <p className="text-sm text-blue-800/60 truncate mb-2">{bundle.description}</p>
                    <span className="text-blue-900 font-semibold">{format(bundle.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/20">
        <h2 className="text-3xl font-serif text-blue-950 mb-12 text-center">New Arrivals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {newArrivals?.map((product: any) => (
            <Link key={product.id} href={`/product/${product.id}`}>
              <div className="glass-panel rounded-2xl p-4 group cursor-pointer hover:bg-white/40 transition-colors h-full flex flex-col">
                <div className="aspect-square rounded-xl bg-white/30 mb-4 overflow-hidden flex items-center justify-center p-4">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full glass-panel rounded-lg flex items-center justify-center">
                      <span className="text-blue-300 font-serif italic">Glass</span>
                    </div>
                  )}
                </div>
                <div className="text-center mt-auto">
                  <h3 className="text-md font-serif text-blue-950 truncate px-2">{product.name}</h3>
                  <p className="text-sm text-blue-800/60 mt-1">{format(product.salePrice ?? product.price)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
