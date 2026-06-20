import { createRoot } from "react-dom/client";
import App from "./App";
import { setBaseUrl } from "@workspace/api-client-react";
import "./index.css";

// Apply saved theme before first paint — admin and storefront use separate keys
try {
  const key = window.location.pathname.startsWith("/admin")
    ? "jojo-theme-admin"
    : "jojo-theme-store";
  const saved = localStorage.getItem(key) ?? "blue";
  document.documentElement.setAttribute("data-theme", saved);
} catch {}

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
