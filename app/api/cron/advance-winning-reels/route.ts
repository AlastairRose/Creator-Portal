import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceScheduledWinningReels } from "@/lib/winning-reels-advance";

export const maxDuration = 60;

// Daily, triggered by Vercel Cron (see vercel.json). No signed-in session
// exists in a cron invocation, so this checks Vercel's own CRON_SECRET
// header instead of requireStaff(), and uses the service-role client since
// there's no session to carry RLS.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const advanced = await advanceScheduledWinningReels(admin);
    return NextResponse.json({ advanced });
  } catch (err) {
    console.error("Advancing scheduled winning reels failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Advance failed" }, { status: 500 });
  }
}
