import { Link, useLocation } from "wouter";
  import { useAuth } from "@/components/auth-context";
  import { toast } from "sonner";
  import { useState, useEffect, useRef } from "react";
  import { apiFetch } from "@/lib/api";
  import {
    LayoutDashboard, Package, ShoppingCart, MessageSquare,
    Tag, Gift, BookOpen, Upload, Settings, Home, LogOut, BarChart2, Archive, TrendingUp,
  } from "lucide-react";

  const FLOWERS = ["🌸", "🌺", "🌼", "🌻", "🌹", "💐", "🌷", "✨"];
  const RECENT_WINDOW_MS = 5 * 60 * 1000;
  const COOLDOWN_MS = 60_000;
  const CELEBRATED_KEY = "jojo-celebrated-orders";
  const LAST_CELEBRATED_KEY = "jojo-last-celebrated-at";

  function loadCelebrated(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]") as string[]); }
    catch { return new Set(); }
  }

  function saveCelebrated(set: Set<string>) {
    try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set])); } catch {}
  }

  function isOnCooldown(): boolean {
    try { return Date.now() - Number(localStorage.getItem(LAST_CELEBRATED_KEY) ?? 0) < COOLDOWN_MS; }
    catch { return false; }
  }

  function markCooldown() {
    try { localStorage.setItem(LAST_CELEBRATED_KEY, String(Date.now())); } catch {}
  }

  function FlowerCelebration({ onDone }: { onDone: () => void }) {
    useEffect(() => {
      const t = setTimeout(onDone, 4500);
      return () => clearTimeout(t);
    }, [onDone]);

    const particles = Array.from({ length: 36 }, (_, i) => ({
      id: i,
      emoji: FLOWERS[i % FLOWERS.length]!,
      left: parseFloat(((i / 36) * 98 + Math.random() * 3).toFixed(1)),
      delay: parseFloat((Math.random() * 2).toFixed(2)),
      duration: parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
      size: Math.round(22 + Math.random() * 26),
    }));

    return (
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <style>{`
          @keyframes adminFlowerRise {
            0%   { transform: translateY(0) rotate(0deg);    opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
          }
        `}</style>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              bottom: "-70px",
              fontSize: `${p.size}px`,
              animation: `adminFlowerRise ${p.duration}s ${p.delay}s ease-out forwards`,
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>
    );
  }

  export function AdminLayout({ children }: { children: React.ReactNode }) {
    const [location, setLocation] = useLocation();
    const { adminLogout } = useAuth();
    const [showCelebration, setShowCelebration] = useState(false);
    const [receivedCount, setReceivedCount] = useState(0);
    // Persisted in localStorage so navigating between pages doesn't reset it
    const celebratedRef = useRef<Set<string>>(loadCelebrated());

    useEffect(() => {
      const checkReceived = async () => {
        try {
          const res = await apiFetch("/api/admin/orders?status=received&includeArchived=true");
          if (!res.ok) return;
          const orders: any[] = await res.json();

          setReceivedCount(orders.length);

          const now = Date.now();
          const fresh = orders.filter((o) => {
            if (celebratedRef.current.has(o.id)) return false;
            const entry = (o.statusHistory ?? []).find((h: any) => h.status === "received");
            if (!entry) return false;
            return now - new Date(entry.timestamp).getTime() <= RECENT_WINDOW_MS;
          });

          // Always mark every received order as seen so future polls skip them
          orders.forEach((o) => celebratedRef.current.add(o.id));
          saveCelebrated(celebratedRef.current);

          // Only fire flowers if there are fresh orders AND we are not in the
          // 1-minute cooldown window (prevents re-triggering on page navigation)
          if (fresh.length > 0 && !isOnCooldown()) {
            markCooldown();
            setShowCelebration(true);
          }
        } catch {}
      };

      checkReceived();
      const interval = setInterval(checkReceived, 10_000);
      return () => clearInterval(interval);
    }, []);

    const navLinks = [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/admin/exchange-rates", label: "Exchange Rates", icon: TrendingUp },
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, badge: receivedCount > 0 ? receivedCount : undefined },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquare },
      { href: "/admin/coupons", label: "Coupons", icon: Tag },
      { href: "/admin/bundles", label: "Bundles", icon: Gift },
      { href: "/admin/blog", label: "Journal", icon: BookOpen },
      { href: "/admin/storage", label: "Storage", icon: Archive },
      { href: "/admin/bulk-import", label: "Bulk Import", icon: Upload },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ];

    async function handleLogout() {
      try {
        await adminLogout();
        toast.success("Logged out of admin");
        setLocation("/admin/login");
      } catch {
        toast.error("Could not log out");
      }
    }

    return (
      <div className="min-h-screen flex bg-transparent">
        {showCelebration && <FlowerCelebration onDone={() => setShowCelebration(false)} />}

        <aside className="w-64 glass-panel border-r border-white/30 hidden md:flex flex-col relative z-20">
          <div className="h-20 flex items-center px-6 border-b border-white/20">
            <Link href="/admin" className="text-xl font-serif text-blue-950 font-bold tracking-wider">
              JOJO ADMIN
            </Link>
          </div>
          <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href || (link.href !== "/admin" && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                    isActive
                      ? "bg-blue-600/20 text-blue-900 border border-white/40 shadow-inner"
                      : "text-blue-800/70 hover:bg-white/20 hover:text-blue-900"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-white/20 space-y-1">
            <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-800/70 hover:bg-white/20 hover:text-blue-900 transition-all font-medium text-sm">
              <Home className="w-4 h-4" />
              Storefront
            </Link>
            <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-800/70 hover:bg-red-500/15 hover:text-red-700 transition-all font-medium text-sm">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="md:hidden glass-panel h-16 flex items-center justify-between px-4 border-b border-white/30">
            <span className="font-serif font-bold text-blue-950">JOJO ADMIN</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm text-blue-800 underline">Exit</Link>
              <button type="button" onClick={handleLogout} className="text-sm text-red-700 underline">Sign out</button>
            </div>
          </header>
          <div className="flex-1 p-4 md:p-8 overflow-auto">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  }
  