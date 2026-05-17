import { createContext, useContext, useState, ReactNode } from "react";

export type Currency = "USD" | "UGX" | "EUR" | "GBP";

const RATES: Record<Currency, number> = {
  USD: 1,
  UGX: 3700,
  EUR: 0.92,
  GBP: 0.79,
};

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  UGX: "UGX ",
  EUR: "€",
  GBP: "£",
};

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (usdAmount: number) => string;
  symbol: string;
  convert: (usdAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      return (localStorage.getItem("jojo-currency") as Currency) || "USD";
    } catch {
      return "USD";
    }
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("jojo-currency", c); } catch {}
  };

  const convert = (usdAmount: number) => usdAmount * RATES[currency];

  const format = (usdAmount: number) => {
    const converted = convert(usdAmount);
    if (currency === "UGX") {
      return `${SYMBOLS[currency]}${Math.round(converted).toLocaleString()}`;
    }
    return `${SYMBOLS[currency]}${converted.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, symbol: SYMBOLS[currency], convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
