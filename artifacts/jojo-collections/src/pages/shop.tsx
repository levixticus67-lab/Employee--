import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useWishlist } from "@/components/wishlist-context";
import { useCurrency } from "@/components/currency-context";
import { Search, Filter, Heart, Flame, Tag } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CldImg } from "@/components/cld-img";

const CATEGORIES = ["All", "Eau de Parfum", "Eau de Toilette", "Body Mist"];

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return <span className="text-xs font-mono text-orange-400">{timeLeft}</span>;
}

export default function Shop() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [collection, setCollection] = useState("All");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const { toggle, isWishlisted } = useWishlist();
  const { format } = useCurrency();

  const { data: products, isLoading } = useListProducts({
    search: search || undefined,
    category: category !== "All" ? category : undefined,
  });

  useEffect(() => {
    apiFetch("/api/products/collections")
      .then((r) => r.json())
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const now = new Date().toISOString();
  const filtered = products?.filter((p) => {
    if (collection !== "All" && (p as any).collection !== collection) return false;
    if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
    return true;
  }) ?? [];

  const flashSales = products?.filter((p: any) => p.salePrice && (p.saleEndsAt === null || p.saleEndsAt > now)) ?? [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-serif text-sky-50 mb-6 sm:mb-8 text-center">Our Collection</h1>

        {/* Flash Sales Banner */}
        {flashSales.length > 0 && (
          <div className="mb-8 glass-card rounded-2xl p-4 border border-orange-400/20">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-400" />
              <h2 className="font-semibold text-orange-300">Flash Sales</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {flashSales.map((p: any) => (
                <Link key={p.id} href={`/product/${p.id}`}>
                  <div className="flex-shrink-0 w-32 glass-card rounded-xl p-2 cursor-pointer hover:bg-white/10 transition-colors">
                    {p.imageUrl && (
                      <div className="aspect-square bg-white/5 rounded-lg mb-2 overflow-hidden relative">
                        <CldImg src={p.imageUrl} w={120} alt={p.name} className="absolute inset-0 w-full h-full object-contain p-1" />
                      </div>
                    )}
                    <p className="text-xs font-serif text-sky-100 truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-bold text-orange-400">{format(p.salePrice)}</span>
                      <span className="text-xs text-sky-400/50 line-through">{format(p.price)}</span>
                    </div>
                    {p.saleEndsAt && <div className="mt-1"><CountdownTimer endsAt={p.saleEndsAt} /></div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 mb-8 sm:mb-12">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "glass-card text-sky-200 hover:bg-white/10"}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:w-56">
                <input type="text" placeholder="Search fragrances..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full glass-card rounded-full py-2.5 pl-10 pr-4 text-sky-100 placeholder:text-sky-400/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border-white/10 bg-white/5" />
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-sky-400/50" />
              </div>

              {/* Advanced Filter Toggle */}
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${showFilters ? "bg-blue-500 text-white" : "glass-card text-sky-200 hover:bg-white/10"}`}>
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="border-t border-white/10 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-sky-300/60 mb-1 uppercase tracking-wider">Collection</label>
                  <select value={collection} onChange={(e) => setCollection(e.target.value)}
                    className="w-full glass-card rounded-lg px-3 py-2 text-sm text-sky-100 border-white/10 focus:ring-2 focus:ring-blue-500/50 focus:outline-none bg-slate-900/50">
                    <option value="All" className="bg-slate-900">All Collections</option>
                    {collections.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-sky-300/60 mb-1 uppercase tracking-wider">
                  Price: ${priceRange[0]} – ${priceRange[1]}
                </label>
                <div className="flex gap-2">
                  <input type="range" min="0" max="1000" step="10" value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="flex-1 accent-blue-400" />
                  <input type="range" min="0" max="1000" step="10" value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="flex-1 accent-blue-400" />
                </div>
              </div>

              <div className="flex items-end">
                <button onClick={() => { setCollection("All"); setPriceRange([0, 1000]); setSearch(""); setCategory("All"); }}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result count */}
        {!isLoading && (
          <p className="text-sm text-sky-300/50 mb-4 sm:mb-6">{filtered.length} product{filtered.length !== 1 ? "s" : ""} found</p>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-serif text-sky-100 mb-2">No fragrances found</h2>
            <p className="text-sky-300/60">Try adjusting your filters.</p>
          </div>
        ) : (
          /* 2-column on mobile, 3 on lg, 4 on xl */
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filtered.map((product) => {
              const p = product as any;
              const isOnSale = p.salePrice && (p.saleEndsAt === null || p.saleEndsAt > now);
              return (
                <div key={product.id} className="glass-card rounded-2xl overflow-hidden group flex flex-col relative">
                  {/* Sale badge */}
                  {isOnSale && (
                    <div className="absolute top-2 left-2 z-10 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      -{Math.round(((p.price - p.salePrice) / p.price) * 100)}%
                    </div>
                  )}

                  {/* Wishlist button */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all ${isWishlisted(product.id) ? "text-red-400 bg-red-900/30" : "text-sky-400/60 hover:text-red-400 bg-white/10"}`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>

                  <Link href={`/product/${product.id}`} className="flex flex-col flex-1">
                    {/* Square image — full width, aspect-square, object-contain, nothing cropped */}
                    <div className="aspect-square bg-white/5 overflow-hidden relative">
                      {product.imageUrl ? (
                        <CldImg
                          src={product.imageUrl} w={400}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3 drop-shadow-lg transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sky-400/30 font-serif italic text-sm">No image</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2 sm:p-4 text-center flex flex-col flex-1">
                      <p className="text-[10px] sm:text-xs font-semibold text-blue-400 uppercase tracking-widest mb-0.5">{product.brand}</p>
                      <h3 className="text-sm sm:text-base font-serif text-sky-100 mb-0.5 sm:mb-1 leading-snug line-clamp-2">{product.name}</h3>
                      <p className="text-[10px] sm:text-xs text-sky-300/50 mb-1">{product.category}</p>
                      {p.collection && <p className="text-[10px] sm:text-xs text-blue-400/60 mb-1">{p.collection}</p>}
                      <div className="flex items-center justify-center gap-1.5 mt-auto">
                        {isOnSale ? (
                          <>
                            <span className="text-orange-400 font-semibold text-sm">{format(p.salePrice)}</span>
                            <span className="text-sky-400/40 line-through text-xs">{format(product.price)}</span>
                          </>
                        ) : (
                          <span className="text-sky-200 font-medium text-sm">{format(product.price)}</span>
                        )}
                      </div>
                    </div>
                  </Link>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
