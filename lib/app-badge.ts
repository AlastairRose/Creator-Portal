import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWeekStart } from "@/lib/weeks";

// The red number on the portal's home-screen icon: how many things are
// waiting for the creator. Same things her dashboard counts, plus video
// calls still waiting for her answer.
const VIDEO_CALL_BADGE_DAYS = 7;

export async function getCreatorBadgeCount(creatorId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - VIDEO_CALL_BADGE_DAYS * 24 * 3600e3).toISOString();
    const [week, customs, onlyfans, calls] = await Promise.all([
      admin
        .from("content_weeks")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("week_start_date", getCurrentWeekStart())
        .eq("status", "published")
        .maybeSingle(),
      admin
        .from("outstanding_customs")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "outstanding"),
      admin
        .from("onlyfans_content_requests")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "open")
        .eq("urgency", "highly_requested")
        .eq("draft", false),
      admin
        .from("video_call_requests")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "pending")
        .gte("created_at", since),
    ]);
    if (week.error || customs.error || onlyfans.error || calls.error) {
      throw week.error ?? customs.error ?? onlyfans.error ?? calls.error;
    }

    let reels = 0;
    if (week.data?.id) {
      const { count, error } = await admin
        .from("reels")
        .select("id", { count: "exact", head: true })
        .eq("content_week_id", week.data.id)
        .eq("status", "planned");
      if (error) throw error;
      reels = count ?? 0;
    }
    return reels + (customs.count ?? 0) + (onlyfans.count ?? 0) + (calls.count ?? 0);
  } catch (err) {
    console.error(`Couldn't count badge items for creator ${creatorId}:`, err);
    return -1; // unknown: leave the current number alone
  }
}
