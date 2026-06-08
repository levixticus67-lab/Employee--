import { useState, useEffect } from "react";

  let _cachedPromise: Promise<string> | null = null;

  function resolveStoreName(): Promise<string> {
    if (!_cachedPromise) {
      _cachedPromise = fetch("/api/settings/public", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: { storeName?: string }) => d.storeName?.trim() || "Jojo Collections")
        .catch(() => "Jojo Collections");
    }
    return _cachedPromise;
  }

  export function useStoreName(): string {
    const [name, setName] = useState<string>("Jojo Collections");
    useEffect(() => { resolveStoreName().then(setName); }, []);
    return name;
  }
  