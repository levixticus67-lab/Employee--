import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { useAuth } from "@/components/auth-context";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const { login, googleSignIn } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      setLocation("/");
    } catch (err) {
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
      toast.success("Welcome back!");
      setLocation("/");
    } catch {
      toast.error("Could not sign in with Google");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30">
          <h1 className="text-3xl font-serif text-blue-950 mb-2 text-center">
            Welcome Back
          </h1>
          <p className="text-blue-800/70 text-center mb-8 text-sm">
            Sign in to continue your fragrance journey
          </p>
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
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Password
              </label>
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
