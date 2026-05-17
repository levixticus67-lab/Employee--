import { Link, useLocation } from "wouter";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { useWishlist } from "./wishlist-context";
import { useCurrency, type Currency } from "./currency-context";
import { ShoppingBag, Menu, X, User, LogOut, Heart, MessageCircle, BookOpen, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
    fetch("/api/settings/public")
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

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
      setLocation("/");
    } catch {
      toast.error("Could not sign out");
    }
  }

  const currencies: Currency[] = ["USD", "UGX", "EUR", "GBP"];
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel-heavy border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-serif text-blue-950 font-bold tracking-wider">
                JOJO COLLECTIONS
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-5 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium uppercase tracking-widest transition-colors ${
                    location === link.href ? "text-blue-900" : "text-blue-800/70 hover:text-blue-950"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Currency Switcher */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="text-xs font-medium uppercase tracking-wider text-blue-800/70 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer hover:text-blue-950"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {user ? (
                <div className="flex items-center gap-3 pl-2 border-l border-blue-900/15">
                  <span className="flex items-center gap-2 text-sm text-blue-900 font-medium">
                    <User className="w-4 h-4" />
                    {user.name.split(" ")[0]}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Sign out"
                    className="text-sm text-blue-800/70 hover:text-red-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 pl-2 border-l border-blue-900/15">
                  <Link href="/login" className="text-sm font-medium uppercase tracking-widest text-blue-800/70 hover:text-blue-950">
                    Sign In
                  </Link>
                  <Link href="/signup" className="text-sm font-medium px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2 text-blue-900 hover:text-blue-950 transition-colors">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <Link href="/cart" className="relative p-2 text-blue-900 hover:text-blue-950 transition-colors">
                <ShoppingBag className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-blue-600 rounded-full">
                    {totalItems}
                  </span>
                )}
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <Link href="/wishlist" className="relative p-2 text-blue-900">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full" style={{ fontSize: 9 }}>
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link href="/cart" className="relative p-2 text-blue-900">
                <ShoppingBag className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {totalItems}
                  </span>
                )}
              </Link>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-blue-900">
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-white/20 absolute w-full z-50">
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md">
                  {link.label}
                </Link>
              ))}
              <div className="px-3 py-2">
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="text-sm text-blue-900 bg-transparent border-0 focus:outline-none">
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-blue-900 font-medium">Signed in as {user.name}</div>
                  <button type="button" onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-red-700 hover:bg-white/20 rounded-md">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md">Sign In</Link>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative z-10">{children}</main>

      {/* Footer */}
      <footer className="glass-panel mt-auto border-t border-white/20 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <p className="font-serif text-blue-950 font-bold mb-3">JOJO COLLECTIONS</p>
              <p className="text-blue-800/60 text-xs leading-relaxed">Premium fragrances for the modern connoisseur.</p>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Shop</p>
              <div className="space-y-2">
                <Link href="/shop" className="block text-blue-800/60 hover:text-blue-900">All Products</Link>
                <Link href="/bundles" className="block text-blue-800/60 hover:text-blue-900">Gift Sets</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Explore</p>
              <div className="space-y-2">
                <Link href="/blog" className="block text-blue-800/60 hover:text-blue-900">Fragrance Journal</Link>
                <Link href="/wishlist" className="block text-blue-800/60 hover:text-blue-900">My Wishlist</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-blue-950 mb-3 uppercase tracking-wider text-xs">Account</p>
              <div className="space-y-2">
                <Link href="/login" className="block text-blue-800/60 hover:text-blue-900">Sign In</Link>
                <Link href="/signup" className="block text-blue-800/60 hover:text-blue-900">Create Account</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center">
            <p className="text-xs text-blue-800/50 uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Jojo Collections. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all hover:scale-110"
          title="Chat on WhatsApp"
        >
          <MessageCircle className="w-7 h-7 text-white fill-white" />
        </a>
      )}
    </div>
  );
}
