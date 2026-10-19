import { createAdminClient } from "@/lib/supabase/admin";
import { FIELD_GROUPS, LIST_SECTIONS, fieldSectionKey, newListItemKey } from "@/lib/onboarding/model-info-template";
import type { ModelInfoAnswers } from "@/lib/onboarding/state";

// Sends a creator's onboarding model info answers to the Chatter Portal's
// Model Information page. Uses the same shared secret as video calls
// (VIDEO_CALL_API_SECRET, set in both Vercel projects). The Chatter Portal
// only fills fields that are still empty there, so nothing a manager has
// already written gets overwritten. Never throws; records the outcome.

const DEFAULT_CHATTER_PORTAL_URL = "https://chatter-portal.vercel.app";

export async function syncModelInfoToChatterPortal(creatorId: string): Promise<{ ok: boolean; error: string | null }> {
  const admin = createAdminClient();
  const record = async (error: string | null) => {
    await admin
      .from("creator_model_info")
      .update(error ? { chatter_portal_sync_error: error } : { chatter_portal_synced_at: new Date().toISOString(), chatter_portal_sync_error: null })
      .eq("creator_id", creatorId);
    return { ok: !error, error };
  };

  try {
    const secret = process.env.VIDEO_CALL_API_SECRET;
    if (!secret) return record("VIDEO_CALL_API_SECRET isn't set, so the Chatter Portal can't be reached.");

    const [{ data: info }, { data: link }] = await Promise.all([
      admin.from("creator_model_info").select("answers").eq("creator_id", creatorId).maybeSingle(),
      admin.from("chatter_portal_creator_links").select("chatter_portal_creator_id").eq("creator_id", creatorId).maybeSingle(),
    ]);
    if (!info) return { ok: false, error: "No model info has been submitted yet." };
    if (!link) {
      return record(
        "This creator isn't linked to a Chatter Portal creator yet. Link them on the Chatter Portal's Video Calls page, then press Send again."
      );
    }

    const answers = info.answers as ModelInfoAnswers;
    const entries: { sectionKey: string; label: string; content: string }[] = [];
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const content = answers.fields?.[fieldSectionKey(group.groupKey, field.key)]?.trim();
        if (content) entries.push({ sectionKey: fieldSectionKey(group.groupKey, field.key), label: field.label, content });
      }
    }
    for (const list of LIST_SECTIONS) {
      for (const item of answers.lists?.[list.listKey] ?? []) {
        if (item.content?.trim()) {
          entries.push({ sectionKey: newListItemKey(list.listKey), label: item.title?.trim() ?? "", content: item.content.trim() });
        }
      }
    }

    const base = (process.env.CHATTER_PORTAL_URL || DEFAULT_CHATTER_PORTAL_URL).replace(/\/+$/, "");
    const res = await fetch(`${base}/api/integrations/model-info`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ chatterPortalCreatorId: link.chatter_portal_creator_id, entries }),
      cache: "no-store",
      redirect: "manual",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return record(body?.error ?? `The Chatter Portal returned an error (${res.status}).`);
    return record(null);
  } catch (err) {
    console.error("Model info sync failed:", err);
    return record(err instanceof Error ? err.message : "Couldn't reach the Chatter Portal.");
  }
}

// ---------------------------------------------------------------------------
// My Info: the creator viewing and editing her own model info any time.

async function chatterPortalRequest(path: string, init: { method?: string; body?: unknown } = {}) {
  const secret = process.env.VIDEO_CALL_API_SECRET;
  if (!secret) throw new Error("VIDEO_CALL_API_SECRET isn't set, so the Chatter Portal can't be reached.");
  const base = (process.env.CHATTER_PORTAL_URL || DEFAULT_CHATTER_PORTAL_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    redirect: "manual",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `The Chatter Portal returned an error (${res.status}).`);
  return body;
}

async function getChatterPortalCreatorId(creatorId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("chatter_portal_creator_links")
    .select("chatter_portal_creator_id")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return (data?.chatter_portal_creator_id as string | undefined) ?? null;
}

const LIST_KEYS = new Set<string>(LIST_SECTIONS.map((l) => l.listKey));
const FIELD_KEYS = new Set<string>(FIELD_GROUPS.flatMap((g) => g.fields.map((f) => fieldSectionKey(g.groupKey, f.key))));

