import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRecentWeeks } from "@/lib/weeks";
import type {
  ContentWeek,
  Creator,
  CreatorDriveLinks,
  CreatorPlan,
  CreatorSocialAccount,
  DashboardCreatorRow,
  DashboardWeekStats,
  CulturalEvent,
  Idea,
  OfcdIdeaWithItems,
  OnlyfansContentRequestWithItems,
  OutstandingCustom,
  Profile,
  RdIdea,
  Reel,
  Report,
  ReportPeriodType,
  Sop,
  WinningReel,
} from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Profile[];
}

// Reads from Outlier Engine's `creators` table in the shared database.
export async function getCreators(): Promise<Creator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id, name, ig_handle, archived")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Creator[];
}

// For the public, unauthenticated sales intake form only — there's no
// session to carry RLS, so this deliberately uses the service-role client.
// Read-only, and only ever returns name/id, nothing sensitive.
export async function getCreatorsPublic(): Promise<Creator[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("creators")
    .select("id, name, ig_handle, archived")
    .eq("archived", false)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Creator[];
}

// For the public, unauthenticated sales intake form only — see
// getCreatorsPublic above for why this uses the service-role client.
export async function getCreatorPublic(creatorId: string): Promise<Creator | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("creators")
    .select("id, name, ig_handle, archived")
    .eq("id", creatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Creator | null;
}

export async function getCreator(creatorId: string): Promise<Creator | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id, name, ig_handle, archived")
    .eq("id", creatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Creator | null;
}

export async function getContentWeek(
  creatorId: string,
  weekStartDate: string
): Promise<ContentWeek | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_weeks")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentWeek | null;
}

export async function getReelsForWeek(contentWeekId: string): Promise<Reel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("content_week_id", contentWeekId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Reel[];
}

export async function getRdIdeas(): Promise<RdIdea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rd_ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as RdIdea[];
}

export async function getIdeas(): Promise<Idea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Idea[];
}

export async function getCreatorSocialAccounts(creatorId: string): Promise<CreatorSocialAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_social_accounts")
    .select("*")
    .eq("creator_id", creatorId);
  if (error) throw new Error(error.message);
  return data as CreatorSocialAccount[];
}

export async function getCreatorPlan(creatorId: string): Promise<CreatorPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_plans")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CreatorPlan | null;
}

// Oldest last_posted_date first (nulls — never posted — count as most
// overdue, so they lead) — the most overdue-for-a-repost reel sits at the
// top, and whatever was most recently reposted drops to the bottom.
export async function getWinningReels(creatorId: string): Promise<WinningReel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("winning_reels")
    .select("*")
    .eq("creator_id", creatorId)
    .order("last_posted_date", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return data as WinningReel[];
}

export async function getOnlyfansRequests(creatorId: string): Promise<OnlyfansContentRequestWithItems[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onlyfans_content_requests")
    .select("*, onlyfans_sexting_items(*)")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    onlyfans_sexting_items: [...row.onlyfans_sexting_items].sort((a, b) => a.sort_order - b.sort_order),
  })) as OnlyfansContentRequestWithItems[];
}

export async function getOfcdIdeas(): Promise<OfcdIdeaWithItems[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofcd_ideas")
    .select("*, ofcd_idea_sexting_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    ofcd_idea_sexting_items: [...row.ofcd_idea_sexting_items].sort((a, b) => a.sort_order - b.sort_order),
  })) as OfcdIdeaWithItems[];
}

export async function getCulturalEvents(): Promise<CulturalEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cultural_events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data as CulturalEvent[];
}

export async function getSops(): Promise<Sop[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sops")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Sop[];
}

export async function getCreatorDriveLinks(creatorId: string): Promise<CreatorDriveLinks | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_drive_links")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CreatorDriveLinks | null;
}

