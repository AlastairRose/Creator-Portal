"use client";

import { useState } from "react";

// The pre-hydration script in app/layout.tsx already set the real class on
// <html> before this ever renders client-side, so reading it directly as
// the lazy initial state (rather than syncing via an effect) gives the
// correct value immediately. The one unavoidable mismatch is against the
// server's render (which has no DOM to read), so the label/icon are marked
// suppressHydrationWarning — expected and harmless, not a real bug.
function getInitialIsDark(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage can throw in private-browsing contexts — fine to skip.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-surface-raised hover:text-foreground"
    >
      <span aria-hidden="true" suppressHydrationWarning>
        {isDark ? "🌙" : "☀️"}
      </span>
      <span suppressHydrationWarning>{isDark ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
