import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { notifyCreator } from "@/lib/push";
import { PAYMENT_WINDOW_MINUTES } from "@/lib/video-calls";

export const dynamic = "force-dynamic";

type Action = "cancel" | "paid" | "unpaid" | "seen" | "book";

/**
 * PATCH { action, actorName }: the chat team moves a request along.
 *   cancel - withdraw a request the creator hasn't answered yet
 *   paid   - fan paid for an accepted call -> creator told it's ready
 *   unpaid - fan didn't pay for an accepted call -> cancelled, creator told
 *   seen   - someone on the team has passed the creator's answer to the fan
 *            (or, for a completed call, has updated the fan notes)
 *   book   - { time, creatorTimeZone? }: the fan agreed to one of the times
 *            the creator suggested -> a new scheduled request, already
 *            accepted, waiting for payment (see bookSuggestedTime)
 * Each update only applies from the right starting status, so two chatters
 * clicking at once can't both win.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ({ action?: Action; actorName?: string } & BookBody) | null;
  const actorName = typeof body?.actorName === "string" ? body.actorName.trim().slice(0, 100) || null : null;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  if (body?.action === "book") return bookSuggestedTime(id, body as BookBody, actorName);

  let update: Record<string, unknown>;
  let fromStatuses: string[];
  let conflictMessage: string;
  switch (body?.action) {
    case "cancel":
      update = { status: "cancelled", cancel_reason: "chatter_cancelled", cancelled_by_name: actorName, responded_at: now, team_seen_at: now, team_seen_by_name: actorName };
      fromStatuses = ["pending"];
      conflictMessage = "The creator has already answered this request, so it can't be cancelled.";
      break;
    case "paid":
      update = { status: "ready", paid_at: now, paid_by_name: actorName, team_seen_at: now, team_seen_by_name: actorName };
      fromStatuses = ["accepted"];
      conflictMessage = "This call isn't waiting for payment any more.";
      break;
    case "unpaid":
      update = { status: "cancelled", cancel_reason: "fan_didnt_pay", cancelled_by_name: actorName, team_seen_at: now, team_seen_by_name: actorName };
      fromStatuses = ["accepted"];
      conflictMessage = "This call isn't waiting for payment any more.";
      break;
    case "seen":
      update = { team_seen_at: now, team_seen_by_name: actorName };
      fromStatuses = ["pending", "missed", "declined", "completed"];
      conflictMessage = "Nothing to mark as done on this request.";
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("video_call_requests")
    .update(update)
    .eq("id", id)
    .in("status", fromStatuses)
    .select("id, creator_id, length_minutes, timing, requested_for, creator_time_zone")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: conflictMessage }, { status: 409 });

  // Kept neutral on purpose: these show on the creator's lock screen.
  if (body.action === "paid") {
    const when = data.timing === "scheduled" && data.requested_for ? formatCallTime(data.requested_for, data.creator_time_zone) : null;
    await notifyCreator(data.creator_id, {
      title: when ? "Video call booked" : "Your video call is ready",
      body: when
        ? `Payment's in for your ${data.length_minutes}-minute video call on ${when}. Tap for details.`
        : `Payment's in for your ${data.length_minutes}-minute video call. Tap for details.`,
      url: `/video-calls#${id}`,
      tag: `video-call-${id}`,
    });
  } else if (body.action === "unpaid") {
    await notifyCreator(data.creator_id, {
      title: "Video call cancelled",
      body: "The fan didn't pay - the call is cancelled. No need to wait.",
      url: `/video-calls#${id}`,
      tag: `video-call-${id}`,
    });
  }

  return NextResponse.json({ ok: true });
}

type BookBody = { time?: string; creatorTimeZone?: string };

function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz || (tz !== "UTC" && !tz.includes("/"))) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

// "Sat 29 Nov, 7:00pm", in her own time zone when we know it.
function formatCallTime(iso: string, timeZone: string | null): string {
  const tz = validTimeZone(timeZone);
  const text = new Date(iso)
    .toLocaleString("en-GB", { timeZone: tz ?? "UTC", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(" am", "am")
    .replace(" pm", "pm");
  return tz ? text : `${text} UTC`;
}

async function bookSuggestedTime(id: string, body: BookBody, actorName: string | null) {
  const admin = createAdminClient();
  const { data: original, error } = await admin
    .from("video_call_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const offered = !!(original.status === "missed" || (original.status === "declined" && original.decline_reason === "unavailable"));
  const times = ((original.alternative_times as string[] | null) ?? []).map((t) => new Date(t).getTime());
  const picked = body.time ? new Date(body.time).getTime() : NaN;
  if (!offered || !times.includes(picked)) {
    return NextResponse.json({ error: "That isn't one of the times she suggested." }, { status: 409 });
  }
  if (picked < Date.now()) return NextResponse.json({ error: "That time has already passed." }, { status: 409 });

  const { data: alreadyBooked } = await admin.from("video_call_requests").select("id").eq("booked_from_request_id", id).neq("status", "cancelled").limit(1);
  if (alreadyBooked && alreadyBooked.length > 0) {
    return NextResponse.json({ error: "A call has already been booked from these times." }, { status: 409 });
  }

  const now = new Date();
  const { data: booked, error: insertError } = await admin
    .from("video_call_requests")
    .insert({
      creator_id: original.creator_id,
      chatter_portal_creator_id: original.chatter_portal_creator_id,
      requested_by_name: actorName ?? original.requested_by_name,
      requested_by_ref: original.requested_by_ref,
      fan_name: original.fan_name,
      length_minutes: original.length_minutes,
      price_usd: original.price_usd,
      notes: original.notes,
      timing: "scheduled",
      requested_for: new Date(picked).toISOString(),
      expires_at: now.toISOString(), // she already chose this time, so there's nothing to reply to
      status: "accepted",
      responded_at: now.toISOString(),
      accepted_at: now.toISOString(),
      payment_deadline: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString(),
      booked_from_request_id: id,
      creator_time_zone: validTimeZone(body.creatorTimeZone),
    })
    .select("id")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // The original is handled: the fan's been offered a time and took it.
  await admin
    .from("video_call_requests")
    .update({ team_seen_at: now.toISOString(), team_seen_by_name: actorName })
    .eq("id", id);

  return NextResponse.json({ ok: true, id: booked.id });
}
