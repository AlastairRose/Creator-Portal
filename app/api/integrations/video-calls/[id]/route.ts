import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";

export const dynamic = "force-dynamic";

// PATCH { action: "cancel" }: the chatter withdraws a request that's still
// waiting (e.g. the fan went quiet). Answered requests can't be cancelled.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "cancel") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("video_call_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "This request has already been answered, so it can't be cancelled." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
