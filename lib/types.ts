// `creators` lives in Outlier Engine's schema (shared Supabase project).
// Only the columns Creator Portal actually reads are modeled here.
export type Creator = {
  id: string;
  name: string;
  ig_handle: string | null;
  archived: boolean;
};

export type Role = "owner" | "creative_director" | "editor" | "creator";

export const STAFF_ROLES: Role[] = ["owner", "creative_director", "editor"];

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  creator_id: string | null;
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

export type ContentRequestUrgency = "low" | "normal" | "high" | "urgent";

export const CONTENT_REQUEST_URGENCY_LABELS: Record<ContentRequestUrgency, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export type OnlyfansContentRequest = {
  id: string;
  creator_id: string;
  description: string;
  logged_at: string; // YYYY-MM-DD
  urgency: ContentRequestUrgency;
  status: "open" | "completed";
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export type CustomUrgency = "on_track" | "due_soon" | "overdue";

export type WinningIdea = {
  id: string;
  creator_id: string | null;
  source_reel_id: string | null;
  title: string;
  description: string | null;
  added_by: string | null;
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
