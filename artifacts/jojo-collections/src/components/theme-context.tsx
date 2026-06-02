import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "blue" | "gold";

interface ThemeContextType {
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "blue",
  toggleTheme: () => {},
});

export function ThemeProvider({
  children,
  storageKey = "jojo-theme",
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try { return (localStorage.getItem(storageKey) as AppTheme) ?? "blue"; }
    catch { return "blue"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(storageKey, theme); } catch {}
  }, [theme, storageKey]);

  const toggleTheme = () => setTheme(t => t === "blue" ? "gold" : "blue");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
