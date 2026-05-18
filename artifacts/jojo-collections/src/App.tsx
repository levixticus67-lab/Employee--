import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart-context";
import { AuthProvider, useAuth } from "@/components/auth-context";
import { WishlistProvider } from "@/components/wishlist-context";
import { CurrencyProvider } from "@/components/currency-context";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Shop from "@/pages/shop";
import ProductDetail from "@/pages/product";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import OrderConfirmation from "@/pages/order";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import WishlistPage from "@/pages/wishlist";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import BundlesPage from "@/pages/bundles";
import MyOrders from "@/pages/my-orders";
import AdminLoginPage from "@/pages/admin/login";

import Dashboard from "@/pages/admin/dashboard";
import AdminProducts from "@/pages/admin/products";
import AdminOrders from "@/pages/admin/orders";
import AdminReviews from "@/pages/admin/reviews";
import AdminCoupons from "@/pages/admin/coupons";
import AdminBundles from "@/pages/admin/bundles";
import AdminBlog from "@/pages/admin/blog";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminSettings from "@/pages/admin/settings";
import AdminStorage from "@/pages/admin/storage";
import BulkImport from "@/pages/admin/bulk-import";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-blue-800/70">Loading…</div>;
  if (!isAdmin) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/order/:id" component={OrderConfirmation} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/wishlist" component={WishlistPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:id" component={BlogPostPage} />
      <Route path="/bundles" component={BundlesPage} />
      <Route path="/my-orders" component={MyOrders} />

      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin"><AdminRoute><Dashboard /></AdminRoute></Route>
      <Route path="/admin/analytics"><AdminRoute><AdminAnalytics /></AdminRoute></Route>
      <Route path="/admin/products"><AdminRoute><AdminProducts /></AdminRoute></Route>
      <Route path="/admin/orders"><AdminRoute><AdminOrders /></AdminRoute></Route>
      <Route path="/admin/reviews"><AdminRoute><AdminReviews /></AdminRoute></Route>
      <Route path="/admin/coupons"><AdminRoute><AdminCoupons /></AdminRoute></Route>
      <Route path="/admin/bundles"><AdminRoute><AdminBundles /></AdminRoute></Route>
      <Route path="/admin/blog"><AdminRoute><AdminBlog /></AdminRoute></Route>
      <Route path="/admin/storage"><AdminRoute><AdminStorage /></AdminRoute></Route>
      <Route path="/admin/bulk-import"><AdminRoute><BulkImport /></AdminRoute></Route>
      <Route path="/admin/settings"><AdminRoute><AdminSettings /></AdminRoute></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CurrencyProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <WouterRouter base="/">
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
