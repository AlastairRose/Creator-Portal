import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCreator } from "@/lib/push";
import { formatInTimeZone } from "@/lib/video-calls";
import { announceUnconfirmedCall } from "@/lib/discord";

// A request that arrives while a creator is asleep gets buried under other
// notifications. If it still has no answer after 12 hours, send one fresh
// reminder so it's back at the top. Older than a week isn't worth chasing.
const REMIND_AFTER_HOURS = 12;
const STOP_AFTER_DAYS = 7;

export async function sendVideoCallReminders(admin: SupabaseClient): Promise<{ reminded: number }> {
  const now = Date.now();
  const { data, error } = await admin
    .from("video_call_requests")
    .select("id, creator_id")
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .lte("created_at", new Date(now - REMIND_AFTER_HOURS * 3600e3).toISOString())
    .gte("created_at", new Date(now - STOP_AFTER_DAYS * 24 * 3600e3).toISOString());
  if (error) throw new Error(error.message);

  let reminded = 0;
  for (const request of data ?? []) {
    // Claim it first so two overlapping runs can't both send a reminder.
    const { data: claimed, error: claimError } = await admin
      .from("video_call_requests")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", request.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (claimError || !claimed?.length) continue;

    // Kept neutral on purpose: this shows on the creator's lock screen.
    await notifyCreator(request.creator_id as string, {
      title: "Video call request waiting",
      body: "You haven't answered a video call request yet. Tap to reply, or let us know when you're free.",
      url: `/video-calls#${request.id}`,
      tag: `video-call-${request.id}`,
    });
    reminded++;
  }
  return { reminded };
}

// A paid call she hasn't marked complete. Calls with a set time wait until
// 24 hours after that time; others wait 72 hours after payment. Then one
// reminder every 24 hours until she marks it complete (stopping after two
// weeks, so a call nobody will ever complete doesn't nag forever).
const COMPLETE_FIRST_AFTER_PAYMENT_HOURS = 72;
const COMPLETE_FIRST_AFTER_CALL_TIME_HOURS = 24;
const COMPLETE_REPEAT_HOURS = 24;
const COMPLETE_MAX_REMINDERS = 14;
const SCHEDULE_SLACK_MS = 10 * 60_000; // the cron runs every 15 minutes

export function firstCompleteReminderAt(r: { timing: string; requested_for: string | null; paid_at: string | null }): number | null {
  if (r.timing === "scheduled" && r.requested_for) {
    return new Date(r.requested_for).getTime() + COMPLETE_FIRST_AFTER_CALL_TIME_HOURS * 3600e3;
  }
  if (!r.paid_at) return null;
  return new Date(r.paid_at).getTime() + COMPLETE_FIRST_AFTER_PAYMENT_HOURS * 3600e3;
}

export async function sendCompleteCallReminders(admin: SupabaseClient): Promise<{ reminded: number }> {
  const now = Date.now();
  const { data, error } = await admin
    .from("video_call_requests")
    .select("id, creator_id, timing, requested_for, paid_at, complete_reminder_sent_at, complete_reminder_count")
    .eq("status", "ready")
    .lt("complete_reminder_count", COMPLETE_MAX_REMINDERS);
  if (error) throw new Error(error.message);

  let reminded = 0;
  for (const r of data ?? []) {
    const first = firstCompleteReminderAt(r);
    if (first === null || now < first - SCHEDULE_SLACK_MS) continue;
    const last = r.complete_reminder_sent_at ? new Date(r.complete_reminder_sent_at).getTime() : null;
    if (last !== null && now - last < COMPLETE_REPEAT_HOURS * 3600e3 - SCHEDULE_SLACK_MS) continue;

    // Claim it first so two overlapping runs can't both send.
    let claim = admin
      .from("video_call_requests")
      .update({ complete_reminder_sent_at: new Date(now).toISOString(), complete_reminder_count: (r.complete_reminder_count ?? 0) + 1 })
      .eq("id", r.id)
      .eq("status", "ready");
    claim = r.complete_reminder_sent_at ? claim.eq("complete_reminder_sent_at", r.complete_reminder_sent_at) : claim.is("complete_reminder_sent_at", null);
    const { data: claimed, error: claimError } = await claim.select("id");
    if (claimError || !claimed?.length) continue;

    // Kept neutral on purpose: this shows on the creator's lock screen.
    await notifyCreator(r.creator_id as string, {
      title: "Mark your video call complete",
      body: "Did your video call happen? Tap to mark it complete and add a few notes for the chat team.",
      url: `/video-calls#${r.id}`,
      tag: `video-call-complete-${r.id}`,
    });
    reminded++;
  }
  return { reminded };
}

