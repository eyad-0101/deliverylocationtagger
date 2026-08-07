"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  // Starts false to match server-rendered markup, then syncs to the real
  // state (set by ThemeScript before paint) right after mount — avoids a
  // hydration mismatch warning without needing to read localStorage during
  // render.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Reads state that ThemeScript (an inline <script> in <head>) already
    // set on <html> before this component ever mounted — this is a one-
    // time read of existing DOM state to sync React with it, not the
    // "fetch then setState" pattern the rule is meant to catch. Doing it in
    // an effect (rather than a lazy useState initializer) is deliberate:
    // it must run client-side only, since the server-rendered markup can't
    // know the visitor's saved theme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
      className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer p-2 rounded-lg hover:bg-[var(--color-muted-bg)]"
    >
      {dark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
