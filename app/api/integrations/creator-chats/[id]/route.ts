import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { addMessage, CHAT_COLUMNS, cleanMessage, MESSAGE_COLUMNS, notifyCreatorOfReply } from "@/lib/creator-chats";

export const dynamic = "force-dynamic";

function cleanName(value: unknown): string | null {
  return typeof value === "string" ? value.trim().slice(0, 100) || null : null;
}

// GET: one chat and its messages. Opening it marks it read for the team.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: chat, error } = await admin.from("creator_chats").select(`${CHAT_COLUMNS}, creator:creators(name)`).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  const { data: messages } = await admin.from("creator_chat_messages").select(MESSAGE_COLUMNS).eq("chat_id", id).order("created_at").limit(500);

  if (request.nextUrl.searchParams.get("markRead") === "1") {
    await admin.from("creator_chats").update({ team_last_read_at: new Date().toISOString() }).eq("id", id);
  }

  const { creator, ...rest } = chat as unknown as Record<string, unknown> & { creator: { name: string } | { name: string }[] | null };
  const c = Array.isArray(creator) ? creator[0] : creator;
  return NextResponse.json({ chat: { ...rest, creator_name: c?.name ?? "Unknown creator" }, messages: messages ?? [] });
}

// POST { body, actorName }: a chatter replies. The creator gets a phone notification.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;
  const { id } = await params;
  const input = (await request.json().catch(() => null)) as { body?: string; actorName?: string } | null;
  const body = cleanMessage(input?.body);
  if (!body) return NextResponse.json({ error: "Type a message first" }, { status: 400 });

  const admin = createAdminClient();
  const { data: chat } = await admin.from("creator_chats").select("id, creator_id").eq("id", id).maybeSingle();
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const sent = await addMessage(id, "team", cleanName(input?.actorName) ?? "Chat team", body);
  if (sent.error) return NextResponse.json({ error: sent.error }, { status: 500 });
  await notifyCreatorOfReply(id, chat.creator_id as string);
  return NextResponse.json({ ok: true });
}

// PATCH { action: "close" | "reopen", actorName }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;
  const { id } = await params;
  const input = (await request.json().catch(() => null)) as { action?: string; actorName?: string } | null;
  const actorName = cleanName(input?.actorName) ?? "Chat team";
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (input?.action === "close") {
    const { data, error } = await admin
      .from("creator_chats")
      .update({ status: "closed", closed_at: now, closed_by_name: actorName, team_last_read_at: now })
      .eq("id", id)
      .eq("status", "open")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "This chat is already closed." }, { status: 409 });
    await addMessage(id, "system", null, `Chat closed by ${actorName}.`);
    return NextResponse.json({ ok: true });
  }
  if (input?.action === "reopen") {
    const { error } = await admin.from("creator_chats").update({ status: "open", closed_at: null, closed_by_name: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
