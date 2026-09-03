import type { SupabaseClient } from "@supabase/supabase-js";

// Once a Winning 30 reel's scheduled_for date arrives, it should read as
// posted rather than sit there looking like it's still due — this moves
// that date into last_posted_date and clears scheduled_for back to blank
// (ready for the next repost to be scheduled). <= today also mops up
// anything missed by a prior day's run, so this is safe to re-run anytime.
export async function advanceScheduledWinningReels(admin: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: selectError } = await admin
    .from("winning_reels")
    .select("id, scheduled_for")
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", today);
  if (selectError) throw new Error(selectError.message);
  if (!due || due.length === 0) return 0;

  for (const row of due) {
    const { error } = await admin
      .from("winning_reels")
      .update({ last_posted_date: row.scheduled_for, scheduled_for: null })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  return due.length;
}
