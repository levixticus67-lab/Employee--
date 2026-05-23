const FALLBACK: Record<string, number> = { USD: 1, UGX: 3700, EUR: 0.92, GBP: 0.79 };

interface RateCache { rates: Record<string, number>; fetchedAt: number }
let cache: RateCache | null = null;

export async function getLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < 3_600_000) return cache.rates;
  try {
    const res  = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { result?: string; rates?: Record<string, number> };
    if (data.result === "success" && data.rates) {
      cache = { rates: data.rates, fetchedAt: now };
      return data.rates;
    }
  } catch { /* network error — use fallback */ }
  return { ...FALLBACK };
}

export async function getUsdToUgxRate(): Promise<number> {
  const rates = await getLiveRates();
  return rates["UGX"] ?? FALLBACK["UGX"]!;
}
