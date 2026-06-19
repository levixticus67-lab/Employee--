import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { useAuth, EmailNotVerifiedError } from "@/components/auth-context";
import { Mail, UserX, CheckCircle2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { setGuestMode } from "@/lib/guest-mode";

export default function LoginPage() {
  const { login, googleSignIn } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const search = useSearch();
  const emailVerified = new URLSearchParams(search).get("verified") === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setUnverified(false);
    try {
      await login(email, password);
      setGuestMode(false);
      toast.success("Welcome back!");
      setLocation("/");
    } catch (err) {
      if (err instanceof EmailNotVerifiedError) {
        setUnverified(true);
        toast.error(
          "Please check your inbox and verify your email link to activate your account and log in.",
          { duration: 6000 }
        );
        return;
      }
      const msg =
        err && typeof err === "object" && "data" in err
          ? ((err as { data?: { error?: string } }).data?.error ?? "Invalid email or password")
          : "Invalid email or password";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await googleSignIn();
      setGuestMode(false);
      toast.success("Welcome back!");
      setLocation("/");
    } catch {
      toast.error("Could not sign in with Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleContinueAsGuest() {
    setGuestMode(true);
    setLocation("/shop");
  }

  return (
    <Layout>
      {showGuestWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-panel-heavy rounded-3xl p-6 max-w-sm w-full border border-white/30 space-y-4 shadow-2xl">
            <h2 className="text-xl font-serif text-blue-950">Before you continue</h2>
            <ul className="space-y-2.5 text-sm text-blue-800/80">
              <li className="flex items-start gap-2.5">
                <span className="text-green-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                Browse the shop, journals &amp; bundles
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                Add to cart and wishlist
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                Place orders — online payment only (Pesapal)
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">✗</span>
                No order history — contact us on WhatsApp with your order number for updates
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">✗</span>
                Cash on delivery not available for guests
              </li>
            </ul>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleContinueAsGuest}
                className="w-full py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Got it — continue as guest
              </button>
              <button
                onClick={() => setShowGuestWarning(false)}
                className="w-full py-2.5 rounded-full border border-blue-200/40 text-blue-800/70 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Sign in instead
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30">
          <h1 className="text-3xl font-serif text-blue-950 mb-2 text-center">
            Welcome Back
          </h1>
          <p className="text-blue-800/70 text-center mb-8 text-sm">
            Sign in to continue your fragrance journey
          </p>

          {emailVerified && (
            <div className="flex items-start gap-3 rounded-xl bg-green-50/60 border border-green-200/60 px-4 py-3 mb-5">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-800">
                Your email is verified! Sign in below to access your account.
              </p>
            </div>
          )}

          {unverified && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50/60 border border-amber-200/60 px-4 py-3 mb-5">
              <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Please check your inbox and verify your email link to activate your account and log in.
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-blue-950 placeholder-blue-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-blue-900">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-blue-950 placeholder-blue-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-blue-200/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/20 backdrop-blur-sm px-3 text-xs text-blue-800/60">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-full bg-white/60 border border-white/50 text-blue-950 font-medium hover:bg-white/80 disabled:opacity-60 transition-colors shadow-sm"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-blue-300/40 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <FcGoogle className="w-5 h-5" />
            )}
            Continue with Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-blue-200/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/20 backdrop-blur-sm px-3 text-xs text-blue-800/40">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuestWarning(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-blue-200/30 text-blue-800/55 text-sm font-medium hover:bg-white/10 hover:text-blue-800/80 transition-colors"
          >
            <UserX className="w-4 h-4" />
            Continue as Guest
          </button>

          <p className="text-center text-sm text-blue-800/70 mt-6">
            Don't have an account?{" "}
            <Link href="/signup" className="text-blue-700 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
