import { Link, useLocation } from "wouter";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { useWishlist } from "./wishlist-context";
import { useCurrency, type Currency } from "./currency-context";
import { useTheme } from "./theme-context";
import { ShoppingBag, Menu, X, User, LogOut, Heart, MessageCircle, Package } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type BannerMediaType = "none" | "image" | "video";

type PublicSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
  logoUrl: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerBgColor: string;
  bannerMediaUrl: string;
  bannerMediaType: BannerMediaType;
  bannerCountdownEnabled: boolean;
  bannerCountdownEnd: string;
};

function useCountdown(targetIso: string, enabled: boolean) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !targetIso) { setTimeLeft(null); return; }
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0 }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s });
      rafRef.current = window.setTimeout(tick, 1000);
    };
    tick();
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [targetIso, enabled]);

  return timeLeft;
}

const PARTICLES = [
  { id: 0,  size: 4, left: 5,  dur: 9,    delay: 0    },
  { id: 1,  size: 3, left: 12, dur: 7,    delay: 2.5  },
  { id: 2,  size: 5, left: 20, dur: 11,   delay: 0.8  },
  { id: 3,  size: 3, left: 28, dur: 8,    delay: 4    },
  { id: 4,  size: 6, left: 35, dur: 10,   delay: 1.2  },
  { id: 5,  size: 3, left: 42, dur: 7.5,  delay: 3    },
  { id: 6,  size: 4, left: 50, dur: 9,    delay: 5.5  },
  { id: 7,  size: 5, left: 58, dur: 12,   delay: 0.3  },
  { id: 8,  size: 3, left: 65, dur: 8,    delay: 2    },
  { id: 9,  size: 4, left: 72, dur: 10,   delay: 4.5  },
  { id: 10, size: 6, left: 80, dur: 8.5,  delay: 1.8  },
  { id: 11, size: 3, left: 88, dur: 11,   delay: 3.5  },
  { id: 12, size: 4, left: 93, dur: 9,    delay: 0.5  },
  { id: 13, size: 5, left: 18, dur: 7,    delay: 6    },
  { id: 14, size: 3, left: 45, dur: 13,   delay: 1.5  },
  { id: 15, size: 4, left: 62, dur: 8,    delay: 7    },
  { id: 16, size: 5, left: 75, dur: 10,   delay: 2.2  },
  { id: 17, size: 3, left: 32, dur: 9,    delay: 8    },
  { id: 18, size: 6, left: 55, dur: 11,   delay: 0.7  },
  { id: 19, size: 4, left: 10, dur: 8,    delay: 5    },
  { id: 20, size: 3, left: 82, dur: 12,   delay: 3.8  },
  { id: 21, size: 5, left: 48, dur: 9.5,  delay: 1    },
  { id: 22, size: 4, left: 25, dur: 7,    delay: 6.5  },
  { id: 23, size: 3, left: 70, dur: 10,   delay: 4    },
  { id: 24, size: 5, left: 38, dur: 8,    delay: 9    },
  { id: 25, size: 3, left: 90, dur: 11,   delay: 2.8  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { currency, setCurrency } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({
    whatsappNumber: "",
    whatsappMessage: "Hi! I need help.",
    logoUrl: "",
    bannerEnabled: false,
    bannerText: "",
    bannerBgColor: "#1e3a8a",
    bannerMediaUrl: "",
    bannerMediaType: "none",
    bannerCountdownEnabled: false,
    bannerCountdownEnd: "",
  });

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => setSettings((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  }, []);

  const countdown = useCountdown(settings.bannerCountdownEnd, settings.bannerCountdownEnabled);

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

  const whatsappUrl = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(settings.whatsappMessage)}`
    : null;

  const hasMedia = settings.bannerMediaUrl && settings.bannerMediaType !== "none";
  const showBanner = settings.bannerEnabled && !bannerDismissed;
  const bannerMinHeight = hasMedia ? 52 : 40;

  return (
    <div className="min-h-screen flex flex-col relative">

      {/* Floating blue particle background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              bottom: "-20px",
              "--dur": `${p.dur}s`,
              "--delay": `${p.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Announcement Banner */}
      {showBanner && (
        <div
          className="relative w-full overflow-hidden flex-shrink-0 flex items-center justify-center z-10"
          style={{ minHeight: bannerMinHeight, background: hasMedia ? undefined : settings.bannerBgColor }}
        >
          {settings.bannerMediaType === "video" && settings.bannerMediaUrl && (
            <video src={settings.bannerMediaUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted playsInline />
          )}
          {settings.bannerMediaType === "image" && settings.bannerMediaUrl && (
            <img src={settings.bannerMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: hasMedia ? `${settings.bannerBgColor}99` : settings.bannerBgColor }} />
          <div className="relative z-10 flex flex-col items-center justify-center gap-2 px-10 py-4 text-center w-full">
            {settings.bannerText && (
              <p className="text-white font-semibold text-sm sm:text-base leading-snug drop-shadow-md">{settings.bannerText}</p>
            )}
            {settings.bannerCountdownEnabled && countdown && (
              <div className="flex items-center gap-2 mt-1">
                {[
                  { v: countdown.d, label: "Days" },
                  { v: countdown.h, label: "Hrs" },
                  { v: countdown.m, label: "Min" },
                  { v: countdown.s, label: "Sec" },
                ].map(({ v, label }, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1 min-w-[42px]">
                      <span className="text-white font-bold text-lg leading-none tabular-nums">{String(v).padStart(2, "0")}</span>
                      <span className="text-white/70 text-[9px] uppercase tracking-wider">{label}</span>
                    </div>
                    {i < 3 && <span className="text-white/80 font-bold text-lg">:</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setBannerDismissed(true)} className="absolute right-3 top-3 z-20 text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/20" aria-label="Dismiss banner">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 glass-panel-heavy border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20 gap-6">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2.5">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" className="w-9 h-9 rounded-full object-cover border-2 border-sky-400/30 shadow-sm flex-shrink-0" />
              )}
              <span className="text-2xl font-serif text-sky-50 font-bold tracking-widest">JOJO</span>
            </Link>

            <nav className="hidden md:flex items-center gap-5 flex-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`text-sm font-medium uppercase tracking-wider transition-colors ${location === link.href ? "text-sky-50 font-semibold" : "text-sky-300/60 hover:text-sky-100"}`}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2 ml-auto">
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="text-xs font-medium text-sky-300/70 bg-transparent border-0 focus:outline-none cursor-pointer hover:text-sky-100 pr-1">
                {currencies.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={theme === "gold" ? "Switch to Blue theme" : "Switch to Gold theme"}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-300 border"
                style={theme === "gold"
                  ? { background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.3)", color: "rgb(251,191,36)" }
                  : { background: "rgba(125,211,252,0.08)", borderColor: "rgba(125,211,252,0.2)", color: "rgb(125,211,252)" }
                }
              >
                <span className="w-2 h-2 rounded-full inline-block transition-colors duration-300"
                  style={{ background: theme === "gold" ? "rgb(251,191,36)" : "rgb(125,211,252)" }} />
                {theme === "gold" ? "Gold" : "Blue"}
              </button>

              {user ? (
                <div className="flex items-center gap-1 border-l border-sky-400/10 pl-2">
                  <Link href="/my-orders" className="flex items-center gap-1.5 text-xs text-sky-200 font-medium px-2 hover:text-sky-50 transition-colors">
                    <User className="w-3.5 h-3.5" />{user.name.split(" ")[0]}
                  </Link>
                  <Link href="/my-orders" title="My Orders" className="p-1.5 text-sky-300/60 hover:text-sky-200 transition-colors rounded-lg">
                    <Package className="w-3.5 h-3.5" />
                  </Link>
                  <button type="button" onClick={handleLogout} title="Sign out" className="p-1.5 text-sky-300/60 hover:text-red-400 transition-colors rounded-lg">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-l border-sky-400/10 pl-2">
                  <Link href="/login" className="text-xs font-medium text-sky-300/70 hover:text-sky-50 px-2 py-1.5">Sign In</Link>
                  <Link href="/signup" className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-400 transition-colors">Sign Up</Link>
                </div>
              )}

              <Link href="/wishlist" className="relative p-1.5 text-sky-300/80 hover:text-sky-100 transition-colors">
                <Heart style={{ width: 18, height: 18 }} />
                {wishlistCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">{wishlistCount}</span>}
              </Link>
              <Link href="/cart" className="relative p-1.5 text-sky-300/80 hover:text-sky-100 transition-colors">
                <ShoppingBag className="w-6 h-6" />
                {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full">{totalItems}</span>}
              </Link>
            </div>

            <div className="md:hidden flex items-center gap-1 ml-auto">
              {user && <Link href="/my-orders" className="p-2 text-sky-200"><Package className="w-5 h-5" /></Link>}
              <Link href="/wishlist" className="relative p-2 text-sky-200">
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-white bg-red-500 rounded-full">{wishlistCount}</span>}
              </Link>
              <Link href="/cart" className="relative p-2 text-sky-200">
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-white bg-blue-500 rounded-full">{totalItems}</span>}
              </Link>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-sky-200">
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute w-full z-50 border-t border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl">
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 text-sm font-medium rounded-xl uppercase tracking-wider transition-colors ${location === link.href ? "bg-white/10 text-sky-50 font-semibold" : "text-sky-200 hover:bg-white/8"}`}>{link.label}</Link>
              ))}
              <div className="px-3 py-2 flex items-center gap-2 border-t border-white/10 mt-2 pt-3">
                <span className="text-xs text-sky-300/60 uppercase tracking-wide">Currency:</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="text-sm text-sky-100 bg-transparent border-0 focus:outline-none">
                  {currencies.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-sky-300/60 uppercase tracking-wide">Theme:</span>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-all duration-300"
                  style={theme === "gold"
                    ? { background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.3)", color: "rgb(251,191,36)" }
                    : { background: "rgba(125,211,252,0.08)", borderColor: "rgba(125,211,252,0.2)", color: "rgb(125,211,252)" }
                  }
                >
                  <span className="w-2 h-2 rounded-full inline-block"
                    style={{ background: theme === "gold" ? "rgb(251,191,36)" : "rgb(125,211,252)" }} />
                  {theme === "gold" ? "Gold" : "Blue"}
                </button>
              </div>
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-sky-100 font-medium flex items-center gap-2 border-t border-white/10 mt-1 pt-3"><User className="w-4 h-4" /> {user.name}</div>
                  <Link href="/my-orders" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-sky-200 hover:bg-white/8 rounded-xl"><Package className="w-4 h-4" /> My Orders</Link>
                  <button type="button" onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl"><LogOut className="w-4 h-4" /> Sign out</button>
                </>
              ) : (
                <div className="flex flex-col gap-2 border-t border-white/10 mt-1 pt-3">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-sky-200 hover:bg-white/8 rounded-xl">Sign In</Link>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-400 rounded-xl text-center">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full relative z-10">{children}</main>

      <footer className="glass-panel mt-auto border-t border-white/10 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <p className="font-serif text-sky-50 font-bold mb-3 tracking-widest">JOJO COLLECTIONS</p>
              <p className="text-sky-300/60 text-xs leading-relaxed">Premium fragrances for the modern connoisseur.</p>
            </div>
            <div>
              <p className="font-medium text-sky-100 mb-3 uppercase tracking-wider text-xs">Shop</p>
              <div className="space-y-2">
                <Link href="/shop" className="block text-sky-300/60 hover:text-sky-100 text-sm">All Products</Link>
                <Link href="/bundles" className="block text-sky-300/60 hover:text-sky-100 text-sm">Gift Sets</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-sky-100 mb-3 uppercase tracking-wider text-xs">Explore</p>
              <div className="space-y-2">
                <Link href="/blog" className="block text-sky-300/60 hover:text-sky-100 text-sm">Fragrance Journal</Link>
                <Link href="/wishlist" className="block text-sky-300/60 hover:text-sky-100 text-sm">My Wishlist</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-sky-100 mb-3 uppercase tracking-wider text-xs">Account</p>
              <div className="space-y-2">
                <Link href="/my-orders" className="block text-sky-300/60 hover:text-sky-100 text-sm">My Orders</Link>
                <Link href="/login" className="block text-sky-300/60 hover:text-sky-100 text-sm">Sign In</Link>
                <Link href="/signup" className="block text-sky-300/60 hover:text-sky-100 text-sm">Create Account</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-sky-300/40 uppercase tracking-widest">&copy; {new Date().getFullYear()} Jojo Collections. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-400 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all hover:scale-110"
          style={{ width: 52, height: 52 }} title="Chat on WhatsApp">
          <MessageCircle className="w-6 h-6 text-white fill-white" />
        </a>
      )}
    </div>
  );
}
