import { createClient } from "@/lib/supabase/server";

// A "drive.file" scope grant only ever lets the connected Google account's
// app-created files be touched by the API — never the rest of that person's
// Drive. That's why the connect flow itself creates the root "Creator
// Portal" folder (see completeGoogleDriveConnection) rather than asking the
// founder to share an existing one: everything nested under it stays in
// scope for the lifetime of the connection.
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ROOT_FOLDER_NAME = "Creator Portal";

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Drive isn't configured yet (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

async function getConnectedEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Couldn't create Drive folder "${name}": ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(accessToken: string, name: string, parentId: string): Promise<string | null> {
  const q = `name = '${escapeDriveQueryValue(name)}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id)", pageSize: "1" });
  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't search Drive folders: ${await res.text()}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;
  return createDriveFolder(accessToken, name, parentId);
}

// Finishes the OAuth handshake: exchanges the code, creates the root folder
// this connection will own, and stores everything as the single connection
// row (replacing any previous connection).
export async function completeGoogleDriveConnection(
  code: string,
  redirectUri: string,
  connectedByProfileId: string
) {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token — if you've connected before, remove Creator Portal's access at myaccount.google.com/permissions and try again."
    );
  }

  const [email, rootFolderId] = await Promise.all([
    getConnectedEmail(tokens.access_token),
    createDriveFolder(tokens.access_token, ROOT_FOLDER_NAME),
  ]);

  const supabase = await createClient();
  await supabase.from("google_drive_connection").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("google_drive_connection").insert({
    connected_by: connectedByProfileId,
    google_account_email: email,
    root_folder_id: rootFolderId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
}

type Connection = {
  id: string;
  google_account_email: string | null;
  root_folder_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

export async function getGoogleDriveConnection(): Promise<Connection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("google_drive_connection").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data as Connection | null;
}

export async function disconnectGoogleDrive() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("google_drive_connection")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}

// Refreshes the access token if it's expired/near-expiry and persists the
// new one, so the next call doesn't have to refresh again.
async function getValidAccessToken(connection: Connection): Promise<string> {
  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  if (connection.access_token && expiresAt - Date.now() > 60_000) {
    return connection.access_token;
  }

  const tokens = await refreshAccessToken(connection.refresh_token);
  const supabase = await createClient();
  await supabase
    .from("google_drive_connection")
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", connection.id);
  return tokens.access_token;
}

// Called when a week is published. No-ops if Drive isn't connected, or if
// the week already has a drive_link (never overwrites a manually pasted
// link). Folder layout: "Creator Portal" / {creator name} / "Week of {date}".
export async function ensureWeekDriveFolder(creatorName: string, weekStartDate: string): Promise<string | null> {
  const connection = await getGoogleDriveConnection();
  if (!connection) return null;

  const accessToken = await getValidAccessToken(connection);
  const creatorFolderId = await findOrCreateFolder(accessToken, creatorName, connection.root_folder_id);
  const weekFolderId = await findOrCreateFolder(accessToken, `Week of ${weekStartDate}`, creatorFolderId);
  return `https://drive.google.com/drive/folders/${weekFolderId}`;
}