// About an hour before a booked (paid, scheduled) call: a reminder with the
// time, asking her to confirm she'll be there or to ask for a change. The
// schedule runs every 15 minutes, so this lands 45-60 minutes before.
const ATTENDANCE_REMINDER_MINUTES = 60;

export async function sendAttendanceReminders(admin: SupabaseClient): Promise<{ reminded: number }> {
  const now = Date.now();
  const { data, error } = await admin
    .from("video_call_requests")
    .select("id, creator_id, length_minutes, requested_for, creator_time_zone, creator_location")
    .eq("status", "ready")
    .eq("timing", "scheduled")
    .is("attendance_reminder_sent_at", null)
    .gt("requested_for", new Date(now).toISOString())
    .lte("requested_for", new Date(now + ATTENDANCE_REMINDER_MINUTES * 60_000).toISOString());
  if (error) throw new Error(error.message);

  let reminded = 0;
  for (const r of data ?? []) {
    const { data: claimed } = await admin
      .from("video_call_requests")
      .update({ attendance_reminder_sent_at: new Date(now).toISOString() })
      .eq("id", r.id)
      .is("attendance_reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const at = formatInTimeZone(r.requested_for as string, r.creator_time_zone as string | null);
    const timeText = at ? `at ${at.split(", ").pop()}${r.creator_location ? ` (${r.creator_location} time)` : ""}` : "in about an hour";
    // Kept neutral on purpose: this shows on the creator's lock screen.
    await notifyCreator(r.creator_id as string, {
      title: "Video call in about an hour",
      body: `Your ${r.length_minutes}-minute video call is ${timeText}. Tap to confirm you'll be there, or ask to change the time.`,
      url: `/video-calls#${r.id}`,
      tag: `video-call-${r.id}`,
    });
    reminded++;
  }
  return { reminded };
}

// About 15 minutes before a booked call she still hasn't confirmed: warn the
// chat team in Discord so they can chase her before the fan is left waiting,
// and send her one more notification. The schedule runs every 15 minutes, so
// anything starting within the next 20 is caught (it lands 5-20 minutes before).
const NO_CONFIRM_ALERT_MINUTES = 20;

export async function sendUnconfirmedCallAlerts(admin: SupabaseClient): Promise<{ alerted: number }> {
  const now = Date.now();
  const { data, error } = await admin
    .from("video_call_requests")
    .select("id, creator_id, length_minutes")
    .eq("status", "ready")
    .eq("timing", "scheduled")
    .is("attendance_confirmed_at", null)
    .is("no_confirm_alert_sent_at", null)
    .gt("requested_for", new Date(now).toISOString())
    .lte("requested_for", new Date(now + NO_CONFIRM_ALERT_MINUTES * 60_000).toISOString());
  if (error) throw new Error(error.message);

  let alerted = 0;
  for (const r of data ?? []) {
    const { data: claimed } = await admin
      .from("video_call_requests")
      .update({ no_confirm_alert_sent_at: new Date(now).toISOString() })
      .eq("id", r.id)
      .is("no_confirm_alert_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    await announceUnconfirmedCall(r.id as string);
    // Kept neutral on purpose: this shows on the creator's lock screen.
    await notifyCreator(r.creator_id as string, {
      title: "Your video call starts soon",
      body: `Your ${r.length_minutes}-minute video call starts in about 15 minutes. Tap to confirm you'll be there.`,
      url: `/video-calls#${r.id}`,
      tag: `video-call-${r.id}`,
    });
    alerted++;
  }
  return { alerted };
}
