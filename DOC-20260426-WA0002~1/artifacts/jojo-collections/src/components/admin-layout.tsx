import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  MessageSquare,
  LogOut,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { adminLogout } = useAuth();

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/reviews", label: "Reviews", icon: MessageSquare },
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
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/admin" && location.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
                  isActive
                    ? "bg-blue-600/20 text-blue-900 border border-white/40 shadow-inner"
                    : "text-blue-800/70 hover:bg-white/20 hover:text-blue-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/20 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-800/70 hover:bg-white/20 hover:text-blue-900 transition-all font-medium"
          >
            <Home className="w-5 h-5" />
            Storefront
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-800/70 hover:bg-red-500/15 hover:text-red-700 transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
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
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-red-700 underline"
            >
              Sign out
            </button>
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
