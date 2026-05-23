import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth-context";

interface WishlistContextType {
  wishlist: string[];
  toggle: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function storageKey(firebaseUid: string | null | undefined): string {
  return firebaseUid ? `jojo-wishlist-${firebaseUid}` : "jojo-wishlist-guest";
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.firebaseUid ?? null;
  const key = storageKey(uid);

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch { return []; }
  });

  // Reload whenever the user changes (login / logout / uid hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setWishlist(saved ? (JSON.parse(saved) as string[]) : []);
    } catch { setWishlist([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(wishlist)); } catch {}
  }, [wishlist, key]);

  const toggle = (productId: string) =>
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isWishlisted, count: wishlist.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
