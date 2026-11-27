"use client";

import { useEffect } from "react";

// Keeps the red number on the home-screen icon in step with what's waiting
// whenever the portal is open. Notifications update it while it's closed.
export default function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    if (count < 0 || typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const nav = navigator as Navigator & { setAppBadge: (n?: number) => Promise<void>; clearAppBadge: () => Promise<void> };
    (count === 0 ? nav.clearAppBadge() : nav.setAppBadge(count)).catch(() => {});
  }, [count]);
  return null;
}
