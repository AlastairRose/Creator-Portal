// `creators` lives in Outlier Engine's schema (shared Supabase project).
// Only the columns Creator Portal actually reads are modeled here.
export type Creator = {
  id: string;
  name: string;
  ig_handle: string | null;
  archived: boolean;
};

export type DashboardWeekStats = {
  weekStartDate: string;
  planned: number;
  uploaded: number;
  posted: number;
  percentComplete: number; // 0-100, uploaded-or-further / planned
};

export type DashboardCreatorRow = {
  creator: Creator;
  weeks: DashboardWeekStats[]; // oldest to newest, ends with the current week
};

export type Role = "owner" | "creative_director" | "editor" | "creator";

export const STAFF_ROLES: Role[] = ["owner", "creative_director", "editor"];

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  creator_id: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type ContentWeekStatus = "draft" | "published";

export type ContentWeek = {
  id: string;
  creator_id: string;
  week_start_date: string; // YYYY-MM-DD, always a Monday
  status: ContentWeekStatus;
  drive_link: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReelStatus =
  | "planned"
  | "uploaded"
  | "edited"
  | "posted"
  | "unable_to_record"
  | "not_liked";

export const REEL_STATUS_LABELS: Record<ReelStatus, string> = {
  planned: "Planned",
  uploaded: "Uploaded",
  edited: "Edited",
  posted: "Posted",
  unable_to_record: "Unable to record",
  not_liked: "Didn't like the idea",
};

// Mirrors the founder's existing per-reel planning template (Notion).
export type Reel = {
  id: string;
  content_week_id: string;
  creator_id: string;
  name: string; // short label shown in the collapsed Content Planner summary
  idea: string; // concept, often with a reference link to recreate
  inspo_link: string | null; // link to a similar reel, for the creator's reference
  required_shots: string | null;
  hook: string | null;
  outfit: string | null;
  location: string | null;
  filming_style: string | null;
  editing_notes: string | null; // guidance for the editor when cutting the reel
  posting_notes: string | null; // guidance for whoever posts the finished reel
  vertical: string | null; // content category, e.g. "Skit (Meme style)"
  status: ReelStatus;
  status_reason: string | null;
  flagged_for_reuse: boolean;
  reused_in_week_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// highly_requested -> 7-day due target. complete_when_possible -> 14-day.
// not_required -> no due tag at all.
export type ContentRequestUrgency = "highly_requested" | "complete_when_possible" | "not_required";

export const CONTENT_REQUEST_URGENCY_LABELS: Record<ContentRequestUrgency, string> = {
  highly_requested: "Highly Requested",
  complete_when_possible: "Complete when possible",
  not_required: "Not required for now",
};

export type OnlyfansDueTag = "due_in_2_weeks" | "due_this_week" | "due_in_3_days" | "due_today" | "overdue";

export const ONLYFANS_DUE_TAG_LABELS: Record<OnlyfansDueTag, string> = {
  due_in_2_weeks: "Due in the next 2 weeks",
  due_this_week: "Due this week",
  due_in_3_days: "Due in 3 days",
  due_today: "Due today",
  overdue: "Overdue",
};

export type OnlyfansContentType = "sexting" | "ppv" | "wall_posts" | "voice_notes" | "day_to_day" | "other";

export const ONLYFANS_CONTENT_TYPE_LABELS: Record<OnlyfansContentType, string> = {
  sexting: "Sexting",
  ppv: "PPV",
  wall_posts: "Wall Posts",
  voice_notes: "Voice Notes",
  day_to_day: "Day-to-Day",
  other: "Other",
};

// Mirrors the founder's "Content Requests" Airtable base. `description`/
// `length` only apply to non-sexting types — a sexting request breaks down
// into a checklist of OnlyfansSextingItem rows instead (see below).
export type OnlyfansContentRequest = {
  id: string;
  creator_id: string;
  content_type: OnlyfansContentType;
  description: string | null; // "Content Required"
  length: string | null;
  sexting_drive_link: string | null;
  sexting_storyline: string | null;
  urgency: ContentRequestUrgency;
  urgency_set_at: string; // anchor the 7/14-day due target counts from
  status: "open" | "completed";
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// One required item within a Sexting request's checklist. `creator_required`
// is the planner's tick box: ticked items are shown on the creator's content
// planner, unticked ones are staff-only steps that never reach the creator
// (enforced by RLS, not just hidden in the UI).
export type OnlyfansSextingItem = {
  id: string;
  request_id: string;
  content_label: string;
  description: string | null;
  length: string | null;
  creator_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// A request row plus its checklist, when the request is a sexting type.
export type OnlyfansContentRequestWithItems = OnlyfansContentRequest & {
  onlyfans_sexting_items: OnlyfansSextingItem[];
};

// OFCD: a staff-only bank of OnlyFans content ideas, not yet tied to a
// creator. Same shape as OnlyfansContentRequest minus creator/urgency/status
// (an idea isn't anyone's yet), plus a title used purely to identify it in
// the library list.
export type OfcdIdea = {
  id: string;
  title: string;
  content_type: OnlyfansContentType;
  description: string | null;
  length: string | null;
  sexting_drive_link: string | null;
  sexting_storyline: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OfcdIdeaSextingItem = {
  id: string;
  ofcd_idea_id: string;
  content_label: string;
  description: string | null;
  length: string | null;
  creator_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OfcdIdeaWithItems = OfcdIdea & {
  ofcd_idea_sexting_items: OfcdIdeaSextingItem[];
};

// outstanding: creator's active to-do. to_do_later: not yet fully paid,
// staff-only. uploaded: creator filmed/uploaded, now a staff-only "ready to
// send" queue. sent: final state.
export type OutstandingCustomStatus = "outstanding" | "to_do_later" | "uploaded" | "sent";

export const OUTSTANDING_CUSTOM_STATUS_LABELS: Record<OutstandingCustomStatus, string> = {
  outstanding: "Outstanding",
  to_do_later: "To do later",
  uploaded: "Ready to send",
  sent: "Sent",
};

// Mirrors the founder's existing Outstanding Customs Airtable base.
export type OutstandingCustom = {
  id: string;
  creator_id: string;
  status: OutstandingCustomStatus;
  sub_username: string | null;
  sub_name: string | null;
  length_of_video_or_call: string | null;
  custom_or_call: string | null;
  outfit: string | null;
  location: string | null;
  description: string;
  chat_screenshot_path: string | null; // storage object path, not a public URL
  chat_link: string | null;
  custom_price_agreed: string | null;
  snapchat_handle: string | null;
  requested_at: string;
  due_by: string | null; // YYYY-MM-DD
  uploaded_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomUrgency = "on_track" | "due" | "overdue";

// "Winning 30": a per-creator bank of previously winning reels worth
// reposting, sorted soonest-scheduled_for-first wherever it's read so
// what's coming up next sits at the top.
export type WinningReel = {
  id: string;
  creator_id: string;
  title: string;
  original_link: string | null;
  footage_link: string | null;
  scheduled_for: string; // YYYY-MM-DD
  last_posted_date: string | null; // YYYY-MM-DD, null until it's actually been (re)posted
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

// Mirrors Reel's fields exactly (minus status/scheduling), so pushing an
// idea to a creator's plan carries everything across, not just a subset.
export type RdIdea = {
  id: string;
  name: string;
  idea: string | null;
  inspo_link: string | null;
  required_shots: string | null;
  hook: string | null;
  outfit: string | null;
  location: string | null;
  filming_style: string | null;
  editing_notes: string | null;
  posting_notes: string | null;
  vertical: string | null;
  suitable_creator_ids: string[];
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

// A second idea library alongside R&D: original ideas (rather than "found
// online"), and where creators can submit their own via
// submitted_by_creator_id. Same shape as RdIdea otherwise.
export type Idea = {
  id: string;
  name: string;
  idea: string | null;
  inspo_link: string | null;
  required_shots: string | null;
  hook: string | null;
  outfit: string | null;
  location: string | null;
  filming_style: string | null;
  editing_notes: string | null;
  posting_notes: string | null;
  vertical: string | null;
  suitable_creator_ids: string[];
  submitted_by_creator_id: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

// "ANT-ena" — a bank of upcoming worldwide cultural/entertainment/sporting
// events for the creative director to plan content ideas around. Manual
// entries land as 'confirmed' immediately; ones found by the weekly AI
// search land as 'suggested' until a staff member approves or dismisses
// them.
export const CULTURAL_EVENT_REGIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Europe",
  "Australia",
] as const;

export type CulturalEventRegion = (typeof CULTURAL_EVENT_REGIONS)[number];

export type CulturalEventStatus = "suggested" | "confirmed" | "dismissed";
export type CulturalEventSource = "manual" | "ai_suggested";

export type CulturalEvent = {
  id: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_end_date: string | null;
  category: string | null;
  regions: string[];
  description: string | null;
  status: CulturalEventStatus;
  source: CulturalEventSource;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPlatform = "instagram" | "facebook" | "tiktok" | "twitter" | "youtube";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "youtube",
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  twitter: "Twitter (X)",
  youtube: "YouTube",
};

export type SocialAccountManagedBy = "autoposter" | "account_manager";

export type CreatorSocialAccount = {
  id: string;
  creator_id: string;
  platform: SocialPlatform;
  is_active: boolean;
  managed_by: SocialAccountManagedBy | null;
  profile_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorPlan = {
  creator_id: string;
  agreed_reels_per_week: number | null;
  niche_branding: string | null;
  verticals_agreed: string[];
  created_at: string;
  updated_at: string;
};

export type CreatorDriveLinks = {
  creator_id: string;
  onlyfans_drive_link: string | null;
  customs_drive_link: string | null;
  weekly_root_drive_link: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportPeriodType = "weekly" | "monthly";

export type Report = {
  id: string;
  creator_id: string;
  period_type: ReportPeriodType;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  revenue: number | null;
  went_well: string | null;
  can_improve: string | null;
  next_plan: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
};

// Staff-only library of SOP documents/guides — an uploaded document and/or
// a video link, per entry.
export type Sop = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  document_path: string | null; // storage object path in the 'sop-documents' bucket
  document_filename: string | null;
  video_link: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};
