import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useGetProduct, useListProductReviews, useCreateProductReview } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useWishlist } from "@/components/wishlist-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { Star, Minus, Plus, ShoppingBag, Heart, Share2, Bell, ChevronRight, Flame } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductReviewsQueryKey } from "@workspace/api-client-react";

type RelatedProduct = { id: string; name: string; brand: string; price: number; salePrice?: number | null; imageUrl: string | null };

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
  return <span className="font-mono text-sm text-orange-700 font-bold">{timeLeft}</span>;
}

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const productId = params?.id || "";
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { enabled: !!productId } as any,
  });
  const { data: reviews } = useListProductReviews(productId, {
    query: { enabled: !!productId } as any,
  });
  const createReview = useCreateProductReview();
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { format } = useCurrency();

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [reviewForm, setReviewForm] = useState({ customerName: "", rating: 5, comment: "" });
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSent, setAlertSent] = useState(false);

  // Recently viewed
  useEffect(() => {
    if (!productId) return;
    try {
      const stored: string[] = JSON.parse(localStorage.getItem("jojo-recently-viewed") || "[]");
      const updated = [productId, ...stored.filter((id) => id !== productId)].slice(0, 10);
      localStorage.setItem("jojo-recently-viewed", JSON.stringify(updated));
    } catch {}
  }, [productId]);

  // Load related products
  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}/related`)
      .then((r) => r.json())
      .then((data) => setRelatedProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [productId]);

  const p = product as any;
  const allImages: string[] = p ? [p.imageUrl, ...(p.images ?? [])].filter(Boolean) : [];
  const sizes: { label: string; price: number; stock: number }[] = p?.sizes ?? [];
  const activeSize = selectedSize !== null ? sizes[selectedSize] : null;
  const displayPrice = activeSize ? activeSize.price : (p?.salePrice || p?.price || 0);
  const displayStock = activeSize ? activeSize.stock : (p?.stock || 0);
  const isOnSale = p?.salePrice && (p.saleEndsAt === null || p.saleEndsAt > new Date().toISOString());

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      toast.success("Added to cart", { description: `${quantity}× ${product.name}` });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out ${product?.name} on Jojo Collections!`;
    if (navigator.share) {
      try { await navigator.share({ title: product?.name, text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleStockAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertEmail) return;
    try {
      await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alertEmail, productId, productName: product?.name }),
      });
      setAlertSent(true);
      toast.success("We'll notify you when it's back in stock!");
    } catch {
      toast.error("Failed to register alert");
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReview.mutate(
      { id: productId, data: reviewForm },
      {
        onSuccess: () => {
          toast.success("Review submitted", { description: "Your review is pending approval." });
          setReviewForm({ customerName: "", rating: 5, comment: "" });
          queryClient.invalidateQueries({ queryKey: getListProductReviewsQueryKey(productId) });
        },
        onError: () => toast.error("Failed to submit review"),
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-blue-950">Product not found</h2>
          <Link href="/shop" className="text-blue-600 hover:underline mt-4 inline-block">← Back to Shop</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Product Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          {/* Image Gallery */}
          <div>
            <div className="glass-panel rounded-3xl p-8 flex items-center justify-center relative overflow-hidden aspect-square mb-4">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-200/40 to-white/30 z-0" />
              {allImages.length > 0 ? (
                <img src={allImages[activeImage]} alt={product.name} className="object-contain w-full h-full max-h-[80%] drop-shadow-2xl z-10 transition-all duration-300" />
              ) : (
                <div className="w-64 h-64 glass-panel rounded-lg z-10 flex items-center justify-center">
                  <span className="text-blue-300 font-serif italic text-xl">No image</span>
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-3 justify-center overflow-x-auto">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${i === activeImage ? "border-blue-500 shadow-md" : "border-white/30 opacity-60 hover:opacity-100"}`}>
                    <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-contain bg-white/40" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest">{product.brand}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(productId)}
                  className={`p-2 rounded-full transition-all ${isWishlisted(productId) ? "text-red-500 bg-red-50" : "text-blue-300 hover:text-red-400 bg-white/30"}`}>
                  <Heart className={`w-5 h-5 ${isWishlisted(productId) ? "fill-current" : ""}`} />
                </button>
                <button onClick={handleShare} className="p-2 rounded-full text-blue-400 hover:text-blue-700 bg-white/30 hover:bg-white/50 transition-all" title="Share">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-serif text-blue-950 mb-2">{product.name}</h1>

            {p?.collection && (
              <p className="text-sm text-blue-500 mb-4">{p.collection}</p>
            )}

            {/* Flash Sale Badge */}
            {isOnSale && (
              <div className="flex items-center gap-3 mb-4 glass-panel rounded-xl p-3 border-orange-200/50 bg-orange-50/20">
                <Flame className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-orange-900">Flash Sale</span>
                  {p.saleEndsAt && <div className="text-xs text-orange-800/70">Ends in <CountdownTimer endsAt={p.saleEndsAt} /></div>}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl text-blue-950 font-serif">{format(displayPrice)}</span>
              {isOnSale && (
                <span className="text-lg text-blue-400 line-through">{format(product.price)}</span>
              )}
              {product.sizeMl && sizes.length === 0 && (
                <span className="text-sm text-blue-800/60 px-3 py-1 glass-card rounded-full">{product.sizeMl}ml</span>
              )}
            </div>

            {/* Size Variants */}
            {sizes.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-blue-900/80 mb-2 uppercase tracking-wider">Size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size, i) => (
                    <button key={i} onClick={() => setSelectedSize(i === selectedSize ? null : i)}
                      disabled={size.stock === 0}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        i === selectedSize ? "bg-blue-600 text-white border-blue-600" :
                        size.stock === 0 ? "opacity-40 cursor-not-allowed glass-card border-white/30 text-blue-800" :
                        "glass-card border-white/40 text-blue-900 hover:border-blue-400"
                      }`}>
                      {size.label} — {format(size.price)}
                      {size.stock === 0 && " (OOS)"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-blue-900/70 mb-8 leading-relaxed">{product.description}</p>

            {/* Add to Cart / Out of Stock */}
            {displayStock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="glass-panel flex items-center justify-between rounded-full px-2 w-32 border-white/40">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-blue-800 hover:text-blue-950">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-medium text-blue-950">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(displayStock, quantity + 1))} className="p-2 text-blue-800 hover:text-blue-950">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={handleAddToCart} size="lg" className="rounded-full flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                  <ShoppingBag className="w-4 h-4 mr-2" /> Add to Cart
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <div className="mb-4 p-4 glass-panel rounded-xl text-center border-red-200/50 bg-red-50/30 text-red-800">
                  Out of Stock
                </div>
                {!alertSent ? (
                  <form onSubmit={handleStockAlert} className="flex gap-2">
                    <input type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="Email for restock notification"
                      className="flex-1 glass-card rounded-full px-4 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                    <Button type="submit" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 text-sm flex-shrink-0">
                      <Bell className="w-4 h-4" />
                    </Button>
                  </form>
                ) : (
                  <p className="text-center text-sm text-green-700 glass-panel rounded-xl p-3">
                    ✓ We'll email you when it's back in stock!
                  </p>
                )}
              </div>
            )}

            {/* Fragrance Notes */}
            <div className="space-y-3 pt-6 border-t border-white/20">
              {product.topNotes && (
                <div><span className="font-medium text-blue-950 text-xs tracking-wider uppercase">Top Notes: </span><span className="text-blue-900/70 text-sm">{product.topNotes}</span></div>
              )}
              {product.heartNotes && (
                <div><span className="font-medium text-blue-950 text-xs tracking-wider uppercase">Heart Notes: </span><span className="text-blue-900/70 text-sm">{product.heartNotes}</span></div>
              )}
              {product.baseNotes && (
                <div><span className="font-medium text-blue-950 text-xs tracking-wider uppercase">Base Notes: </span><span className="text-blue-900/70 text-sm">{product.baseNotes}</span></div>
              )}
              {product.notes?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {product.notes.map((note: string) => (
                    <span key={note} className="text-xs glass-card px-2.5 py-1 rounded-full text-blue-800/80">{note}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mb-16 border-t border-white/20 pt-14">
            <h2 className="text-2xl font-serif text-blue-950 mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {relatedProducts.map((rp) => (
                <Link key={rp.id} href={`/product/${rp.id}`}>
                  <div className="glass-panel rounded-2xl p-4 group cursor-pointer hover:bg-white/30 transition-colors">
                    <div className="aspect-square rounded-xl bg-white/30 mb-3 overflow-hidden flex items-center justify-center p-3">
                      {rp.imageUrl ? (
                        <img src={rp.imageUrl} alt={rp.name} className="object-contain w-full h-full drop-shadow-md transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full glass-panel rounded-lg" />
                      )}
                    </div>
                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-widest mb-1">{rp.brand}</p>
                    <p className="text-sm font-serif text-blue-950 truncate">{rp.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {rp.salePrice ? (
                        <>
                          <span className="text-xs font-medium text-orange-600">{format(rp.salePrice)}</span>
                          <span className="text-xs text-blue-400 line-through">{format(rp.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm text-blue-900/70">{format(rp.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="border-t border-white/30 pt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-serif text-blue-950 mb-8">Customer Reviews</h3>
            {reviews?.length === 0 ? (
              <p className="text-blue-800/60 italic">No reviews yet. Be the first to share your thoughts.</p>
            ) : (
              <div className="space-y-6">
                {reviews?.map((review) => (
                  <div key={review.id} className="glass-panel rounded-2xl p-6 border-white/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-medium text-blue-950">{review.customerName}</p>
                        <p className="text-xs text-blue-800/50">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-current" : "text-blue-200"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-blue-900/80">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="glass-panel-heavy rounded-2xl p-6 border-white/40 sticky top-28">
              <h4 className="text-xl font-serif text-blue-950 mb-6">Write a Review</h4>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Name</label>
                  <input required type="text" value={reviewForm.customerName}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, customerName: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Rating</label>
                  <select value={reviewForm.rating}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 appearance-none bg-transparent">
                    {[5, 4, 3, 2, 1].map((num) => <option key={num} value={num}>{num} Stars</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Comment</label>
                  <textarea required rows={4} value={reviewForm.comment}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none" />
                </div>
                <Button type="submit" className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white" disabled={createReview.isPending}>
                  {createReview.isPending ? "Submitting..." : "Submit Review"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
