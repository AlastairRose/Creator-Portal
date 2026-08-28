import type { Reel } from "@/lib/types";

// Never stored — computed at render time so it's always accurate against
// current reel data, same reasoning as the Dashboard's % complete.
export function computeReelsCompletedPercent(reels: Pick<Reel, "status">[]): number {
  if (reels.length === 0) return 0;
  const completed = reels.filter((r) => ["uploaded", "edited", "posted"].includes(r.status)).length;
  return Math.round((completed / reels.length) * 100);
}

export function computeRevenueChangePercent(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