function rowsToAnswers(rows: { section_key: string; label: string | null; content: string | null }[]): ModelInfoAnswers {
  const answers: ModelInfoAnswers = { fields: {}, lists: {} };
  for (const row of [...rows].sort((a, b) => a.section_key.localeCompare(b.section_key))) {
    const content = (row.content ?? "").trim();
    if (!content) continue;
    if (FIELD_KEYS.has(row.section_key)) {
      answers.fields[row.section_key] = content;
      continue;
    }
    const prefix = row.section_key.split("__")[0];
    if (LIST_KEYS.has(prefix)) {
      (answers.lists[prefix] ??= []).push({ title: row.label ?? "", content, key: row.section_key });
    }
    // Anything else (e.g. a manager's extra-info notes) isn't shown to the creator.
  }
  return answers;
}

// The creator's current answers: live from the Chatter Portal when she's
// linked there (so she sees anything the team has filled in), otherwise
// the copy saved here during onboarding.
export async function loadMyModelInfo(creatorId: string): Promise<{
  answers: ModelInfoAnswers;
  linked: boolean;
  loadError: string | null;
}> {
  const admin = createAdminClient();
  const local = async () => {
    const { data } = await admin.from("creator_model_info").select("answers").eq("creator_id", creatorId).maybeSingle();
    return (data?.answers as ModelInfoAnswers | undefined) ?? { fields: {}, lists: {} };
  };
  const chatterId = await getChatterPortalCreatorId(creatorId);
  if (!chatterId) return { answers: await local(), linked: false, loadError: null };
  try {
    const body = await chatterPortalRequest(`/api/integrations/model-info?chatterPortalCreatorId=${encodeURIComponent(chatterId)}`);
    return { answers: rowsToAnswers(body.rows ?? []), linked: true, loadError: null };
  } catch (err) {
    console.error("Couldn't load model info from the Chatter Portal:", err);
    return {
      answers: await local(),
      linked: true,
      loadError: "Couldn't load your latest answers from the chat team's system, so you're seeing the last copy saved here.",
    };
  }
}

// Saves the creator's edited answers here and, when linked, applies just
// the differences to the Chatter Portal (changed fields overwritten, cleared
// fields and removed list items deleted). Managers' extra notes there are
// never touched, because they're not part of what the creator edits.
export async function saveMyModelInfoEverywhere(creatorId: string, answers: ModelInfoAnswers): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const chatterId = await getChatterPortalCreatorId(creatorId);

  let remote: ModelInfoAnswers | null = null;
  if (chatterId) {
    try {
      const body = await chatterPortalRequest(`/api/integrations/model-info?chatterPortalCreatorId=${encodeURIComponent(chatterId)}`);
      remote = rowsToAnswers(body.rows ?? []);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Couldn't reach the Chatter Portal." };
    }
  }

  // Give new list items their keys now, so the local copy and the Chatter
  // Portal agree on which item is which next time.
  const remoteListKeys = new Set(Object.values(remote?.lists ?? {}).flat().map((i) => i.key).filter(Boolean) as string[]);
  const withKeys: ModelInfoAnswers = { fields: answers.fields, lists: {} };
  for (const [listKey, items] of Object.entries(answers.lists)) {
    withKeys.lists[listKey] = items.map((i) => ({
      ...i,
      key: i.key && i.key.startsWith(`${listKey}__`) && (!remote || remoteListKeys.has(i.key)) ? i.key : newListItemKey(listKey),
    }));
  }

  if (chatterId && remote) {
    const set: { sectionKey: string; label: string; content: string }[] = [];
    const remove: string[] = [];
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const key = fieldSectionKey(group.groupKey, field.key);
        const next = (withKeys.fields[key] ?? "").trim();
        const prev = (remote.fields[key] ?? "").trim();
        if (next && next !== prev) set.push({ sectionKey: key, label: field.label, content: next });
        if (!next && prev) remove.push(key);
      }
    }
    const keptKeys = new Set<string>();
    for (const items of Object.values(withKeys.lists)) {
      for (const item of items) {
        keptKeys.add(item.key!);
        set.push({ sectionKey: item.key!, label: item.title, content: item.content });
      }
    }
    for (const key of remoteListKeys) if (!keptKeys.has(key)) remove.push(key);

    try {
      await chatterPortalRequest("/api/integrations/model-info", {
        method: "PUT",
        body: { chatterPortalCreatorId: chatterId, set, remove },
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Couldn't save to the Chatter Portal." };
    }
  }

  const { error } = await admin.from("creator_model_info").upsert({
    creator_id: creatorId,
    answers: withKeys,
    submitted_at: new Date().toISOString(),
    chatter_portal_synced_at: chatterId ? new Date().toISOString() : null,
    chatter_portal_sync_error: chatterId ? null : "Not linked to a Chatter Portal creator yet.",
  });
  if (error) return { error: error.message };
  return { error: null };
}
