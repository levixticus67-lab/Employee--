import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type LiveRates  = { USD: number; UGX: number; EUR: number; GBP: number };
type HistoryPt  = { date: string; UGX: number; EUR: number; GBP: number };
type ChartPt    = { label: string; UGX: number; EUR: number; GBP: number };
type OverrideDoc = { UGX?: number; EUR?: number; GBP?: number; expiresAt?: string | null; setAt?: string };

const CURRENCIES = [
  { key: "UGX" as const, label: "UGX / USD", color: "#3b82f6", grad: "ugxGrad" },
  { key: "EUR" as const, label: "EUR / USD", color: "#818cf8", grad: "eurGrad" },
  { key: "GBP" as const, label: "GBP / USD", color: "#34d399", grad: "gbpGrad" },
];

function fmt(key: "UGX" | "EUR" | "GBP", val: number) {
  return key === "UGX" ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) : val.toFixed(4);
}

function RateTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-blue-950/90 backdrop-blur-md border border-blue-400/30 rounded-xl px-4 py-3 shadow-xl text-white text-sm min-w-[170px]">
      <p className="font-medium text-blue-200 mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-white text-xs">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminExchangeRates() {
  const [rates,     setRates]     = useState<LiveRates | null>(null);
  const [history,   setHistory]   = useState<HistoryPt[]>([]);
  const [override,  setOverride]  = useState<OverrideDoc | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [range,     setRange]     = useState<7 | 14 | 30>(7);

  // Override form state
  const [overrideUGX, setOverrideUGX] = useState("");
  const [overrideEUR, setOverrideEUR] = useState("");
  const [overrideGBP, setOverrideGBP] = useState("");
  const [overrideHours, setOverrideHours] = useState("24");
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [ratesRes, histRes, ovRes] = await Promise.all([
        apiFetch("/api/exchange-rates").then((r) => r.json() as Promise<LiveRates>),
        apiFetch(`/api/admin/exchange-rates/history?days=${range}`).then((r) => r.json() as Promise<HistoryPt[]>),
        apiFetch("/api/admin/exchange-rates/override").then((r) => r.ok ? r.json() as Promise<OverrideDoc | null> : Promise.resolve(null)),
      ]);
      setRates(ratesRes);
      setHistory(histRes);
      setOverride(ovRes);
      setLastFetched(new Date());
    } catch {
      toast.error("Could not refresh exchange rates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => { void fetchAll(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Build chart data: normalize each series as % change from first point
  const chartData: ChartPt[] = (() => {
    if (history.length < 2) return [];
    const base = history[0]!;
    return history.map((pt) => ({
      label: new Date(pt.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      UGX: parseFloat((((pt.UGX - base.UGX) / base.UGX) * 100).toFixed(3)),
      EUR: parseFloat((((pt.EUR - base.EUR) / base.EUR) * 100).toFixed(3)),
      GBP: parseFloat((((pt.GBP - base.GBP) / base.GBP) * 100).toFixed(3)),
    }));
  })();

  const handleSaveOverride = async () => {
    const payload: Record<string, unknown> = {};
    if (overrideUGX) payload["UGX"] = parseFloat(overrideUGX);
    if (overrideEUR) payload["EUR"] = parseFloat(overrideEUR);
    if (overrideGBP) payload["GBP"] = parseFloat(overrideGBP);
    if (!Object.keys(payload).length) { toast.error("Enter at least one rate to override"); return; }
    payload["expiresInHours"] = parseFloat(overrideHours) || 24;
    setSavingOverride(true);
    try {
      const res = await apiFetch("/api/admin/exchange-rates/override", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Rate override saved — all prices and Pesapal charges will use these rates");
      setOverrideUGX(""); setOverrideEUR(""); setOverrideGBP("");
      await fetchAll();
    } catch { toast.error("Failed to save override"); }
    finally { setSavingOverride(false); }
  };

  const handleClearOverride = async () => {
    try {
      await apiFetch("/api/admin/exchange-rates/override", { method: "DELETE" });
      toast.success("Override cleared — live rates restored");
      setOverride(null);
      await fetchAll();
    } catch { toast.error("Failed to clear override"); }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Exchange Rates</h1>
          <p className="text-blue-900/70 text-sm">
            Live rates from open.er-api.com · auto-refreshes every hour · used for all prices and Pesapal charges
          </p>
          {lastFetched && (
            <p className="text-xs text-blue-800/40 mt-1">Last refreshed: {lastFetched.toLocaleTimeString()}</p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="glass-card border-blue-200/50 text-blue-700 hover:bg-blue-50/30 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Override banner */}
      {override && (
        <div className="mb-6 glass-card rounded-2xl p-4 border-amber-300/50 bg-amber-50/20 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Manual override active</p>
            <p className="text-xs text-amber-800/70 mt-0.5">
              {override.UGX && `UGX ${override.UGX.toLocaleString()}  `}
              {override.EUR && `EUR ${override.EUR}  `}
              {override.GBP && `GBP ${override.GBP}  `}
              {override.expiresAt ? `· expires ${new Date(override.expiresAt).toLocaleString()}` : "· no expiry"}
            </p>
          </div>
          <button
            onClick={handleClearOverride}
            className="text-xs text-amber-700 underline hover:no-underline flex-shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Live rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {CURRENCIES.map(({ key, label, color }) => (
          <div key={key} className="glass-panel rounded-2xl p-6 border-white/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-blue-900/70">{label}</p>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            </div>
            <p className="text-3xl font-serif text-blue-950">
              {rates ? fmt(key, rates[key]) : "—"}
            </p>
            <p className="text-xs text-blue-800/40 mt-1">per 1 USD</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50 mb-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-serif text-blue-950 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Currency Trends
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-800/50">Range:</span>
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  range === d
                    ? "bg-blue-600 text-white"
                    : "glass-card text-blue-700 border-white/40 hover:border-blue-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 text-blue-800/40">
            <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Not enough history yet</p>
            <p className="text-xs mt-1">Rate snapshots are stored hourly. Check back in a few hours.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-blue-800/40 mb-4">Showing % change relative to start of selected range — all currencies on one scale</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {CURRENCIES.map(({ key, color, grad }) => (
                    <linearGradient key={key} id={grad} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0}   />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.2)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "rgba(186,230,253,0.75)", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${(v as number).toFixed(1)}%`}
                  width={52}
                />
                <Tooltip content={<RateTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: "rgba(186,230,253,0.8)", paddingTop: "12px" }}
                />
                {CURRENCIES.map(({ key, color, grad, label }) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${grad})`}
                    dot={false}
                    activeDot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Manual Override */}
      <div className="glass-panel-heavy rounded-3xl p-6 border-white/50">
        <div className="flex items-center gap-2 mb-2">
          {override ? <Lock className="w-5 h-5 text-amber-500" /> : <Unlock className="w-5 h-5 text-blue-500" />}
          <h2 className="text-xl font-serif text-blue-950">Manual Rate Override</h2>
        </div>
        <p className="text-sm text-blue-800/60 mb-6">
          Lock in a specific exchange rate temporarily — useful for promotions or when the live rate is temporarily off. Leave any field blank to keep its live rate.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { key: "UGX", val: overrideUGX, set: setOverrideUGX, placeholder: `Live: ${rates ? Math.round(rates.UGX) : "—"}`, step: "1" },
            { key: "EUR", val: overrideEUR, set: setOverrideEUR, placeholder: `Live: ${rates ? rates.EUR.toFixed(4) : "—"}`, step: "0.0001" },
            { key: "GBP", val: overrideGBP, set: setOverrideGBP, placeholder: `Live: ${rates ? rates.GBP.toFixed(4) : "—"}`, step: "0.0001" },
          ].map(({ key, val, set, placeholder, step }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-blue-900/70 mb-1.5">{key} per 1 USD</label>
              <input
                type="number"
                step={step}
                min="0"
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
              />
            </div>
          ))}
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-blue-900/70 mb-1.5">Override duration</label>
            <select
              value={overrideHours}
              onChange={(e) => setOverrideHours(e.target.value)}
              className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40 bg-white/20"
            >
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours (default)</option>
              <option value="48">48 hours</option>
              <option value="168">1 week</option>
              <option value="0">No expiry</option>
            </select>
          </div>

          <div className="flex gap-3">
            {override && (
              <Button
                variant="outline"
                onClick={handleClearOverride}
                className="glass-card border-red-200/50 text-red-700 hover:bg-red-50/30 gap-2"
              >
                <Unlock className="w-4 h-4" /> Clear Override
              </Button>
            )}
            <Button
              onClick={handleSaveOverride}
              disabled={savingOverride}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {savingOverride
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              Save Override
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 glass-card rounded-xl px-4 py-3 bg-blue-50/20 border-blue-200/30">
          <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800/60">
            An override affects all currency display on the storefront and the exact UGX amount charged through Pesapal. Clear it to restore live rates.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
