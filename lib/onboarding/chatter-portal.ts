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
