import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-blue-950 mb-8">Your Cart</h1>
        
        {items.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-blue-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-serif text-blue-950 mb-4">Your cart is empty</h2>
            <Link href="/shop">
              <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.product.id} className="glass-panel rounded-2xl p-4 flex gap-4 items-center border-white/40 relative">
                  <div className="w-24 h-24 glass-card rounded-xl overflow-hidden flex-shrink-0 p-2">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-blue-50/50 rounded flex items-center justify-center text-xs text-blue-400">No Img</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-blue-950 text-lg">{item.product.name}</h3>
                    <p className="text-sm text-blue-800/70 mb-2">{item.product.brand}</p>
                    <p className="font-medium text-blue-900">${item.product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="glass-panel flex items-center rounded-full px-1 py-0.5 border-white/50">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1.5 text-blue-800 hover:text-blue-950 transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-medium text-blue-950 text-sm w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))} className="p-1.5 text-blue-800 hover:text-blue-950 transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="md:col-span-1">
              <div className="glass-panel-heavy rounded-2xl p-6 border-white/50 sticky top-24">
                <h3 className="text-lg font-serif text-blue-950 mb-4">Order Summary</h3>
                <div className="space-y-3 text-sm text-blue-900/80 mb-6">
                  <div className="flex justify-between">
                    <span>Items ({totalItems})</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>
                <div className="border-t border-white/30 pt-4 mb-6 flex justify-between items-center">
                  <span className="font-medium text-blue-950">Subtotal</span>
                  <span className="text-xl font-medium text-blue-950">${subtotal.toFixed(2)}</span>
                </div>
                <Link href="/checkout">
                  <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 h-12 text-md">
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// Needed because ShoppingBag wasn't imported in the file initially
import { ShoppingBag } from "lucide-react";
