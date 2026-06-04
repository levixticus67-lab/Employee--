import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { useAuth } from "@/components/auth-context";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const { sendResetEmail } = useAuth();
  const [email, setEmail]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]         = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendResetEmail(email);
      // Always show success — never reveal whether the email is registered
      setSent(true);
    } catch {
      // Only genuine failures (network, service down) reach here
      toast.error("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100/60 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-serif text-blue-950 mb-3">Check Your Inbox</h1>
            <p className="text-blue-800/70 text-sm mb-2">
              If <span className="font-medium text-blue-950">{email}</span> is registered with us,
              you'll receive a password reset link shortly.
            </p>
            <p className="text-blue-800/50 text-xs mb-8">
              The link expires in 1 hour. Check your spam folder if you don't see it.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 py-3 px-8 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
            <p className="text-xs text-blue-800/40 mt-6">
              Wrong email?{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-blue-700 underline hover:no-underline"
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-100/60 flex items-center justify-center">
              <Mail className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2 text-center">
            Forgot Password?
          </h1>
          <p className="text-blue-800/70 text-center mb-8 text-sm">
            Enter your email and we'll send you a reset link if an account exists.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-blue-950 placeholder-blue-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
