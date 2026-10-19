import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";

export const dynamic = "force-dynamic";

// GET: Creator Portal creators plus the current Chatter Portal -> Creator
// Portal links, so a Chatter Portal manager can match the two lists up.
export async function GET(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const admin = createAdminClient();
  const [{ data: creators, error: cErr }, { data: links, error: lErr }] = await Promise.all([
    admin.from("creators").select("id, name").eq("archived", false).order("name", { ascending: true }),
    admin.from("chatter_portal_creator_links").select("chatter_portal_creator_id, creator_id"),
  ]);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  return NextResponse.json({ creators: creators ?? [], links: links ?? [] });
}

// PUT { chatterPortalCreatorId, creatorId | null }: link (or unlink) one creator.
export async function PUT(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const body = (await request.json().catch(() => null)) as { chatterPortalCreatorId?: unknown; creatorId?: unknown } | null;
  const chatterPortalCreatorId = typeof body?.chatterPortalCreatorId === "string" ? body.chatterPortalCreatorId.trim() : "";
  const creatorId = typeof body?.creatorId === "string" && body.creatorId ? body.creatorId : null;
  if (!chatterPortalCreatorId) return NextResponse.json({ error: "chatterPortalCreatorId is required" }, { status: 400 });

  const admin = createAdminClient();
  if (!creatorId) {
    const { error } = await admin.from("chatter_portal_creator_links").delete().eq("chatter_portal_creator_id", chatterPortalCreatorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("chatter_portal_creator_links")
    .upsert({ chatter_portal_creator_id: chatterPortalCreatorId, creator_id: creatorId }, { onConflict: "chatter_portal_creator_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
