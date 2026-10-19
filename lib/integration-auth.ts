import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Server-to-server calls from the Chatter Portal authenticate with a shared
// secret (VIDEO_CALL_API_SECRET, set to the same value in both Vercel
// projects) rather than a login. proxy.ts lets /api/integrations through for
// this reason, so every route under it must call this first.
export function rejectUnlessIntegration(request: Request): NextResponse | null {
  const secret = process.env.VIDEO_CALL_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "VIDEO_CALL_API_SECRET isn't set on the Creator Portal" }, { status: 503 });
  }
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
