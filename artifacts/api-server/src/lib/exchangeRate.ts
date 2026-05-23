import { firestore, Timestamp } from "@workspace/db";

const FALLBACK: Record<string, number> = { USD: 1, UGX: 3700, EUR: 0.92, GBP: 0.79 };
const HISTORY_COL   = "exchangeRateHistory";
const OVERRIDE_DOC  = "settings/exchangeRateOverride";

interface RateCache { rates: Record<string, number>; fetchedAt: number }
let cache: RateCache | null = null;

async function getManualOverride(): Promise<Record<string, number> | null> {
  try {
    const snap = await firestore.doc(OVERRIDE_DOC).get();
    if (!snap.exists) return null;
    const data = snap.data() as { UGX?: number; EUR?: number; GBP?: number; expiresAt?: Timestamp };
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      void firestore.doc(OVERRIDE_DOC).delete();
      return null;
    }
    const rates: Record<string, number> = { USD: 1 };
    if (data.UGX) rates["UGX"] = data.UGX;
    if (data.EUR) rates["EUR"] = data.EUR;
    if (data.GBP) rates["GBP"] = data.GBP;
    return Object.keys(rates).length > 1 ? { ...FALLBACK, ...rates } : null;
  } catch { return null; }
}

async function saveSnapshot(rates: Record<string, number>): Promise<void> {
  try {
    await firestore.collection(HISTORY_COL).add({
      fetchedAt: Timestamp.now(),
      UGX: rates["UGX"] ?? FALLBACK["UGX"],
      EUR: rates["EUR"] ?? FALLBACK["EUR"],
      GBP: rates["GBP"] ?? FALLBACK["GBP"],
    });
  } catch { /* non-critical */ }
}

export async function getLiveRates(): Promise<Record<string, number>> {
  const override = await getManualOverride();
  if (override) return override;

  const now = Date.now();
  if (cache && now - cache.fetchedAt < 3_600_000) return cache.rates;

  try {
    const res  = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { result?: string; rates?: Record<string, number> };
    if (data.result === "success" && data.rates) {
      cache = { rates: data.rates, fetchedAt: now };
      void saveSnapshot(data.rates);
      return data.rates;
    }
  } catch { /* use fallback */ }
  return { ...FALLBACK };
}

export async function getUsdToUgxRate(): Promise<number> {
  const rates = await getLiveRates();
  return rates["UGX"] ?? FALLBACK["UGX"]!;
}

export async function getRateHistory(days = 7): Promise<Array<{ date: string; UGX: number; EUR: number; GBP: number }>> {
  try {
    const since = new Date(Date.now() - days * 86_400_000);
    const snap  = await firestore.collection(HISTORY_COL)
      .where("fetchedAt", ">=", Timestamp.fromDate(since))
      .orderBy("fetchedAt", "asc")
      .limit(500)
      .get();

    return snap.docs.map((d) => {
      const data = d.data() as { fetchedAt: Timestamp; UGX: number; EUR: number; GBP: number };
      return {
        date: data.fetchedAt.toDate().toISOString(),
        UGX: data.UGX ?? FALLBACK["UGX"]!,
        EUR: data.EUR ?? FALLBACK["EUR"]!,
        GBP: data.GBP ?? FALLBACK["GBP"]!,
      };
    });
  } catch { return []; }
}

export async function setRateOverride(
  rates: { UGX?: number; EUR?: number; GBP?: number },
  expiresInHours?: number,
): Promise<void> {
  const payload: Record<string, unknown> = { ...rates, setAt: Timestamp.now() };
  if (expiresInHours) {
    payload["expiresAt"] = Timestamp.fromMillis(Date.now() + expiresInHours * 3_600_000);
  }
  await firestore.doc(OVERRIDE_DOC).set(payload);
  cache = null; // invalidate cache so next request uses override
}

export async function clearRateOverride(): Promise<void> {
  await firestore.doc(OVERRIDE_DOC).delete();
  cache = null;
}

export async function getOverrideDoc(): Promise<Record<string, unknown> | null> {
  const snap = await firestore.doc(OVERRIDE_DOC).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const exp  = data["expiresAt"] as Timestamp | undefined;
  return { ...data, expiresAt: exp ? exp.toDate().toISOString() : null };
}
