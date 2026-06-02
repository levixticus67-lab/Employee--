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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try { return (localStorage.getItem("jojo-theme") as AppTheme) ?? "blue"; }
    catch { return "blue"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("jojo-theme", theme); } catch {}
  }, [theme]);

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
