import { useState, useEffect } from "react";
import { X, Download, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lenz-pwa-dismissed";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

function isMobileDevice(): boolean {
  return /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(
    navigator.userAgent
  );
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!isMobileDevice()) return;

    try {
      if (Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now() - DISMISS_TTL) return;
    } catch {}
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = !/(chrome|crios|fxios)/i.test(ua) && /safari/i.test(ua);
    if (isIos && isSafari) setIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setGone(true); setPrompt(null); setIos(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setGone(true);
    setPrompt(null);
  };

  if (gone || (!prompt && !ios)) return null;

  return (
    <div className="fixed left-0 right-0 z-[80]"
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="m-3 rounded-2xl border border-white/25 shadow-2xl p-4"
        style={{ background:"rgba(10,20,58,0.96)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
        <div className="flex items-start gap-3">
          <img
            src="/icons/apple-touch-icon.png"
            alt="LENZ"
            className="w-11 h-11 rounded-xl flex-shrink-0 object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sky-50 text-sm leading-tight">Install LENZ Fragrances</p>
            {ios ? (
              <p className="text-xs text-sky-300/70 mt-0.5 flex items-center gap-1 flex-wrap">
                Tap <Share2 className="w-3 h-3 inline text-sky-400" /> then <em className="not-italic font-medium text-sky-200">"Add to Home Screen"</em>
              </p>
            ) : (
              <p className="text-xs text-sky-300/70 mt-0.5">Shop faster — get it on your home screen</p>
            )}
          </div>
          <button onClick={dismiss} className="text-sky-400/50 hover:text-sky-200 transition-colors p-0.5 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!ios && (
          <div className="flex gap-2 mt-3">
            <button onClick={install}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold transition-colors"
              style={{ background:"#2563eb" }}>
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
            <button onClick={dismiss}
              className="px-4 py-2 rounded-xl text-sky-400/70 hover:text-sky-200 text-xs font-medium transition-colors">
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
