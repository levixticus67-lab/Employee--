import { useState } from "react";
import { useRoute } from "wouter";
import { useGetProduct, useListProductReviews, useCreateProductReview } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { Star, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductReviewsQueryKey } from "@workspace/api-client-react";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const productId = params?.id || "";
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { enabled: !!productId }
  });
  
  const { data: reviews } = useListProductReviews(productId, {
    query: { enabled: !!productId }
  });
  
  const createReview = useCreateProductReview();
  const { addToCart } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [reviewForm, setReviewForm] = useState({ customerName: "", rating: 5, comment: "" });

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      toast.success("Added to cart", {
        description: `${quantity}x ${product.name}`
      });
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReview.mutate({ id: productId, data: reviewForm }, {
      onSuccess: () => {
        toast.success("Review submitted", {
          description: "Your review is pending approval."
        });
        setReviewForm({ customerName: "", rating: 5, comment: "" });
      },
      onError: () => {
        toast.error("Failed to submit review");
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-blue-950">Product not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Product Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="glass-panel rounded-3xl p-8 flex items-center justify-center relative overflow-hidden aspect-square">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-200/40 to-white/30 z-0"></div>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="object-contain w-full h-full max-h-[80%] drop-shadow-2xl z-10" />
            ) : (
              <div className="w-64 h-64 glass-panel rounded-lg z-10 flex items-center justify-center">
                <span className="text-blue-300 font-serif italic text-xl">Glass</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-2">{product.brand}</p>
            <h1 className="text-4xl md:text-5xl font-serif text-blue-950 mb-4">{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-6">
              <span className="text-2xl text-blue-900/90 font-light">${product.price.toFixed(2)}</span>
              {product.sizeMl && (
                <span className="text-sm text-blue-800/60 px-3 py-1 glass-card rounded-full">{product.sizeMl}ml</span>
              )}
            </div>
            
            <p className="text-blue-900/70 mb-8 leading-relaxed">{product.description}</p>
            
            {product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="glass-panel flex items-center justify-between rounded-full px-2 w-32 border-white/40">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-blue-800 hover:text-blue-950 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-medium text-blue-950">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-2 text-blue-800 hover:text-blue-950 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={handleAddToCart} size="lg" className="rounded-full flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            ) : (
              <div className="mb-8 p-4 glass-panel rounded-xl text-center border-red-200/50 bg-red-50/30 text-red-800">
                Out of Stock
              </div>
            )}
            
            <div className="space-y-4 pt-6 border-t border-white/20">
              {product.topNotes && (
                <div><span className="font-medium text-blue-950 text-sm tracking-wider uppercase">Top Notes:</span> <span className="text-blue-900/70">{product.topNotes}</span></div>
              )}
              {product.heartNotes && (
                <div><span className="font-medium text-blue-950 text-sm tracking-wider uppercase">Heart Notes:</span> <span className="text-blue-900/70">{product.heartNotes}</span></div>
              )}
              {product.baseNotes && (
                <div><span className="font-medium text-blue-950 text-sm tracking-wider uppercase">Base Notes:</span> <span className="text-blue-900/70">{product.baseNotes}</span></div>
              )}
            </div>
          </div>
        </div>

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
                  <input
                    required
                    type="text"
                    value={reviewForm.customerName}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Rating</label>
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 appearance-none bg-transparent"
                  >
                    {[5, 4, 3, 2, 1].map(num => (
                      <option key={num} value={num}>{num} Stars</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Comment</label>
                  <textarea
                    required
                    rows={4}
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full glass-card rounded-lg px-4 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 resize-none"
                  />
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
