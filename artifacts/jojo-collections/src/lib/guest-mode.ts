export const LENZ_GUEST_KEY = "lenz-guest";
const LENZ_GUEST_SINCE_KEY = "lenz-guest-since";
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isGuestMode(): boolean {
  try {
    if (localStorage.getItem(LENZ_GUEST_KEY) !== "1") return false;
    const since = Number(localStorage.getItem(LENZ_GUEST_SINCE_KEY) ?? "0");
    if (since && Date.now() - since > GUEST_TTL_MS) {
      localStorage.removeItem(LENZ_GUEST_KEY);
      localStorage.removeItem(LENZ_GUEST_SINCE_KEY);
      return false;
    }
    return true;
  } catch { return false; }
}

export function setGuestMode(on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(LENZ_GUEST_KEY, "1");
      if (!localStorage.getItem(LENZ_GUEST_SINCE_KEY)) {
        localStorage.setItem(LENZ_GUEST_SINCE_KEY, String(Date.now()));
      }
    } else {
      localStorage.removeItem(LENZ_GUEST_KEY);
      localStorage.removeItem(LENZ_GUEST_SINCE_KEY);
    }
  } catch {}
}

export function exitGuestMode(): void {
  setGuestMode(false);
}
