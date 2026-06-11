import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useListFeaturedProducts, useListNewArrivals, useListProducts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/currency-context";
import { useWishlist } from "@/components/wishlist-context";
import { Flame, Package, Heart, Tag } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  return <span className="font-mono text-orange-400 font-bold text-sm">{timeLeft}</span>;
}

export default function Home() {
  const { data: featuredProducts } = useListFeaturedProducts();
  const { data: newArrivals } = useListNewArrivals();
  const { data: allProducts } = useListProducts();
  const { format } = useCurrency();
  const { toggle, isWishlisted } = useWishlist();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [storeName, setStoreName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    apiFetch("/api/bundles")
      .then((r) => r.json())
      .then((data) => setBundles(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        const imgs = [d.heroImage1, d.heroImage2, d.heroImage3].filter(Boolean);
        if (imgs.length > 0) setHeroImages(imgs);
        if (d.storeName) setStoreName(d.storeName);
        if (d.logoUrl) setLogoUrl(d.logoUrl);
      })
      .catch(() => {});
  }, []);

  const now = new Date().toISOString();
  const flashSales = allProducts?.filter((p: any) => p.salePrice && (p.saleEndsAt === null || p.saleEndsAt > now)) ?? [];

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative pt-10 md:pt-16 pb-4 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col items-center text-center">

        {/* Mobile-only: logo + store name above "Premium Fragrances" */}
        <div className="md:hidden flex flex-col items-center mb-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="rounded-full object-cover border-2 border-sky-400/30 shadow-lg mb-3"
              style={{ width: 64, height: 64 }}
            />
          ) : (
            <div
              className="rounded-full border-2 border-sky-400/30 flex items-center justify-center mb-3 text-sky-200 font-bold text-xl"
              style={{ width: 64, height: 64, background: "rgba(125,211,252,0.1)" }}
            >
              {(storeName || "L").charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className="text-2xl font-bold tracking-widest text-sky-50"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {(storeName || "LENZ").toUpperCase()}
          </span>
        </div>

        <p className="text-sky-400 text-xs tracking-[0.35em] uppercase mb-7">Premium Fragrances</p>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-light text-sky-50 leading-[1.1] mb-1">
          The Essence
        </h1>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-light text-sky-50 leading-[1.1] mb-1">
          of
        </h1>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-extralight text-blue-400 italic leading-[1.15] mb-9">
          Elegance
        </h1>

        <p className="text-sky-200/55 text-base md:text-lg mb-10 max-w-lg mx-auto font-light leading-relaxed">
          Discover our hand-curated collection of premium fragrances,
          crafted for the modern connoisseur.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <Link href="/shop">
            <Button size="lg" className="rounded-full px-9 bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30 font-medium">
              Explore Collection
            </Button>
          </Link>
          <Link href="/bundles">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-9 font-medium border-sky-400/50 text-sky-100 bg-white/10 hover:bg-white/18 hover:border-sky-400/80 hover:text-sky-50 transition-all"
            >
              Gift Sets
            </Button>
          </Link>
        </div>

        {/* Admin-controlled hero images */}
        {heroImages.length > 0 && (
          <div className="flex items-end justify-center gap-4 sm:gap-6">
            {heroImages.map((url, i) => {
              const isCenter = heroImages.length === 1 || i === Math.floor(heroImages.length / 2);
              return (
                <img
                  key={i}
                  src={url}
                  alt={`Featured fragrance ${i + 1}`}
                  className="object-contain drop-shadow-2xl select-none"
                  style={{
                    width: isCenter ? (heroImages.length === 1 ? 140 : 120) : 88,
                    height: isCenter ? (heroImages.length === 1 ? 200 : 180) : 130,
                    opacity: isCenter ? 1 : 0.72,
                    filter: isCenter ? "drop-shadow(0 0 22px rgba(59,130,246,0.4))" : undefined,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Flash Sales ── */}
      {flashSales.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-serif text-sky-50 flex items-center gap-3">
              <Flame className="w-7 h-7 text-orange-400" /> Flash Sales
            </h2>
            <Link href="/shop" className="text-blue-400 hover:text-blue-300 text-sm font-medium uppercase tracking-wider">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {flashSales.slice(0, 4).map((product: any) => (
              <Link key={product.id} href={`/product/${product.id}`}>
                <div className="glass-card rounded-2xl p-3 sm:p-5 group cursor-pointer relative">
                  <div className="absolute top-2 left-2 z-10 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {Math.round(((product.price - product.salePrice) / product.price) * 100)}% OFF
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-2 right-2 z-10 p-1.5 rounded-full ${isWishlisted(product.id) ? "text-red-400 bg-red-900/30" : "text-sky-400/60 hover:text-red-400 bg-white/10"}`}>
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>
                  <div className="aspect-square rounded-xl bg-white/5 mb-3 overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2 drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><span className="text-sky-400/40 font-serif italic">No image</span></div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">{product.brand}</p>
                  <h3 className="text-sm font-serif text-sky-100 truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-orange-400">{format(product.salePrice)}</span>
                    <span className="text-sm text-sky-400/50 line-through">{format(product.price)}</span>
                  </div>
                  {product.saleEndsAt && (
                    <div className="mt-1 text-xs text-sky-300/50">Ends in <CountdownTimer endsAt={product.saleEndsAt} /></div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured Curations ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl font-serif text-sky-50">Featured Curations</h2>
          <Link href="/shop?featured=true" className="text-blue-400 hover:text-blue-300 text-sm font-medium uppercase tracking-wider">View All</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
          {featuredProducts?.map((product: any) => {
            const isOnSale = product.salePrice && (product.saleEndsAt === null || product.saleEndsAt > now);
            return (
              <Link key={product.id} href={`/product/${product.id}`}>
                <div className="glass-card rounded-2xl p-3 sm:p-6 group cursor-pointer h-full flex flex-col relative">
                  <button onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-2 right-2 z-10 p-1.5 rounded-full ${isWishlisted(product.id) ? "text-red-400 bg-red-900/30" : "text-sky-400/50 hover:text-red-400 bg-white/10"}`}>
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>
                  <div className="aspect-square rounded-xl bg-white/5 mb-3 sm:mb-5 overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2 sm:p-4 drop-shadow-xl transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><span className="text-sky-400/40 font-serif italic text-lg">No image</span></div>
                    )}
                  </div>
                  <div className="text-center mt-auto">
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">{product.brand}</p>
                    <h3 className="text-base sm:text-xl font-serif text-sky-100 mb-2 leading-snug">{product.name}</h3>
                    <div className="flex items-center justify-center gap-2">
                      {isOnSale ? (
                        <>
                          <span className="text-orange-400 font-semibold">{format(product.salePrice)}</span>
                          <span className="text-sky-400/50 text-sm line-through">{format(product.price)}</span>
                        </>
                      ) : (
                        <span className="text-sky-200/80">{format(product.price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Bundles ── */}
      {bundles.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-serif text-sky-50 flex items-center gap-3">
              <Package className="w-7 h-7 text-blue-400" /> Gift Sets & Bundles
            </h2>
            <Link href="/bundles" className="text-blue-400 hover:text-blue-300 text-sm font-medium uppercase tracking-wider">View All</Link>
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
                    <div className="aspect-[16/9] bg-gradient-to-br from-blue-900/40 to-blue-800/20 flex items-center justify-center">
                      <Package className="w-12 h-12 text-blue-400/40" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-serif text-lg text-sky-100 mb-1">{bundle.name}</h3>
                    <p className="text-sm text-sky-300/50 line-clamp-2 mb-3">{bundle.description}</p>
                    {/* Product avatar strip */}
                    {(() => {
                      const prods = bundle.productIds.map(id => allProducts?.find((p: any) => p.id === id)).filter(Boolean) as any[];
                      if (!prods.length) return null;
                      return (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex -space-x-2">
                            {prods.slice(0, 5).map((p: any) => (
                              p.imageUrl
                                ? <img key={p.id} src={p.imageUrl} alt={p.name} title={p.name} className="w-7 h-7 rounded-full object-cover border-2 border-blue-900/60 bg-white/10 ring-1 ring-white/10" />
                                : <div key={p.id} className="w-7 h-7 rounded-full bg-blue-800/50 border-2 border-blue-900/60 flex items-center justify-center"><Package className="w-3 h-3 text-blue-300/50" /></div>
                            ))}
                            {prods.length > 5 && (
                              <div className="w-7 h-7 rounded-full bg-blue-700/40 border-2 border-blue-900/60 flex items-center justify-center">
                                <span className="text-[9px] text-blue-200 font-bold">+{prods.length - 5}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-sky-300/55 truncate">
                            {prods.slice(0, 2).map((p: any) => p.name).join(' · ')}{prods.length > 2 ? ` +${prods.length - 2} more` : ''}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-sky-200 font-semibold">{format(bundle.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── New Arrivals ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <h2 className="text-3xl font-serif text-sky-50 mb-12 text-center">New Arrivals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {newArrivals?.map((product: any) => (
            <Link key={product.id} href={`/product/${product.id}`}>
              <div className="glass-card rounded-2xl p-3 sm:p-4 group cursor-pointer hover:bg-white/10 transition-colors h-full flex flex-col">
                <div className="aspect-square rounded-xl bg-white/5 mb-3 overflow-hidden relative">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2 drop-shadow-lg transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><span className="text-sky-400/40 font-serif italic">Glass</span></div>
                  )}
                </div>
                <div className="text-center mt-auto">
                  <h3 className="text-sm font-serif text-sky-100 truncate px-1">{product.name}</h3>
                  <p className="text-sm text-sky-300/60 mt-1">{format(product.salePrice ?? product.price)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
