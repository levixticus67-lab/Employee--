import { Layout } from "@/components/layout";
import { useWishlist } from "@/components/wishlist-context";
import { useCart } from "@/components/cart-context";
import { useCurrency } from "@/components/currency-context";
import { useListProducts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function WishlistPage() {
  const { wishlist, toggle } = useWishlist();
  const { addToCart } = useCart();
  const { format } = useCurrency();
  const { data: allProducts } = useListProducts();

  const products = allProducts?.filter((p) => wishlist.includes(p.id)) ?? [];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-2 text-center">My Wishlist</h1>
        <p className="text-center text-blue-800/60 mb-10">
          {products.length === 0 ? "Your wishlist is empty." : `${products.length} item${products.length > 1 ? "s" : ""} saved`}
        </p>

        {products.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <Heart className="w-16 h-16 text-blue-200 mx-auto mb-6" />
            <h2 className="text-2xl font-serif text-blue-950 mb-4">Nothing saved yet</h2>
            <p className="text-blue-800/60 mb-8">Browse our collection and heart the fragrances you love.</p>
            <Link href="/shop">
              <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8">
                Explore Collection
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="glass-card rounded-2xl p-5 flex flex-col">
                <Link href={`/product/${product.id}`}>
                  <div className="aspect-[4/3] rounded-xl bg-white/40 mb-4 overflow-hidden flex items-center justify-center p-4 relative cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/50 to-white/20" />
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full drop-shadow-lg z-10" />
                    ) : (
                      <span className="text-blue-300 font-serif italic z-10">No image</span>
                    )}
                  </div>
                </Link>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">{product.brand}</p>
                  <h3 className="text-lg font-serif text-blue-950 mb-1">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    {product.salePrice ? (
                      <>
                        <span className="text-blue-900 font-medium">{format(product.salePrice)}</span>
                        <span className="text-sm text-blue-400 line-through">{format(product.price)}</span>
                      </>
                    ) : (
                      <span className="text-blue-900 font-medium">{format(product.price)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    disabled={product.stock === 0}
                    onClick={() => {
                      addToCart(product, 1);
                      toast.success("Added to cart");
                    }}
                  >
                    <ShoppingBag className="w-4 h-4 mr-1" />
                    {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                  </Button>
                  <button
                    onClick={() => toggle(product.id)}
                    className="p-2.5 glass-card rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
