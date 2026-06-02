import { createRoot } from "react-dom/client";
import App from "./App";
import { setBaseUrl } from "@workspace/api-client-react";
import "./index.css";

// Apply saved theme before first paint to avoid flash
try {
  const saved = localStorage.getItem("jojo-theme") ?? "blue";
  document.documentElement.setAttribute("data-theme", saved);
} catch {}

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
