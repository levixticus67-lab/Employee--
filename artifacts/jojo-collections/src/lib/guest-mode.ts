export const LENZ_GUEST_KEY = "lenz-guest";

export function isGuestMode(): boolean {
  try { return localStorage.getItem(LENZ_GUEST_KEY) === "1"; } catch { return false; }
}

export function setGuestMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(LENZ_GUEST_KEY, "1");
    else localStorage.removeItem(LENZ_GUEST_KEY);
  } catch {}
}
