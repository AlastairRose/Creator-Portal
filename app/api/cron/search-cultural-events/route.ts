import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCulturalEventsSearch } from "@/lib/cultural-events-search";

// Raise the allowed execution time as high as the hosting plan permits —
// Hobby still hard-caps at 60s regardless, but this matters if the project
// ever moves to Pro (whose default without this export is much lower).
export const maxDuration = 60;

// Weekly, triggered by Vercel Cron (see vercel.json). No signed-in session
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
    const inserted = await runCulturalEventsSearch(admin);
    return NextResponse.json({ inserted });
  } catch (err) {
    console.error("Cultural events search failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 500 });
  }
}
