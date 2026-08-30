import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/roles";
import { buildGoogleAuthUrl } from "@/lib/google-drive";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  await requireOwner();

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(redirectUri, state);
  } catch (err) {
    const url = new URL("/admin/google-drive", request.url);
    url.searchParams.set("error", err instanceof Error ? err.message : "Couldn't start the connection.");
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth/google",
  });
  return response;
}
