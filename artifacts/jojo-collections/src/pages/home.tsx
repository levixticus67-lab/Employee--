import { Layout } from "@/components/layout";
import { useListFeaturedProducts, useListNewArrivals } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: featuredProducts } = useListFeaturedProducts();
  const { data: newArrivals } = useListNewArrivals();

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
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl font-serif text-blue-950">Featured Curations</h2>
          <Link href="/shop?featured=true" className="text-blue-600 hover:text-blue-800 text-sm font-medium uppercase tracking-wider">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts?.map((product) => (
            <Link key={product.id} href={`/product/${product.id}`}>
              <div className="glass-card rounded-2xl p-6 group cursor-pointer h-full flex flex-col">
                <div className="aspect-[4/5] rounded-xl bg-white/40 mb-6 overflow-hidden flex items-center justify-center p-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/50 to-white/20 z-0"></div>
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
                  <p className="text-blue-900/70">${product.price.toFixed(2)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/20">
        <h2 className="text-3xl font-serif text-blue-950 mb-12 text-center">New Arrivals</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {newArrivals?.map((product) => (
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
                  <p className="text-sm text-blue-800/60 mt-1">${product.price.toFixed(2)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
