import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-context";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, ShoppingCart, MessageSquare,
  Tag, Gift, BookOpen, Upload, Settings, Home, LogOut, BarChart2, Archive,
} from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { adminLogout } = useAuth();

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
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
      {/* Sidebar */}
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
                {link.label}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden glass-panel h-16 flex items-center justify-between px-4 border-b border-white/30">
          <span className="font-serif font-bold text-blue-950">JOJO ADMIN</span>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-blue-800 underline">Exit</Link>
            <button type="button" onClick={handleLogout} className="text-sm text-red-700 underline">Sign out</button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
