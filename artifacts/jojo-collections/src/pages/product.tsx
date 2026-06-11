import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useGetProduct, useListProductReviews, useCreateProductReview } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { useWishlist } from "@/components/wishlist-context";
import { useCurrency } from "@/components/currency-context";
import { Button } from "@/components/ui/button";
import { Star, Minus, Plus, ShoppingBag, Heart, Share2, Bell, ChevronRight, ChevronLeft, Flame } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductReviewsQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { useStoreName } from "@/lib/use-store-name";

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
  return <span className="font-mono text-sm text-orange-400 font-bold">{timeLeft}</span>;
}

const THUMB_SIZE = 44;
const THUMB_GAP = 6;
const THUMB_STEP = THUMB_SIZE + THUMB_GAP; // pixels per slide in track

function ImageSlider({ images, name }: { images: string[]; name: string }) {
  const n = images.length;
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const lockRef = useRef(false);
  const touchX = useRef<number | null>(null);

  const go = (direction: "next" | "prev") => {
    if (lockRef.current || n <= 1) return;
    lockRef.current = true;
    setDir(direction);
    setAnimKey((k) => k + 1);
    setTimeout(() => {
      setCurrent((c) => direction === "next" ? (c + 1) % n : (c - 1 + n) % n);
      setDir(null);
      lockRef.current = false;
    }, 640);
  };

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || lockRef.current) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? "next" : "prev");
  };

  if (n <= 1) {
    return (
      <div className="relative aspect-square rounded-2xl overflow-hidden" style={{ background: "#06101e" }}>
        {images[0] && (
          <img src={images[0]} alt={name} className="w-full h-full object-contain p-6 drop-shadow-2xl" draggable={false} />
        )}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-sky-400/10 pointer-events-none" />
      </div>
    );
  }

  const nextIdx = (current + 1) % n;
  const prevIdx = (current - 1 + n) % n;
  const incomingIdx = dir === "next" ? nextIdx : dir === "prev" ? prevIdx : null;

  // Thumbnail queue: next N images after current.
  // During "next": render 4 so the 4th slides in from the right edge.
  const maxThumbs = Math.min(n - 1, dir === "next" ? 4 : 3);
  const thumbIndices = Array.from({ length: maxThumbs }, (_, i) => (nextIdx + i) % n);

  return (
    <div
      className="relative w-full aspect-square rounded-2xl overflow-hidden select-none"
      style={{ background: "#06101e" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Layer 0: current background image — fades / scales out on next ── */}
      <div
        className="absolute inset-0 z-0 flex items-center justify-center p-6"
        style={{
          opacity: dir ? 0 : 1,
          transform: dir === "next" ? "scale(0.9)" : "scale(1)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <img
          src={images[current]}
          alt={name}
          className="w-full h-full object-contain drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* ── Layer 1: incoming image ── */}
      {incomingIdx !== null && (
        <div
          key={`in-${animKey}`}
          className="absolute inset-0 z-10 flex items-center justify-center p-6"
          style={{
            animation: dir === "next"
              ? "sliderThumbExpand 0.64s cubic-bezier(0.22,0.68,0,1.1) forwards"
              : "sliderFadeIn 0.55s ease forwards",
          }}
        >
          <img
            src={images[incomingIdx]}
            alt={name}
            className="w-full h-full object-contain drop-shadow-2xl"
            draggable={false}
          />
        </div>
      )}

      {/* ── Counter ── */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/70 z-30 tabular-nums">
        {current + 1} / {n}
      </div>

      {/* ── Bottom: gradient + thumbnail track + arrows ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-3 pt-12 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-2">

          {/* Left arrow */}
          <button
            onClick={() => go("prev")}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/22 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Thumbnail track — clips to 3 thumbnails wide, slides on "next" */}
          <div className="flex-1 overflow-hidden">
            <div
              className="flex"
              style={{
                gap: THUMB_GAP,
                transform: dir === "next" ? `translateX(-${THUMB_STEP}px)` : "translateX(0)",
                transition: dir === "next"
                  ? `transform 0.58s cubic-bezier(0.25,0.46,0.45,0.94)`
                  : "none",
              }}
            >
              {thumbIndices.map((idx, ti) => {
                const isLeaving = dir === "next" && ti === 0;
                return (
                  <div
                    key={`th-${animKey}-${ti}`}
                    style={{
                      width: THUMB_SIZE,
                      height: THUMB_SIZE,
                      flexShrink: 0,
                      opacity: isLeaving ? 0 : 1,
                      transform: isLeaving ? "scale(1.5)" : "scale(1)",
                      transition: "opacity 0.32s ease, transform 0.32s ease",
                    }}
                    className="rounded-xl overflow-hidden border border-white/15 cursor-pointer hover:border-sky-400/50 transition-colors"
                    onClick={() => go("next")}
                  >
                    <img
                      src={images[idx]}
                      alt=""
                      className="w-full h-full object-contain p-0.5"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={() => go("next")}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/22 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="absolute inset-0 rounded-2xl ring-1 ring-sky-400/10 pointer-events-none z-40" />
    </div>
  );
}

export default function ProductDetail() {
    const storeName = useStoreName();
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
  const [reviewForm, setReviewForm] = useState({ customerName: "", rating: 5, comment: "" });
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    if (!productId) return;
    try {
      const stored: string[] = JSON.parse(localStorage.getItem("jojo-recently-viewed") || "[]");
      const updated = [productId, ...stored.filter((id) => id !== productId)].slice(0, 10);
      localStorage.setItem("jojo-recently-viewed", JSON.stringify(updated));
    } catch {}
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    apiFetch(`/api/products/${productId}/related`)
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
    const url = `https://jojo-og-preview.levixticus67.workers.dev/product/${productId}`;
    if (navigator.share) {
      try {
        // Pass url only — no title/text — so WhatsApp treats it as a link
        // and fetches OG tags to generate a preview card
        await navigator.share({ url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleStockAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertEmail) return;
    try {
      await apiFetch("/api/stock-alerts", {
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400" />
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-sky-100">Product not found</h2>
          <Link href="/shop" className="text-blue-400 hover:underline mt-4 inline-block">← Back to Shop</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Product Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-20">

          {/* ── Futuristic image slider ── */}
          <div>
            {allImages.length > 0 ? (
              <ImageSlider images={allImages} name={product.name} />
            ) : (
              <div className="aspect-square rounded-2xl flex items-center justify-center" style={{ background: "rgba(12, 28, 55, 0.75)" }}>
                <span className="text-sky-400/30 font-serif italic text-xl">No image</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest">{product.brand}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(productId)}
                  className={`p-2 rounded-full transition-all ${isWishlisted(productId) ? "text-red-400 bg-red-900/30" : "text-sky-300/60 hover:text-red-400 bg-white/10"}`}>
                  <Heart className={`w-5 h-5 ${isWishlisted(productId) ? "fill-current" : ""}`} />
                </button>
                <button onClick={handleShare} className="p-2 rounded-full text-sky-300/60 hover:text-sky-200 bg-white/10 hover:bg-white/15 transition-all" title="Share">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-serif text-sky-50 mb-2 leading-tight">{product.name}</h1>

            {p?.collection && (
              <p className="text-sm text-blue-400 mb-4">{p.collection}</p>
            )}

            {isOnSale && (
              <div className="flex items-center gap-3 mb-4 glass-card rounded-xl p-3 border border-orange-400/20">
                <Flame className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-orange-300">Flash Sale</span>
                  {p.saleEndsAt && <div className="text-xs text-orange-300/70">Ends in <CountdownTimer endsAt={p.saleEndsAt} /></div>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl text-sky-50 font-serif">{format(displayPrice)}</span>
              {isOnSale && (
                <span className="text-lg text-sky-400/50 line-through">{format(product.price)}</span>
              )}
              {product.sizeMl && sizes.length === 0 && (
                <span className="text-sm text-sky-300/60 px-3 py-1 glass-card rounded-full">{product.sizeMl}ml</span>
              )}
            </div>

            {sizes.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-sky-200/80 mb-2 uppercase tracking-wider">Size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size, i) => (
                    <button key={i} onClick={() => setSelectedSize(i === selectedSize ? null : i)}
                      disabled={size.stock === 0}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        i === selectedSize ? "bg-blue-500 text-white border-blue-500" :
                        size.stock === 0 ? "opacity-40 cursor-not-allowed glass-card border-white/20 text-sky-300" :
                        "glass-card border-white/20 text-sky-200 hover:border-blue-400"
                      }`}>
                      {size.label} — {format(size.price)}
                      {size.stock === 0 && " (OOS)"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sky-200/65 mb-8 leading-relaxed">{product.description}</p>

            {displayStock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="glass-panel flex items-center justify-between rounded-full px-2 w-32 border-white/15">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-sky-300 hover:text-sky-50 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-medium text-sky-100">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(displayStock, quantity + 1))} className="p-2 text-sky-300 hover:text-sky-50 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={handleAddToCart} size="lg" className="rounded-full flex-1 bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25">
                  <ShoppingBag className="w-4 h-4 mr-2" /> Add to Cart
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <div className="mb-4 p-4 glass-panel rounded-xl text-center border border-red-400/20 text-red-300">
                  Out of Stock
                </div>
                {!alertSent ? (
                  <form onSubmit={handleStockAlert} className="flex gap-2">
                    <input type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="Email for restock notification"
                      className="flex-1 glass-card rounded-full px-4 py-2 text-sm border-white/15 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                    <Button type="submit" className="rounded-full bg-blue-500 hover:bg-blue-400 text-white px-4 text-sm flex-shrink-0">
                      <Bell className="w-4 h-4" />
                    </Button>
                  </form>
                ) : (
                  <p className="text-center text-sm text-green-400 glass-panel rounded-xl p-3">
                    ✓ We'll email you when it's back in stock!
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-white/10">
              {product.topNotes && (
                <div><span className="font-medium text-sky-200 text-xs tracking-wider uppercase">Top Notes: </span><span className="text-sky-300/65 text-sm">{product.topNotes}</span></div>
              )}
              {product.heartNotes && (
                <div><span className="font-medium text-sky-200 text-xs tracking-wider uppercase">Heart Notes: </span><span className="text-sky-300/65 text-sm">{product.heartNotes}</span></div>
              )}
              {product.baseNotes && (
                <div><span className="font-medium text-sky-200 text-xs tracking-wider uppercase">Base Notes: </span><span className="text-sky-300/65 text-sm">{product.baseNotes}</span></div>
              )}
              {product.notes?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {product.notes.map((note: string) => (
                    <span key={note} className="text-xs glass-card px-2.5 py-1 rounded-full text-sky-300/80">{note}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mb-16 border-t border-white/10 pt-14">
            <h2 className="text-2xl font-serif text-sky-50 mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {relatedProducts.map((rp) => (
                <Link key={rp.id} href={`/product/${rp.id}`}>
                  <div className="glass-panel rounded-2xl p-4 group cursor-pointer hover:bg-white/8 transition-colors">
                    <div className="aspect-square rounded-xl bg-white/5 mb-3 overflow-hidden relative">
                      {rp.imageUrl ? (
                        <img src={rp.imageUrl} alt={rp.name} className="absolute inset-0 w-full h-full object-contain p-2 drop-shadow-md transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full glass-panel rounded-lg" />
                      )}
                    </div>
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-1">{rp.brand}</p>
                    <p className="text-sm font-serif text-sky-100 truncate">{rp.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {rp.salePrice ? (
                        <>
                          <span className="text-xs font-medium text-orange-400">{format(rp.salePrice)}</span>
                          <span className="text-xs text-sky-400/50 line-through">{format(rp.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm text-sky-200/70">{format(rp.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="border-t border-white/10 pt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-serif text-sky-50 mb-8">Customer Reviews</h3>
            {reviews?.length === 0 ? (
              <p className="text-sky-300/50 italic">No reviews yet. Be the first to share your thoughts.</p>
            ) : (
              <div className="space-y-6">
                {reviews?.map((review) => (
                  <div key={review.id} className="glass-panel rounded-2xl p-6 border-white/10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-medium text-sky-100">{review.customerName}</p>
                        <p className="text-xs text-sky-300/45">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-current" : "text-sky-400/20"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sky-200/70">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="glass-panel-heavy rounded-2xl p-6 border-white/10 sticky top-28">
              <h4 className="text-xl font-serif text-sky-50 mb-6">Write a Review</h4>
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sky-200/80 mb-1">Name</label>
                  <input required type="text" value={reviewForm.customerName}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, customerName: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-200/80 mb-1">Rating</label>
                  <select value={reviewForm.rating}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                    className="w-full glass-card rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/10 appearance-none bg-transparent">
                    {[5, 4, 3, 2, 1].map((num) => <option key={num} value={num} className="bg-slate-900">{num} Stars</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-200/80 mb-1">Comment</label>
                  <textarea required rows={4} value={reviewForm.comment}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/10 resize-none" />
                </div>
                <Button type="submit" className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 text-white" disabled={createReview.isPending}>
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
