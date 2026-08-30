import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/roles";
import { completeGoogleDriveConnection } from "@/lib/google-drive";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const profile = await requireOwner();

  const redirectTo = (params: Record<string, string>) => {
    const url = new URL("/admin/google-drive", request.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (searchParams.get("error")) {
    return redirectTo({ error: "Google sign-in was cancelled." });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo({ error: "That connection link expired — try connecting again." });
  }

  try {
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
    await completeGoogleDriveConnection(code, redirectUri, profile.id);
  } catch (err) {
    return redirectTo({ error: err instanceof Error ? err.message : "Couldn't connect Google Drive." });
  }

  return redirectTo({ connected: "1" });
}
