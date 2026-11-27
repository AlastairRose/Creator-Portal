import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDriveUploads } from "@/lib/drive-upload-notifications";
import { sendCompleteCallReminders, sendVideoCallReminders } from "@/lib/video-call-reminders";

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

  const admin = createAdminClient();

  // Runs on the same schedule: reminders for video call requests that have
  // gone unanswered for 12 hours. Kept separate so a Drive problem can't
  // stop the reminders, or the other way round.
  let videoCallReminders: { reminded: number } | { error: string };
  try {
    videoCallReminders = await sendVideoCallReminders(admin);
  } catch (err) {
    console.error("Sending video call reminders failed:", err);
    videoCallReminders = { error: err instanceof Error ? err.message : "Reminders failed" };
  }

  // And reminders to mark paid calls complete (72h after payment, or 24h
  // after a set call time, then daily).
  let completeCallReminders: { reminded: number } | { error: string };
  try {
    completeCallReminders = await sendCompleteCallReminders(admin);
  } catch (err) {
    console.error("Sending complete-call reminders failed:", err);
    completeCallReminders = { error: err instanceof Error ? err.message : "Reminders failed" };
  }

  try {
    const result = await checkDriveUploads(admin);
    return NextResponse.json({ ...result, videoCallReminders, completeCallReminders });
  } catch (err) {
    console.error("Checking Drive uploads failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed", videoCallReminders, completeCallReminders },
      { status: 500 }
    );
  }
}
