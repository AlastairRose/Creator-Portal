import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ContentWeek,
  Creator,
  CreatorPlan,
  CreatorSocialAccount,
  OnlyfansContentRequest,
  OutstandingCustom,
  Profile,
  RdIdea,
  Reel,
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

export async function getOnlyfansRequests(creatorId: string): Promise<OnlyfansContentRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onlyfans_content_requests")
    .select("*")
    .eq("creator_id", creatorId)
    .order("logged_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as OnlyfansContentRequest[];
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
