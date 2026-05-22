import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { useAuth, EmailVerificationSentError } from "@/components/auth-context";
import { Mail, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const { signup } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await signup(name, email, password);
      toast.success("Account created. Welcome to Jojo Collections!");
      setLocation("/");
    } catch (err) {
      if (err instanceof EmailVerificationSentError) {
        setVerificationEmail(email);
        setVerificationSent(true);
        return;
      }
      const msg =
        err && typeof err === "object" && "data" in err
          ? ((err as { data?: { error?: string } }).data?.error ?? "Could not create account")
          : "Could not create account";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (verificationSent) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100/60 flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-2" />
            <h1 className="text-2xl font-serif text-blue-950 mb-3">Check Your Inbox</h1>
            <p className="text-blue-800/70 text-sm mb-2">
              We sent a verification link to
            </p>
            <p className="font-medium text-blue-950 mb-6 break-all">{verificationEmail}</p>
            <p className="text-blue-800/60 text-sm mb-8">
              Please check your inbox and verify your email link to activate your account and log in.
            </p>
            <Link
              href="/login"
              className="inline-block py-3 px-8 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </Link>
            <p className="text-center text-xs text-blue-800/50 mt-4">
              Didn't receive it? Check your spam folder or{" "}
              <button
                onClick={() => setVerificationSent(false)}
                className="text-blue-700 underline hover:no-underline"
              >
                try again
              </button>
              .
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
          <h1 className="text-3xl font-serif text-blue-950 mb-2 text-center">
            Create Your Account
          </h1>
          <p className="text-blue-800/70 text-center mb-8 text-sm">
            Join us to track orders and save your favorites
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-blue-950 placeholder-blue-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Jane Doe"
              />
            </div>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-blue-950 placeholder-blue-800/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="At least 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? "Creating account…" : "Create Account"}
            </button>
          </form>
          <p className="text-center text-sm text-blue-800/70 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-700 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
