import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart-context";
import { AuthProvider, useAuth } from "@/components/auth-context";
import { WishlistProvider } from "@/components/wishlist-context";
import { CurrencyProvider } from "@/components/currency-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Mail, ArrowRight } from "lucide-react";
import NotFound from "@/pages/not-found";
import { isGuestMode } from "@/lib/guest-mode";

import Home          from "@/pages/home";
import Shop          from "@/pages/shop";
import ProductDetail from "@/pages/product";
import Cart          from "@/pages/cart";
import Checkout      from "@/pages/checkout";
import OrderConfirmation from "@/pages/order";
import LoginPage     from "@/pages/login";
import SignupPage    from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import WishlistPage  from "@/pages/wishlist";
import BlogPage      from "@/pages/blog";
import BlogPostPage  from "@/pages/blog-post";
import BundlesPage   from "@/pages/bundles";
import MyOrders      from "@/pages/my-orders";
import AdminLoginPage from "@/pages/admin/login";

import Dashboard     from "@/pages/admin/dashboard";
import AdminProducts from "@/pages/admin/products";
import AdminOrders   from "@/pages/admin/orders";
import AdminReviews  from "@/pages/admin/reviews";
import AdminCoupons  from "@/pages/admin/coupons";
import AdminBundles  from "@/pages/admin/bundles";
import AdminBlog     from "@/pages/admin/blog";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminSettings from "@/pages/admin/settings";
import AdminStorage  from "@/pages/admin/storage";
import BulkImport       from "@/pages/admin/bulk-import";
import AdminExchangeRates from "@/pages/admin/exchange-rates";
import AdminStockAlerts from "@/pages/admin/stock-alerts";
import PrivacyPolicy       from "@/pages/privacy-policy";
import TermsAndConditions from "@/pages/terms-and-conditions";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function VerifyEmailGate() {
  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="glass-panel-heavy rounded-3xl p-10 border-white/50 space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-100/60 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-blue-950 mb-3">Verify Your Email First</h2>
            <p className="text-blue-800/60 text-sm leading-relaxed">
              This page is only available to verified members. Please check your inbox for the
              verification link we sent when you signed up.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/login">
              <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2">
                Go to Login <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full rounded-xl glass-card border-white/40 text-blue-900">
                Back to Home
              </Button>
            </Link>
          </div>
          <p className="text-xs text-blue-800/40">
            Didn't receive the email? Check spam or{" "}
            <Link href="/signup" className="underline hover:no-underline text-blue-600">sign up again</Link>.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-blue-800/70">Loading…</div>;
  if (!isAdmin) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

// allowGuest: if true, guests with the lenz-guest flag can access this route
function ProtectedRoute({ children, allowGuest }: { children: React.ReactNode; allowGuest?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-blue-800/70">Loading…</div>;
  if (!user) {
    if (allowGuest && isGuestMode()) return <>{children}</>;
    return <Redirect to="/login" />;
  }
  if (!user.emailVerified) return <VerifyEmailGate />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* ── Publicly accessible ── */}
      <Route path="/"                component={Home} />
      <Route path="/login"           component={LoginPage} />
      <Route path="/signup"          component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/privacy-policy"   component={PrivacyPolicy} />
      <Route path="/terms"              component={TermsAndConditions} />

      {/* ── Open to guests and signed-in users ── */}
      <Route path="/shop">           <ProtectedRoute allowGuest><Shop /></ProtectedRoute></Route>
      <Route path="/product/:id">    <ProtectedRoute allowGuest><ProductDetail /></ProtectedRoute></Route>
      <Route path="/cart">           <ProtectedRoute allowGuest><Cart /></ProtectedRoute></Route>
      <Route path="/checkout">       <ProtectedRoute allowGuest><Checkout /></ProtectedRoute></Route>
      <Route path="/order/:id">      <ProtectedRoute allowGuest><OrderConfirmation /></ProtectedRoute></Route>
      <Route path="/wishlist">       <ProtectedRoute allowGuest><WishlistPage /></ProtectedRoute></Route>
      <Route path="/blog">           <ProtectedRoute allowGuest><BlogPage /></ProtectedRoute></Route>
      <Route path="/blog/:id">       <ProtectedRoute allowGuest><BlogPostPage /></ProtectedRoute></Route>
      <Route path="/bundles">        <ProtectedRoute allowGuest><BundlesPage /></ProtectedRoute></Route>

      {/* ── Signed-in only ── */}
      <Route path="/my-orders">      <ProtectedRoute><MyOrders /></ProtectedRoute></Route>

      {/* ── Admin ── */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/analytics">      <AdminRoute><AdminAnalytics /></AdminRoute></Route>
      <Route path="/admin/exchange-rates"><AdminRoute><AdminExchangeRates /></AdminRoute></Route>
      <Route path="/admin/products">  <AdminRoute><AdminProducts /></AdminRoute></Route>
      <Route path="/admin/orders">    <AdminRoute><AdminOrders /></AdminRoute></Route>
      <Route path="/admin/reviews">   <AdminRoute><AdminReviews /></AdminRoute></Route>
      <Route path="/admin/coupons">   <AdminRoute><AdminCoupons /></AdminRoute></Route>
      <Route path="/admin/bundles">   <AdminRoute><AdminBundles /></AdminRoute></Route>
      <Route path="/admin/blog">      <AdminRoute><AdminBlog /></AdminRoute></Route>
      <Route path="/admin/storage">   <AdminRoute><AdminStorage /></AdminRoute></Route>
      <Route path="/admin/bulk-import"><AdminRoute><BulkImport /></AdminRoute></Route>
      <Route path="/admin/stock-alerts"><AdminRoute><AdminStockAlerts /></AdminRoute></Route>
      <Route path="/admin/settings">  <AdminRoute><AdminSettings /></AdminRoute></Route>

      <Route path="/admin">           <AdminRoute><Dashboard /></AdminRoute></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => {
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CurrencyProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <WouterRouter base="/">
                  <ScrollToTop />
                  <Router />
                </WouterRouter>
                <Toaster position="bottom-right" className="glass-panel" />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </CurrencyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
