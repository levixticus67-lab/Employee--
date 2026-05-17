import { Link, useLocation } from "wouter";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { useWishlist } from "./wishlist-context";
import { useCurrency, type Currency } from "./currency-context";
import { ShoppingBag, Menu, X, User, LogOut, Heart, MessageCircle, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export function Layout({ children }: { children: React.ReactNode }) {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { currency, setCurrency } = useCurrency();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("Hi! I need help.");

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.whatsappNumber) setWhatsappNumber(d.whatsappNumber);
        if (d.whatsappMessage) setWhatsappMessage(d.whatsappMessage);
      })
      .catch(() => {});
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/bundles", label: "Bundles" },
    { href: "/blog", label: "Journal" },
  ];

  const currencies: Currency[] = ["USD", "UGX", "EUR", "GBP"];

  async function handleLogout() {
    try { await logout(); toast.success("Signed out"); setLocation("/"); }
    catch { toast.error("Could not sign out"); }
  }

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <header className="sticky top-0 z-50 glass-panel-heavy border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-6">
            <Link href="/" className="flex-shrink-0 text-xl font-serif text-blue-950 font-bold tracking-widest">JOJO</Link>

            <nav className="hidden md:flex items-center gap-5 flex-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`text-xs font-medium uppercase tracking-wider transition-colors ${location === link.href ? "text-blue-900 font-semibold" : "text-blue-800/60 hover:text-blue-950"}`}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2 ml-auto">
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="text-xs font-medium text-blue-800/60 bg-transparent border-0 focus:outline-none cursor-pointer hover:text-blue-950 pr-1">
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {user ? (
                <div className="flex items-center gap-1 border-l border-blue-900/10 pl-2">
                  <Link href="/my-orders" className="flex items-center gap-1.5 text-xs text-blue-900 font-medium px-2 hover:text-blue-700 transition-colors">
                    <User className="w-3.5 h-3.5" />{user.name.split(" ")[0]}
                  </Link>
                  <Link href="/my-orders" title="My Orders" className="p-1.5 text-blue-800/50 hover:text-blue-700 transition-colors rounded-lg">
                    <Package className="w-3.5 h-3.5" />
                  </Link>
                  <button type="button" onClick={handleLogout} title="Sign out" className="p-1.5 text-blue-800/50 hover:text-red-600 transition-colors rounded-lg">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-l border-blue-900/10 pl-2">
                  <Link href="/login" className="text-xs font-medium text-blue-800/60 hover:text-blue-950 px-2 py-1.5">Sign In</Link>
                  <Link href="/signup" className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">Sign Up</Link>
                </div>
              )}

              <Link href="/wishlist" className="relative p-1.5 text-blue-900/70 hover:text-blue-950 transition-colors">
                <Heart style={{ width: 18, height: 18 }} />
                {wishlistCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">{wishlistCount}</span>}
              </Link>
              <Link href="/cart" className="relative p-1.5 text-blue-900/70 hover:text-blue-950 transition-colors">
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-600 rounded-full">{totalItems}</span>}
              </Link>
            </div>

            <div className="md:hidden flex items-center gap-1 ml-auto">
              {user && <Link href="/my-orders" className="p-2 text-blue-900"><Package className="w-5 h-5" /></Link>}
              <Link href="/wishlist" className="relative p-2 text-blue-900">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{wishlistCount}</span>}
              </Link>
              <Link href="/cart" className="relative p-2 text-blue-900">
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-white bg-blue-600 rounded-full">{totalItems}</span>}
              </Link>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-blue-900">
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-white/20 absolute w-full z-50">
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-blue-900 hover:bg-white/20 rounded-md uppercase tracking-wider">{link.label}</Link>
              ))}
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-blue-800/50 uppercase tracking-wide">Currency:</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="text-sm text-blue-900 bg-transparent border-0 focus:outline-none">
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-blue-900 font-medium flex items-center gap-2"><User className="w-4 h-4" /> {user.name}</div>
                  <Link href="/my-orders" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-900 hover:bg-white/20 rounded-md"><Package className="w-4 h-4" /> My Orders</Link>
                  <button type="button" onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-white/20 rounded-md"><LogOut className="w-4 h-4" /> Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-blue-900 hover:bg-white/20 rounded-md">Sign In</Link>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md text-center">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full relative z-10">{children}</main>

      <footer className="glass-panel mt-auto border-t border-white/20 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <p className="font-serif text-blue-950 font-bold mb-3 tracking-widest">JOJO COLLECTIONS</p>
              <p className="text-blue-800/60 text-xs leading-relaxed">Premium fragrances for the modern connoisseur.</p>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Shop</p>
              <div className="space-y-2">
                <Link href="/shop" className="block text-blue-800/60 hover:text-blue-900 text-sm">All Products</Link>
                <Link href="/bundles" className="block text-blue-800/60 hover:text-blue-900 text-sm">Gift Sets</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Explore</p>
              <div className="space-y-2">
                <Link href="/blog" className="block text-blue-800/60 hover:text-blue-900 text-sm">Fragrance Journal</Link>
                <Link href="/wishlist" className="block text-blue-800/60 hover:text-blue-900 text-sm">My Wishlist</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Account</p>
              <div className="space-y-2">
                <Link href="/my-orders" className="block text-blue-800/60 hover:text-blue-900 text-sm">My Orders</Link>
                <Link href="/login" className="block text-blue-800/60 hover:text-blue-900 text-sm">Sign In</Link>
                <Link href="/signup" className="block text-blue-800/60 hover:text-blue-900 text-sm">Create Account</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center">
            <p className="text-xs text-blue-800/50 uppercase tracking-widest">&copy; {new Date().getFullYear()} Jojo Collections. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all hover:scale-110"
          style={{ width: 52, height: 52 }} title="Chat on WhatsApp">
          <MessageCircle className="w-6 h-6 text-white fill-white" />
        </a>
      )}
    </div>
  );
}
