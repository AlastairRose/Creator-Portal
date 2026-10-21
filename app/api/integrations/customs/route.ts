import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessIntegration } from "@/lib/integration-auth";
import { createCustomRequest, CUSTOM_TEXT_FIELDS, type NewCustomFields } from "@/lib/custom-intake";

export const dynamic = "force-dynamic";

const MAX_SCREENSHOTS = 6;

// POST (multipart form): the Chatter Portal's "Customs & Calls" page logs a
// custom for a creator. Same fields and behaviour as the public intake form;
// the chatter's name comes from their Chatter Portal login.
export async function POST(request: NextRequest) {
  const rejected = rejectUnlessIntegration(request);
  if (rejected) return rejected;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const text = (name: string, max = 2000) => String(form.get(name) ?? "").trim().slice(0, max);
  const chatterPortalCreatorId = text("chatterPortalCreatorId", 100);
  if (!chatterPortalCreatorId) return NextResponse.json({ error: "Pick a creator." }, { status: 400 });

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("chatter_portal_creator_links")
    .select("creator_id")
    .eq("chatter_portal_creator_id", chatterPortalCreatorId)
    .maybeSingle();
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!link) {
    return NextResponse.json(
      { error: "This creator isn't linked to the Creator Portal yet - ask a manager to link them on the Customs & Calls page." },
      { status: 409 }
    );
  }

  const screenshots = form.getAll("chat_screenshot").filter((f): f is File => f instanceof File && f.size > 0);
  if (screenshots.length > MAX_SCREENSHOTS) {
    return NextResponse.json({ error: `Attach up to ${MAX_SCREENSHOTS} screenshots.` }, { status: 400 });
  }

  const optional = Object.fromEntries(CUSTOM_TEXT_FIELDS.map((k) => [k, text(k, 500) || null])) as Omit<NewCustomFields, "description">;
  const result = await createCustomRequest({
    creatorId: link.creator_id,
    chatterName: text("chatterName", 100),
    fields: { description: text("description", 5000), ...optional },
    screenshots,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
