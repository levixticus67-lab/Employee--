import { Link, useLocation } from "wouter";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { ShoppingBag, Menu, X, User, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function Layout({ children }: { children: React.ReactNode }) {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
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

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel-heavy border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-serif text-blue-950 font-bold tracking-wider">
                JOJO COLLECTIONS
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-6 items-center">
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

              {user ? (
                <div className="flex items-center gap-4 pl-2 border-l border-blue-900/15">
                  <span className="flex items-center gap-2 text-sm text-blue-900 font-medium">
                    <User className="w-4 h-4" />
                    {user.name.split(" ")[0]}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Sign out"
                    className="text-sm text-blue-800/70 hover:text-red-700 transition-colors flex items-center gap-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 pl-2 border-l border-blue-900/15">
                  <Link
                    href="/login"
                    className="text-sm font-medium uppercase tracking-widest text-blue-800/70 hover:text-blue-950"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm font-medium px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

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
            <div className="md:hidden flex items-center">
              <Link href="/cart" className="relative p-2 mr-4 text-blue-900">
                <ShoppingBag className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-blue-600 rounded-full">
                    {totalItems}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-blue-900 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden glass-panel border-t border-white/20 absolute w-full">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md"
                >
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-blue-900 font-medium">
                    Signed in as {user.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-red-700 hover:bg-white/20 rounded-md"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 text-base font-medium text-blue-900 hover:bg-white/20 rounded-md"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="glass-panel mt-auto border-t border-white/20 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-blue-800/70 font-medium tracking-widest uppercase">
            &copy; {new Date().getFullYear()} Jojo Collections. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
