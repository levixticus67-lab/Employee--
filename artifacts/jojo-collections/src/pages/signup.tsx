import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Layout } from "@/components/layout";
import { useAuth, EmailVerificationSentError } from "@/components/auth-context";
import { Mail, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

// Per-email rate limit: max 2 resends per 24 h, stored in localStorage
function getResendState(email: string): { count: number; windowStart: number } {
  try {
    const raw = localStorage.getItem(`vEmail_resends_${email}`);
    if (!raw) return { count: 0, windowStart: Date.now() };
    const parsed = JSON.parse(raw) as { count: number; windowStart: number };
    const hoursSince = (Date.now() - parsed.windowStart) / 3_600_000;
    if (hoursSince >= 24) {
      localStorage.removeItem(`vEmail_resends_${email}`);
      return { count: 0, windowStart: Date.now() };
    }
    return parsed;
  } catch {
    return { count: 0, windowStart: Date.now() };
  }
}

function saveResendState(email: string, count: number, windowStart: number) {
  localStorage.setItem(`vEmail_resends_${email}`, JSON.stringify({ count, windowStart }));
}

export default function SignupPage() {
  const { signup, resendVerificationEmail, googleSignIn } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  // Resend state
  const [resendCount, setResendCount] = useState(0);
  const [resendWindowStart, setResendWindowStart] = useState(Date.now());
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const MAX_RESENDS = 2;
  const resendExhausted = resendCount >= MAX_RESENDS;

  // Load resend state from localStorage when verification screen appears
  useEffect(() => {
    if (!verificationSent || !verificationEmail) return;
    const state = getResendState(verificationEmail);
    setResendCount(state.count);
    setResendWindowStart(state.windowStart);
  }, [verificationSent, verificationEmail]);

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

  async function handleResend() {
    if (resendExhausted || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail();
      const newCount = resendCount + 1;
      setResendCount(newCount);
      saveResendState(verificationEmail, newCount, resendWindowStart);
      if (newCount >= MAX_RESENDS) {
        toast.success("Verification email sent. This is your last resend for today.");
      } else {
        toast.success("Verification email sent again!");
      }
    } catch {
      toast.error("Could not resend the verification email. Please try again later.");
    } finally {
      setResending(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await googleSignIn();
      toast.success("Welcome to Jojo Collections!");
      setLocation("/");
    } catch {
      toast.error("Could not sign in with Google. Please try again.");
    } finally {
      setGoogleLoading(false);
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
              Please check your inbox (or spam/junk folder) and verify your email link to activate your account and log in.
            </p>
            <Link
              href="/login"
              className="inline-block py-3 px-8 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </Link>

            {/* Resend section */}
            <div className="mt-6 pt-6 border-t border-white/20">
              {resendExhausted ? (
                <div className="flex items-start gap-2 text-left bg-amber-50/40 border border-amber-200/50 rounded-xl px-4 py-3">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    You've used all your resends for today. Please check your spam folder or try again tomorrow.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-blue-800/50">
                  Didn't receive it? Check your spam folder or{" "}
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1 text-blue-700 underline hover:no-underline disabled:opacity-50"
                  >
                    {resending ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" /> Sending…
                      </>
                    ) : (
                      `resend it (${MAX_RESENDS - resendCount} left)`
                    )}
                  </button>
                  .
                </p>
              )}
            </div>
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
