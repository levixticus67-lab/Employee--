import { useState, type FormEvent, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth-context";

export default function AdminLoginPage() {
  const { adminLogin, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) setLocation("/admin");
  }, [isAdmin, setLocation]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminLogin(password);
      toast.success("Welcome to the admin dashboard");
      setLocation("/admin");
    } catch {
      toast.error("Incorrect admin password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="max-w-md w-full">
        <div className="glass-panel-heavy rounded-3xl p-8 border border-white/30">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-700" />
            </div>
          </div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2 text-center">
            Admin Access
          </h1>
          <p className="text-blue-800/70 text-center mb-8 text-sm">
            Enter the admin password to continue
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Password
              </label>
              <input
                type="password"
                autoFocus
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
              {submitting ? "Verifying…" : "Enter Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
