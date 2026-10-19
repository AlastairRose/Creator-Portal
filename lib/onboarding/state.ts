import { createAdminClient } from "@/lib/supabase/admin";

export const ONBOARDING_STEPS = [
  { step: 1, key: "agreement", title: "Sign your agreement", required: true },
  { step: 2, key: "details", title: "Your details", required: true },
  { step: 3, key: "model_info", title: "About you", required: false },
  { step: 4, key: "notifications", title: "Turn on notifications", required: false },
  { step: 5, key: "video", title: "Welcome video", required: false },
] as const;

export type OnboardingRow = {
  creator_id: string;
  exempt: boolean;
  agreement_signed_at: string | null;
  details_submitted_at: string | null;
  model_info_submitted_at: string | null;
  notifications_done_at: string | null;
  video_watched_at: string | null;
  completed_at: string | null;
};

export type OnboardingState = {
  row: OnboardingRow | null;
  exempt: boolean;
  done: Record<(typeof ONBOARDING_STEPS)[number]["key"], boolean>;
  requiredDone: boolean; // agreement + details: the portal is locked until both are done
  allDone: boolean;
  nextStep: number | null;
};

export function computeOnboardingState(row: OnboardingRow | null): OnboardingState {
  const exempt = row?.exempt ?? false;
  const done = {
    agreement: !!row?.agreement_signed_at,
    details: !!row?.details_submitted_at,
    model_info: !!row?.model_info_submitted_at,
    notifications: !!row?.notifications_done_at,
    video: !!row?.video_watched_at,
  };
  const requiredDone = exempt || (done.agreement && done.details);
  const allDone = exempt || !!row?.completed_at || Object.values(done).every(Boolean);
  const next = ONBOARDING_STEPS.find((s) => !done[s.key]);
  return { row, exempt, done, requiredDone, allDone, nextStep: allDone ? null : (next?.step ?? null) };
}

// Server-only. A creator with no row yet (i.e. added after onboarding was
// switched on) is a new creator who needs to onboard.
export async function getOnboardingState(creatorId: string): Promise<OnboardingState> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("creator_onboarding").select("*").eq("creator_id", creatorId).maybeSingle();
  if (error) {
    // Fail open: never lock creators out of the portal because of a lookup error.
    console.error("Couldn't load onboarding state:", error);
    return computeOnboardingState({ creator_id: creatorId, exempt: true } as OnboardingRow);
  }
  return computeOnboardingState(data as OnboardingRow | null);
}

export async function markOnboardingStep(
  creatorId: string,
  column: "agreement_signed_at" | "details_submitted_at" | "model_info_submitted_at" | "notifications_done_at" | "video_watched_at"
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: existing } = await admin.from("creator_onboarding").select("*").eq("creator_id", creatorId).maybeSingle();
  const merged = { ...(existing ?? { creator_id: creatorId, exempt: false }), [column]: (existing as Record<string, unknown> | null)?.[column] ?? now, updated_at: now };
  const state = computeOnboardingState(merged as OnboardingRow);
  const { error } = await admin
    .from("creator_onboarding")
    .upsert({ ...merged, completed_at: (existing as OnboardingRow | null)?.completed_at ?? (state.allDone && !merged.exempt ? now : null) });
  if (error) throw new Error(error.message);
}

export type ModelInfoAnswers = {
  fields: Record<string, string>; // "<groupKey>__<fieldKey>" -> answer
  // listKey -> items. `key` is the item's Chatter Portal section key once it
  // exists there, so edits update that item instead of adding a new one.
  lists: Record<string, { title: string; content: string; key?: string }[]>;
};
