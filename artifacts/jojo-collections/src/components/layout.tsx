import { Link, useLocation } from "wouter";
import { useCart } from "./cart-context";
import { useAuth } from "./auth-context";
import { useWishlist } from "./wishlist-context";
import { useCurrency, type Currency } from "./currency-context";
import { useTheme, ThemeProvider } from "./theme-context";
import { ShoppingBag, User, LogOut, Heart, MessageCircle, Package, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type BannerMediaType = "none" | "image" | "video";

type PublicSettings = {
  whatsappNumber: string;
  whatsappMessage: string;
  logoUrl: string;
  storeName?: string;
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

/* ── Floating pill bottom nav (mobile only) ── */
function FloatingPillNav({
  location,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  wishlistCount,
  totalItems,
}: {
  location: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  wishlistCount: number;
  totalItems: number;
}) {
  const [pressed, setPressed] = useState<string | null>(null);

  const press = (id: string) => {
    setPressed(id);
    setTimeout(() => setPressed(null), 150);
  };

  const navItems = [
    {
      id: "home",
      href: "/",
      label: "Home",
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill={active ? "#0d1b3e" : "none"}
          stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          <path d="M9 21V12h6v9" stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"}/>
        </svg>
      ),
    },
    {
      id: "shop",
      href: "/shop",
      label: "Shop",
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
          stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/>
        </svg>
      ),
    },
    {
      id: "wishlist",
      href: "/wishlist",
      label: "Wishlist",
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
          stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
    },
    {
      id: "journal",
      href: "/blog",
      label: "Journal",
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
          stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
        </svg>
      ),
    },
    {
      id: "menu",
      href: null,
      label: "Menu",
      icon: (active: boolean) => (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
          stroke={active ? "#0d1b3e" : "rgba(255,255,255,0.65)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      ),
    },
  ] as const;

  return (
    <div
      className="fixed bottom-7 left-0 right-0 flex justify-center md:hidden"
      style={{ zIndex: 60 }}
    >
      <div
        className="flex items-center gap-1 px-2 py-2"
        style={{
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {navItems.map(({ id, href, label, icon }) => {
          const isActive = href ? location === href : isMobileMenuOpen;
          const isPressed = pressed === id;

          const inner = (
            <>
              {icon(isActive)}
              {isActive && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0d1b3e",
                    whiteSpace: "nowrap",
                    marginLeft: 6,
                  }}
                >
                  {label}
                </span>
              )}
              {id === "wishlist" && !isActive && wishlistCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </>
          );

          const btnStyle: React.CSSProperties = {
            position: "relative",
            display: "flex",
            alignItems: "center",
            padding: isActive ? "10px 16px" : "10px 11px",
            borderRadius: "999px",
            background: isActive ? "rgba(255,255,255,0.95)" : "transparent",
            transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            transform: isPressed ? "scale(0.88)" : "scale(1)",
            border: "none",
            cursor: "pointer",
          };

          if (href) {
            return (
              <Link key={id} href={href} onClick={() => press(id)} style={btnStyle}>
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={id}
              onClick={() => { setIsMobileMenuOpen(!isMobileMenuOpen); press(id); }}
              style={btnStyle}
            >
              {inner}
            </button>
          );
        })}

        {/* Cart — separate white circle */}
        <Link
          href="/cart"
          onClick={() => press("cart")}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 4,
            flexShrink: 0,
            transition: "transform 0.15s ease",
            transform: pressed === "cart" ? "scale(0.88)" : "scale(1)",
          }}
        >
          <ShoppingBag style={{ width: 19, height: 19, color: "#0d1b3e" }} />
          {totalItems > 0 && (
            <span
              style={{
                position: "absolute",
                top: 0,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#3b82f6",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {totalItems > 9 ? "9+" : totalItems}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
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

  useEffect(() => { if (settings.storeName) document.title = settings.storeName; }, [settings.storeName]);

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
              <span className="text-2xl font-serif text-sky-50 font-bold tracking-widest">{(settings.storeName || "Fume").toUpperCase()}</span>
            </Link>

            <nav className="hidden md:flex items-center gap-5 flex-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`text-sm font-medium uppercase tracking-wider transition-colors ${location === link.href ? "text-sky-50 font-semibold" : "text-sky-300/60 hover:text-sky-100"}`}>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop right icons */}
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

            {/* Mobile — logo only; pill nav handles navigation */}
            <div className="md:hidden flex items-center gap-1 ml-auto">
              {isMobileMenuOpen && (
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-sky-200"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
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

      <main className="flex-1 w-full relative z-10 pb-28 md:pb-0">{children}</main>

      <footer className="glass-panel mt-auto border-t border-white/10 py-10 relative z-10 pb-28 md:pb-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-sm">
            <div>
              <p className="font-serif text-sky-50 font-bold mb-3 tracking-widest">{(settings.storeName || "Fume").toUpperCase()}</p>
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
            <p className="text-xs text-sky-300/40 uppercase tracking-widest">&copy; {new Date().getFullYear()} {settings.storeName || "Fume"}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating pill nav — mobile only */}
      <FloatingPillNav
        location={location}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        wishlistCount={wishlistCount}
        totalItems={totalItems}
      />

      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-24 right-6 z-50 bg-green-500 hover:bg-green-400 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all hover:scale-110 md:bottom-6"
          style={{ width: 52, height: 52 }} title="Chat on WhatsApp">
          <MessageCircle className="w-6 h-6 text-white fill-white" />
        </a>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider storageKey="jojo-theme-store">
      <LayoutContent>{children}</LayoutContent>
    </ThemeProvider>
  );
}
