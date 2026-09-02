import { createClient } from "@/lib/supabase/server";

// Ported from Outlier Engine's lib/baselines.ts + lib/outliers.ts so the
// "viral" call here matches exactly what that app itself would show —
// same constants, same math. Not imported directly since the two apps are
// deliberately separate codebases/deploys sharing only the database.

type PostType = "reel" | "trial_reel" | "carousel" | "photo";

type SharedPost = {
  id: string;
  url: string;
  caption: string | null;
  post_type: PostType;
  date_posted: string;
  views: number;
};

type BaselineStatus = "real" | "seeded" | "calibrating";
type Baseline = { status: BaselineStatus; value: number | null; sampleSize: number };

const MIN_POSTS_FOR_REAL_BASELINE = 8;
const BASELINE_WINDOW = 20;
const VIRAL_MULTIPLIER = 10;

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Baseline = median views of a creator's last 20 posts of one post type (or
// all of them if fewer than 20). A baseline_seed is used instead for a reel
// type with fewer than 8 real posts on record ("seeded"), until 8 exist.
function computeBaseline(postsOfType: SharedPost[], type: PostType, baselineSeed: number | null): Baseline {
  const sampleSize = postsOfType.length;
  const recent = [...postsOfType]
    .sort((a, b) => new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime())
    .slice(0, BASELINE_WINDOW);
  const medianViews = recent.length > 0 ? median(recent.map((p) => p.views)) : null;

  if (sampleSize >= MIN_POSTS_FOR_REAL_BASELINE) {
    return { status: "real", value: medianViews, sampleSize };
  }
  if (type === "reel" && baselineSeed != null) {
    return { status: "seeded", value: baselineSeed, sampleSize };
  }
  return { status: "calibrating", value: medianViews, sampleSize };
}

export type ViralPostCandidate = {
  postId: string;
  title: string;
  originalLink: string;
  datePosted: string;
  views: number;
  multiplier: number;
};

// Reels/trial reels only, tier === "viral" (10x+ their own baseline),
// scanning every post on record for this creator — Outlier Engine's synced
// history currently only goes back a couple of months anyway, so there's no
// separate "how far back" cutoff to apply on top of that.
export async function getViralReelCandidates(creatorId: string): Promise<ViralPostCandidate[]> {
  const supabase = await createClient();

  const { data: creatorRow, error: creatorError } = await supabase
    .from("creators")
    .select("baseline_seed")
    .eq("id", creatorId)
    .single();
  if (creatorError) throw new Error(creatorError.message);

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, url, caption, post_type, date_posted, views")
    .eq("creator_id", creatorId)
    .in("post_type", ["reel", "trial_reel"]);
  if (postsError) throw new Error(postsError.message);

  const reelPosts = (posts ?? []) as SharedPost[];
  const byType: Record<string, SharedPost[]> = {};
  for (const post of reelPosts) {
    (byType[post.post_type] ??= []).push(post);
  }

  const candidates: ViralPostCandidate[] = [];
  for (const [type, postsOfType] of Object.entries(byType)) {
    const baseline = computeBaseline(postsOfType, type as PostType, creatorRow?.baseline_seed ?? null);
    if (baseline.status === "calibrating" || !baseline.value || baseline.value <= 0) continue;

    for (const post of postsOfType) {
      const multiplier = post.views / baseline.value;
      if (multiplier >= VIRAL_MULTIPLIER) {
        candidates.push({
          postId: post.id,
          title: post.caption?.trim().slice(0, 80) || `Reel from ${post.date_posted}`,
          originalLink: post.url,
          datePosted: post.date_posted,
          views: post.views,
          multiplier,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.multiplier - a.multiplier);
}
