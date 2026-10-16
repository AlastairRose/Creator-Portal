import type { SupabaseClient } from "@supabase/supabase-js";
import { extractFolderId, listFilesInFolderTree, type DriveFile } from "@/lib/google-drive";
import { escapeHtml, sendEmail } from "@/lib/email";
import { STAFF_ROLES } from "@/lib/types";

// How far back to keep watching weekly reel folders. Footage for a week
// usually lands during that week or just after it.
const REEL_WEEKS_LOOKBACK_DAYS = 21;
const MAX_FILE_NAMES_PER_FOLDER = 10;

type WatchedFolder = {
  folderId: string;
  folderUrl: string;
  creatorName: string;
  label: string;
  // The general folder holds every weekly folder, so only look one level in
  // (loose files, plus anything inside a folder uploaded straight into it).
  maxDepth?: number;
};

type FolderUpdate = WatchedFolder & { newFiles: DriveFile[] };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://creator-portal-tan.vercel.app";

// Run on a schedule. Emails all staff one digest listing any new files in
// creators' upload folders since the last run. The first time a folder is
// seen, its existing files are recorded silently instead of emailed.
export async function checkDriveUploads(admin: SupabaseClient) {
  const folders = await getWatchedFolders(admin);
  if (folders.length === 0) return { folders: 0, newFiles: 0, emailed: false };

  const folderIds = folders.map((f) => f.folderId);
  const [{ data: watchedRows, error: watchedError }, { data: seenRows, error: seenError }] = await Promise.all([
    admin.from("drive_watched_folders").select("folder_id").in("folder_id", folderIds),
    admin.from("drive_seen_files").select("file_id").in("folder_id", folderIds),
  ]);
  if (watchedError) throw new Error(watchedError.message);
  if (seenError) throw new Error(seenError.message);
  const alreadyWatched = new Set((watchedRows ?? []).map((r) => r.folder_id as string));
  const seen = new Set((seenRows ?? []).map((r) => r.file_id as string));

  const updates: FolderUpdate[] = [];
  const toRecord: { file_id: string; folder_id: string }[] = [];
  const newlyWatched: string[] = [];

  for (const folder of folders) {
    let files: DriveFile[] | null;
    try {
      files = await listFilesInFolderTree(folder.folderId, folder.maxDepth);
    } catch (err) {
      console.error(`Couldn't check Drive folder for ${folder.creatorName} (${folder.label}):`, err);
      continue;
    }
    if (files === null) continue; // folder deleted or not shared with the connected account

    const unseen = files.filter((f) => !seen.has(f.id));
    unseen.forEach((f) => {
      seen.add(f.id); // the same folder can be linked twice; record each file once
      toRecord.push({ file_id: f.id, folder_id: folder.folderId });
    });

    if (!alreadyWatched.has(folder.folderId)) {
      newlyWatched.push(folder.folderId);
      alreadyWatched.add(folder.folderId);
    } else if (unseen.length > 0) {
      updates.push({ ...folder, newFiles: unseen });
    }
  }

  let emailed = false;
  if (updates.length > 0) {
    const recipients = await getStaffEmails(admin);
    if (recipients.length > 0) {
      // Email first, record second: if sending fails, the next run tries again
      // rather than silently dropping the notification.
      await sendEmail({ to: recipients, ...buildEmail(updates) });
      emailed = true;
    }
  }

  if (newlyWatched.length > 0) {
    const { error } = await admin
      .from("drive_watched_folders")
      .upsert(newlyWatched.map((folder_id) => ({ folder_id })), { onConflict: "folder_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < toRecord.length; i += 500) {
    const { error } = await admin
      .from("drive_seen_files")
      .upsert(toRecord.slice(i, i + 500), { onConflict: "file_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return {
    folders: folders.length,
    newFiles: updates.reduce((n, u) => n + u.newFiles.length, 0),
    emailed,
  };
}

async function getWatchedFolders(admin: SupabaseClient): Promise<WatchedFolder[]> {
  const since = new Date(Date.now() - REEL_WEEKS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: creators, error: creatorsError }, { data: weeks, error: weeksError }, { data: links, error: linksError }] =
    await Promise.all([
      admin.from("creators").select("id, name, archived"),
      admin
        .from("content_weeks")
        .select("creator_id, week_start_date, drive_link")
        .eq("status", "published")
        .gte("week_start_date", since)
        .not("drive_link", "is", null),
      admin.from("creator_drive_links").select("creator_id, onlyfans_drive_link, customs_drive_link, weekly_root_drive_link"),
    ]);
  if (creatorsError) throw new Error(creatorsError.message);
  if (weeksError) throw new Error(weeksError.message);
  if (linksError) throw new Error(linksError.message);

  const activeCreators = new Map(
    (creators ?? []).filter((c) => !c.archived).map((c) => [c.id as string, c.name as string])
  );

  const folders: WatchedFolder[] = [];
  const add = (creatorId: string, link: string | null, label: string, maxDepth?: number) => {
    const creatorName = activeCreators.get(creatorId);
    if (!creatorName || !link) return;
    const folderId = extractFolderId(link);
    if (!folderId) return;
    folders.push({ folderId, folderUrl: link, creatorName, label, maxDepth });
  };

  for (const w of weeks ?? []) add(w.creator_id, w.drive_link, `Reels — week of ${formatWeek(w.week_start_date)}`);
  for (const l of links ?? []) {
    add(l.creator_id, l.onlyfans_drive_link, "OnlyFans content");
    add(l.creator_id, l.customs_drive_link, "Customs");
  }
  // Last, so a file inside a weekly folder is reported under its week, not here.
  for (const l of links ?? []) add(l.creator_id, l.weekly_root_drive_link, "General reels folder", 1);
  return folders;
}

async function getStaffEmails(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("profiles").select("email").in("role", STAFF_ROLES);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((p) => (p.email as string | null)?.trim()).filter((e): e is string => !!e))];
}

function formatWeek(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function buildEmail(updates: FolderUpdate[]): { subject: string; html: string } {
  const total = updates.reduce((n, u) => n + u.newFiles.length, 0);
  const creatorNames = [...new Set(updates.map((u) => u.creatorName))];
  const subject =
    creatorNames.length === 1
      ? `${creatorNames[0]} uploaded ${total} new file${total === 1 ? "" : "s"}`
      : `${total} new files uploaded by ${creatorNames.join(", ")}`;

  const sections = updates
    .map((u) => {
      const uploaders = [...new Set(u.newFiles.map((f) => f.uploadedBy).filter((n): n is string => !!n))];
      const names = u.newFiles
        .slice(0, MAX_FILE_NAMES_PER_FOLDER)
        .map((f) => `<li>${escapeHtml(f.name)}</li>`)
        .join("");
      const more =
        u.newFiles.length > MAX_FILE_NAMES_PER_FOLDER
          ? `<li style="color:#666">and ${u.newFiles.length - MAX_FILE_NAMES_PER_FOLDER} more</li>`
          : "";
      return `
        <div style="margin:0 0 20px">
          <p style="margin:0 0 4px;font-weight:600">${escapeHtml(u.creatorName)} · ${escapeHtml(u.label)}</p>
          <p style="margin:0 0 6px;color:#555">${u.newFiles.length} new file${u.newFiles.length === 1 ? "" : "s"}${
            uploaders.length ? ` from ${escapeHtml(uploaders.join(", "))}` : ""
          }</p>
          <ul style="margin:0 0 8px;padding-left:18px">${names}${more}</ul>
          <a href="${escapeHtml(u.folderUrl)}" style="color:#6d5dfc">Open folder in Google Drive</a>
        </div>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">
      <p style="margin:0 0 16px">New content has been uploaded to Google Drive.</p>
      ${sections}
      <p style="margin:24px 0 0;color:#888;font-size:12px">
        Sent by <a href="${APP_URL}" style="color:#888">Creator Portal</a> to all staff.
      </p>
    </div>`;

  return { subject, html };
}
