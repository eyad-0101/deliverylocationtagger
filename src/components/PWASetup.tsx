"use client";

import { useEffect, useState } from "react";

// Chrome/Edge fire this instead of showing their own install UI, so we can
// show a custom button and trigger the native prompt on demand. Not
// standardized (no TS lib type for it), hence the manual type below.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PWASetup() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — app works fine without it, just no shell caching.
      });
    }

    // Already running as an installed app (standalone display mode) — no
    // point offering to install again. One-time read of existing browser
    // state on mount, not an async fetch — see ThemeToggle.tsx for the
    // same pattern with more detail.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstalled(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || !installEvent) return null;

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // Whatever the user chose, the event can only be used once.
    setInstallEvent(null);
  }

  return (
    <div className="mx-4 mt-3 card bg-blue-50 border-blue-200 text-sm flex items-center justify-between gap-3">
      <span>ثبّت التطبيق على شاشتك الرئيسية للوصول السريع، حتى بدون فتح المتصفح</span>
      <div className="flex gap-2 shrink-0">
        <button onClick={handleInstall} className="btn-primary text-xs py-1.5 px-3">
          تثبيت
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-[var(--color-muted)] cursor-pointer"
        >
          لاحقًا
        </button>
      </div>
    </div>
  );
}