export async function getOutstandingCustoms(creatorId: string): Promise<OutstandingCustom[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outstanding_customs")
    .select("*")
    .eq("creator_id", creatorId)
    .order("requested_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as OutstandingCustom[];
}

export async function getReports(creatorId: string): Promise<Report[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("creator_id", creatorId)
    .order("period_start", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Report[];
}

export async function getReport(id: string): Promise<Report | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Report | null;
}

// The most recent prior report of the same period_type, for computing %
// revenue change — never stored, always derived at render time.
export async function getPreviousReport(
  creatorId: string,
  periodType: ReportPeriodType,
  beforePeriodStart: string
): Promise<Report | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("period_type", periodType)
    .lt("period_start", beforePeriodStart)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Report | null;
}

// All reels planned for this creator across content_weeks whose week falls
// inside [periodStart, periodEnd] — used to compute % reels completed.
export async function getReelsForPeriod(
  creatorId: string,
  periodStart: string,
  periodEnd: string
): Promise<Pick<Reel, "status">[]> {
  const supabase = await createClient();
  const { data: weeks, error: weeksError } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("creator_id", creatorId)
    .gte("week_start_date", periodStart)
    .lte("week_start_date", periodEnd);
  if (weeksError) throw new Error(weeksError.message);

  const weekIds = (weeks ?? []).map((w) => w.id);
  if (weekIds.length === 0) return [];

  const { data: reels, error: reelsError } = await supabase
    .from("reels")
    .select("status")
    .in("content_week_id", weekIds);
  if (reelsError) throw new Error(reelsError.message);
  return (reels ?? []) as Pick<Reel, "status">[];
}

// Weekly planned/uploaded/posted/% complete for the given creators over the
// last 3 weeks + current. RLS already scopes this correctly on its own — a
// creator's session only ever sees their own published weeks regardless of
// which creatorIds are passed in, so the same query works for both the
// staff-wide table and a single creator's own view. Only published weeks
// count (a week still being drafted in Creative Direction isn't a real
// commitment yet).
export async function getDashboardRows(creatorIds: string[]): Promise<DashboardCreatorRow[]> {
  if (creatorIds.length === 0) return [];
  const weeks = listRecentWeeks(4);
  const supabase = await createClient();

  const [{ data: creators, error: creatorsError }, { data: contentWeeks, error: weeksError }] =
    await Promise.all([
      supabase.from("creators").select("id, name, ig_handle, archived").in("id", creatorIds),
      supabase
        .from("content_weeks")
        .select("id, creator_id, week_start_date")
        .in("creator_id", creatorIds)
        .in("week_start_date", weeks)
        .eq("status", "published"),
    ]);
  if (creatorsError) throw new Error(creatorsError.message);
  if (weeksError) throw new Error(weeksError.message);

  const weekIds = (contentWeeks ?? []).map((w) => w.id);
  const { data: reels, error: reelsError } =
    weekIds.length > 0
      ? await supabase.from("reels").select("content_week_id, status").in("content_week_id", weekIds)
      : { data: [] as { content_week_id: string; status: string }[], error: null };
  if (reelsError) throw new Error(reelsError.message);

  const reelsByWeekId = new Map<string, { status: string }[]>();
  for (const reel of reels ?? []) {
    const list = reelsByWeekId.get(reel.content_week_id) ?? [];
    list.push(reel);
    reelsByWeekId.set(reel.content_week_id, list);
  }

  const contentWeekByCreatorAndWeek = new Map<string, { id: string }>();
  for (const cw of contentWeeks ?? []) {
    contentWeekByCreatorAndWeek.set(`${cw.creator_id}:${cw.week_start_date}`, cw);
  }

  return (creators ?? []).map((creator) => {
    const weekStats: DashboardWeekStats[] = weeks.map((weekStartDate) => {
      const contentWeek = contentWeekByCreatorAndWeek.get(`${creator.id}:${weekStartDate}`);
      const weekReels = contentWeek ? reelsByWeekId.get(contentWeek.id) ?? [] : [];
      const planned = weekReels.length;
      const uploaded = weekReels.filter((r) =>
        ["uploaded", "edited", "posted"].includes(r.status)
      ).length;
      const posted = weekReels.filter((r) => r.status === "posted").length;
      return {
        weekStartDate,
        planned,
        uploaded,
        posted,
        percentComplete: planned > 0 ? Math.round((uploaded / planned) * 100) : 0,
      };
    });
    return { creator: creator as Creator, weeks: weekStats };
  });
}
