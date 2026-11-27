import { createAdminClient } from "@/lib/supabase/admin";

// The red number on the portal's home-screen icon. Kept to the things that
// need a reply from her: outstanding customs and video calls still waiting
// for an answer. Reels and OnlyFans lists are left out on purpose, so the
// number stays small enough to act on.
const VIDEO_CALL_BADGE_DAYS = 7;

export async function getCreatorBadgeCount(creatorId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - VIDEO_CALL_BADGE_DAYS * 24 * 3600e3).toISOString();
    const [customs, calls] = await Promise.all([
      admin
        .from("outstanding_customs")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "outstanding"),
      admin
        .from("video_call_requests")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "pending")
        .gte("created_at", since),
    ]);
    if (customs.error || calls.error) throw customs.error ?? calls.error;
    return (customs.count ?? 0) + (calls.count ?? 0);
  } catch (err) {
    console.error(`Couldn't count badge items for creator ${creatorId}:`, err);
    return -1; // unknown: leave the current number alone
  }
}
