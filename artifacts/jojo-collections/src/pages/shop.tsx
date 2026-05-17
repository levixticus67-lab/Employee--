import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useWishlist } from "@/components/wishlist-context";
import { useCurrency } from "@/components/currency-context";
import { Search, Filter, Heart, Flame, Tag } from "lucide-react";

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

  return <span className="text-xs font-mono text-orange-700">{timeLeft}</span>;
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
    fetch("/api/products/collections")
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Our Collection</h1>

        {/* Flash Sales Banner */}
        {flashSales.length > 0 && (
          <div className="mb-8 glass-panel rounded-2xl p-4 border border-orange-200/50 bg-orange-50/30">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-orange-900">Flash Sales</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {flashSales.map((p: any) => (
                <Link key={p.id} href={`/product/${p.id}`}>
                  <div className="flex-shrink-0 w-36 glass-card rounded-xl p-3 cursor-pointer hover:bg-white/40 transition-colors">
                    {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-20 object-contain mb-2" />}
                    <p className="text-xs font-serif text-blue-950 truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-bold text-orange-600">{format(p.salePrice)}</span>
                      <span className="text-xs text-blue-400 line-through">{format(p.price)}</span>
                    </div>
                    {p.saleEndsAt && <div className="mt-1"><CountdownTimer endsAt={p.saleEndsAt} /></div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-panel rounded-2xl p-6 mb-12">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "glass-card text-blue-900 hover:bg-white/40"}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-full md:w-56">
                <input type="text" placeholder="Search fragrances..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full glass-card rounded-full py-2.5 pl-10 pr-4 text-blue-950 placeholder:text-blue-800/50 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-blue-800/50" />
              </div>

              {/* Advanced Filter Toggle */}
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${showFilters ? "bg-blue-600 text-white" : "glass-card text-blue-900 hover:bg-white/40"}`}>
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="border-t border-white/20 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Collection */}
              {collections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-blue-900/70 mb-1 uppercase tracking-wider">Collection</label>
                  <select value={collection} onChange={(e) => setCollection(e.target.value)}
                    className="w-full glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    <option value="All">All Collections</option>
                    {collections.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Price Range */}
              <div>
                <label className="block text-xs font-medium text-blue-900/70 mb-1 uppercase tracking-wider">
                  Price Range: ${priceRange[0]} – ${priceRange[1]}
                </label>
                <div className="flex gap-2">
                  <input type="range" min="0" max="1000" step="10" value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="flex-1 accent-blue-600" />
                  <input type="range" min="0" max="1000" step="10" value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="flex-1 accent-blue-600" />
                </div>
              </div>

              <div className="flex items-end">
                <button onClick={() => { setCollection("All"); setPriceRange([0, 1000]); setSearch(""); setCategory("All"); }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result count */}
        {!isLoading && (
          <p className="text-sm text-blue-800/60 mb-6">{filtered.length} product{filtered.length !== 1 ? "s" : ""} found</p>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-serif text-blue-950 mb-2">No fragrances found</h2>
            <p className="text-blue-900/70">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.map((product) => {
              const p = product as any;
              const isOnSale = p.salePrice && (p.saleEndsAt === null || p.saleEndsAt > now);
              return (
                <div key={product.id} className="glass-card rounded-2xl p-6 group flex flex-col relative">
                  {/* Sale badge */}
                  {isOnSale && (
                    <div className="absolute top-3 left-3 z-10 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Tag className="w-3 h-3" /> SALE
                    </div>
                  )}

                  {/* Wishlist button */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggle(product.id); }}
                    className={`absolute top-3 right-3 z-10 p-1.5 rounded-full transition-all ${isWishlisted(product.id) ? "text-red-500 bg-red-50" : "text-blue-300 hover:text-red-400 bg-white/30"}`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                  </button>

                  <Link href={`/product/${product.id}`}>
                    <div className="aspect-[4/5] rounded-xl bg-white/40 mb-6 overflow-hidden flex items-center justify-center p-6 relative cursor-pointer">
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/50 to-white/20 z-0" />
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full drop-shadow-xl z-10 transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full glass-panel rounded-lg z-10 flex items-center justify-center">
                          <span className="text-blue-300 font-serif italic">Glass</span>
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-auto">
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">{product.brand}</p>
                      <h3 className="text-lg font-serif text-blue-950 mb-1">{product.name}</h3>
                      <p className="text-xs text-blue-800/60 mb-2">{product.category}</p>
                      {p.collection && <p className="text-xs text-blue-500/80 mb-2">{p.collection}</p>}
                      <div className="flex items-center justify-center gap-2">
                        {isOnSale ? (
                          <>
                            <span className="text-orange-600 font-semibold">{format(p.salePrice)}</span>
                            <span className="text-blue-400 line-through text-sm">{format(product.price)}</span>
                          </>
                        ) : (
                          <span className="text-blue-900/80 font-medium">{format(product.price)}</span>
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
