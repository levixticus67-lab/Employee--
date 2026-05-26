import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "@workspace/api-client-react";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface BundleCartItem {
  bundleId: string;
  bundleName: string;
  price: number;
  imageUrl: string | null;
  productIds: string[];
  products: Product[];
}

interface CartContextType {
  items: CartItem[];
  bundles: BundleCartItem[];
  addToCart: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  addBundleToCart: (bundle: BundleCartItem) => void;
  removeBundleFromCart: (bundleId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("jojo-cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bundles, setBundles] = useState<BundleCartItem[]>(() => {
    try {
      const saved = localStorage.getItem("jojo-cart-bundles");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("jojo-cart", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("jojo-cart-bundles", JSON.stringify(bundles));
  }, [bundles]);

  const addToCart = (product: Product, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const addBundleToCart = (bundle: BundleCartItem) => {
    setBundles((prev) => {
      if (prev.find((b) => b.bundleId === bundle.bundleId)) return prev;
      return [...prev, bundle];
    });
  };

  const removeBundleFromCart = (bundleId: string) => {
    setBundles((prev) => prev.filter((b) => b.bundleId !== bundleId));
  };

  const clearCart = () => {
    setItems([]);
    setBundles([]);
  };

  const totalItems =
    items.reduce((sum, item) => sum + item.quantity, 0) + bundles.length;

  const subtotal =
    items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) +
    bundles.reduce((sum, b) => sum + b.price, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        bundles,
        addToCart,
        updateQuantity,
        removeFromCart,
        addBundleToCart,
        removeBundleFromCart,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
