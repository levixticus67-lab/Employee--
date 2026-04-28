import { useState } from "react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Search, Filter } from "lucide-react";

const CATEGORIES = ["All", "Eau de Parfum", "Eau de Toilette", "Body Mist"];

export default function Shop() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const { data: products, isLoading } = useListProducts({
    search: search || undefined,
    category: category !== "All" ? category : undefined,
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8 text-center">Our Collection</h1>
        
        {/* Filters */}
        <div className="glass-panel rounded-2xl p-6 mb-12 flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "glass-card text-blue-900 hover:bg-white/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search fragrances..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-card rounded-full py-2.5 pl-10 pr-4 text-blue-950 placeholder:text-blue-800/50 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-blue-800/50" />
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : products?.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-serif text-blue-950 mb-2">No fragrances found</h2>
            <p className="text-blue-900/70">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products?.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`}>
                <div className="glass-card rounded-2xl p-6 group cursor-pointer h-full flex flex-col">
                  <div className="aspect-[4/5] rounded-xl bg-white/40 mb-6 overflow-hidden flex items-center justify-center p-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/50 to-white/20 z-0"></div>
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
                    <p className="text-xs text-blue-800/60 mb-3">{product.category}</p>
                    <p className="text-blue-900/80 font-medium">${product.price.toFixed(2)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
