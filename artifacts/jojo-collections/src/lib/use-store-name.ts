import { useState, useEffect } from "react";

let _cachedPromise: Promise<string> | null = null;
const _listeners = new Set<(name: string) => void>();

function resolveStoreName(): Promise<string> {
  if (!_cachedPromise) {
    _cachedPromise = fetch("/api/settings/public", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { storeName?: string }) => d.storeName?.trim() || "Fume")
      .catch(() => "Fume");
  }
  return _cachedPromise;
}

export function invalidateStoreName(): void {
  _cachedPromise = null;
  resolveStoreName().then((name) => {
    _listeners.forEach((set) => set(name));
  });
}

export function useStoreName(): string {
  const [name, setName] = useState<string>("Fume");
  useEffect(() => {
    resolveStoreName().then(setName);
    _listeners.add(setName);
    return () => { _listeners.delete(setName); };
  }, []);
  return name;
}
