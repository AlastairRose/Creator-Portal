import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { notifyCreator } from "@/lib/push";
import { ASAP_EXPIRY_MINUTES, VIDEO_CALL_COLUMNS, type VideoCallRequest } from "@/lib/video-calls";

export const dynamic = "force-dynamic";

const LIST_DAYS_DEFAULT = 14;

// GET: requests for the Chatter Portal's list. ?requestedBy=<chatter id>
// limits it to one chatter's requests (what a chatter sees); without it,
// everything (what managers see). Newest first.
export async function GET(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const params = request.nextUrl.searchParams;
  const requestedBy = params.get("requestedBy");
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || LIST_DAYS_DEFAULT));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  let query = admin
    .from("video_call_requests")
    .select(`${VIDEO_CALL_COLUMNS}, creator:creators(name)`)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (requestedBy) query = query.eq("requested_by_ref", requestedBy);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requests = (data ?? []).map((row) => {
    // Many-to-one embeds come back as an object at runtime, though the
    // generated types say array - accept either.
    const { creator, ...rest } = row as unknown as VideoCallRequest & { creator: { name: string } | { name: string }[] | null };
    const c = Array.isArray(creator) ? creator[0] : creator;
    return { ...rest, creator_name: c?.name ?? "Unknown creator" };
  });
  return NextResponse.json({ requests, serverTime: new Date().toISOString() });
}

type CreateBody = {
  chatterPortalCreatorId?: unknown;
  requestedByName?: unknown;
  requestedByRef?: unknown;
  fanName?: unknown;
  lengthMinutes?: unknown;
  priceUsd?: unknown;
  notes?: unknown;
  timing?: unknown;
  requestedFor?: unknown;
};

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// POST: a chatter sends a new request. Notifies the creator's phone.
export async function POST(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const body = ((await request.json().catch(() => null)) ?? {}) as CreateBody;
  const chatterPortalCreatorId = text(body.chatterPortalCreatorId, 100);
  const requestedByName = text(body.requestedByName, 100);
  const fanName = text(body.fanName, 120);
  const notes = text(body.notes, 1000) || null;
  const lengthMinutes = Math.floor(Number(body.lengthMinutes));
  const priceUsd = body.priceUsd === null || body.priceUsd === "" || body.priceUsd === undefined ? null : Number(body.priceUsd);
  const timing = body.timing === "scheduled" ? "scheduled" : body.timing === "asap" ? "asap" : null;

  if (!chatterPortalCreatorId) return NextResponse.json({ error: "Pick a creator." }, { status: 400 });
  if (!requestedByName) return NextResponse.json({ error: "Missing the chatter's name." }, { status: 400 });
  if (!fanName) return NextResponse.json({ error: "Add the fan's name or username." }, { status: 400 });
  if (!Number.isFinite(lengthMinutes) || lengthMinutes < 1 || lengthMinutes > 240) {
    return NextResponse.json({ error: "Call length must be between 1 and 240 minutes." }, { status: 400 });
  }
  if (priceUsd !== null && (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 100000)) {
    return NextResponse.json({ error: "Price must be a number." }, { status: 400 });
  }
  if (!timing) return NextResponse.json({ error: "Choose ASAP or a time." }, { status: 400 });

  let requestedFor: string | null = null;
  let expiresAt: Date;
  if (timing === "scheduled") {
    const when = new Date(text(body.requestedFor, 40));
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "Pick a date and time for the call." }, { status: 400 });
    if (when.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "That time has already passed." }, { status: 400 });
    requestedFor = when.toISOString();
    expiresAt = when; // no answer by the time of the call = it's not happening
  } else {
    expiresAt = new Date(Date.now() + ASAP_EXPIRY_MINUTES * 60_000);
  }

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("chatter_portal_creator_links")
    .select("creator_id")
    .eq("chatter_portal_creator_id", chatterPortalCreatorId)
    .maybeSingle();
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!link) {
    return NextResponse.json(
      { error: "This creator isn't linked to the Creator Portal yet - ask a manager to link them on the Video Calls page." },
      { status: 409 }
    );
  }

  const { data: created, error } = await admin
    .from("video_call_requests")
    .insert({
      creator_id: link.creator_id,
      chatter_portal_creator_id: chatterPortalCreatorId,
      requested_by_name: requestedByName,
      requested_by_ref: text(body.requestedByRef, 100) || null,
      fan_name: fanName,
      length_minutes: lengthMinutes,
      price_usd: priceUsd,
      notes,
      timing,
      requested_for: requestedFor,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kept neutral on purpose: this shows on the creator's lock screen.
  await notifyCreator(link.creator_id, {
    title: timing === "asap" ? "Video call request - now" : "Video call request",
    body:
      timing === "asap"
        ? `A ${lengthMinutes}-minute video call is waiting on you. Tap to accept or decline.`
        : `A ${lengthMinutes}-minute video call has been requested. Tap to accept or decline.`,
    url: `/video-calls#${created.id}`,
    tag: `video-call-${created.id}`,
  });

  return NextResponse.json({ id: created.id, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
