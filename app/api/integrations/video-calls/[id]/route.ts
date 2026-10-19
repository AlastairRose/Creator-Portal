import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { notifyCreator } from "@/lib/push";

export const dynamic = "force-dynamic";

type Action = "cancel" | "paid" | "unpaid" | "seen";

/**
 * PATCH { action, actorName }: the chat team moves a request along.
 *   cancel - withdraw a request the creator hasn't answered yet
 *   paid   - fan paid for an accepted call -> creator told it's ready
 *   unpaid - fan didn't pay for an accepted call -> cancelled, creator told
 *   seen   - someone on the team has passed the creator's answer to the fan
 * Each update only applies from the right starting status, so two chatters
 * clicking at once can't both win.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: Action; actorName?: string } | null;
  const actorName = typeof body?.actorName === "string" ? body.actorName.trim().slice(0, 100) || null : null;
  const now = new Date().toISOString();
  const admin = createAdminClient();

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
      fromStatuses = ["pending", "missed", "declined"];
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
    .select("id, creator_id, length_minutes")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: conflictMessage }, { status: 409 });

  // Kept neutral on purpose: these show on the creator's lock screen.
  if (body.action === "paid") {
    await notifyCreator(data.creator_id, {
      title: "Your video call is ready",
      body: `Payment's in for your ${data.length_minutes}-minute video call. Tap for details.`,
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
