import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { CHAT_COLUMNS, type CreatorChat } from "@/lib/creator-chats";

export const dynamic = "force-dynamic";

// GET: creator chats for the Chatter Portal's Creator Chats page. Open ones
// first, then anything closed in the last 7 days. "unread" means the creator
// wrote last and nobody on the team has opened it since.
export async function GET(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 3600e3).toISOString();
  const { data, error } = await admin
    .from("creator_chats")
    .select(`${CHAT_COLUMNS}, creator:creators(name)`)
    .or(`status.eq.open,last_message_at.gte.${since}`)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((c) => c.id as string);
  const previews = new Map<string, string>();
  if (ids.length) {
    const { data: messages } = await admin
      .from("creator_chat_messages")
      .select("chat_id, body, sender, created_at")
      .in("chat_id", ids)
      .neq("sender", "system")
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const m of messages ?? []) if (!previews.has(m.chat_id as string)) previews.set(m.chat_id as string, m.body as string);
  }

  const chats = (data ?? []).map((row) => {
    const { creator, ...rest } = row as unknown as CreatorChat & { creator: { name: string } | { name: string }[] | null };
    const c = Array.isArray(creator) ? creator[0] : creator;
    return {
      ...rest,
      creator_name: c?.name ?? "Unknown creator",
      preview: (previews.get(rest.id) ?? "").slice(0, 200),
      unread: rest.last_sender === "creator" && (!rest.team_last_read_at || rest.team_last_read_at < rest.last_message_at),
    };
  });
  return NextResponse.json({ chats });
}
