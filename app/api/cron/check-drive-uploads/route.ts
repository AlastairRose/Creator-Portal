import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDriveUploads } from "@/lib/drive-upload-notifications";

export const maxDuration = 60;

// Scheduled check for new files in creators' Drive upload folders, which
// emails all staff when anything new has landed. Called by a scheduler with
// the CRON_SECRET bearer token — no signed-in session exists here, so it
// uses the service-role client.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkDriveUploads(createAdminClient());
    return NextResponse.json(result);
  } catch (err) {
    console.error("Checking Drive uploads failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Check failed" }, { status: 500 });
  }
}
