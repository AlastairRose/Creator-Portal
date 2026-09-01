"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { runCulturalEventsSearch, runHolidaysSeed } from "@/lib/cultural-events-search";
import type { CulturalEventStatus } from "@/lib/types";

export type CulturalEventFields = {
  title: string;
  event_date: string;
  event_end_date: string | null;
  category: string | null;
  regions: string[];
  description: string | null;
};

function normalizeFields(fields: CulturalEventFields) {
  if (!fields.title.trim()) throw new Error("Give the event a title.");
  if (!fields.event_date) throw new Error("Pick a date.");
  return {
    title: fields.title.trim(),
    event_date: fields.event_date,
    event_end_date: fields.event_end_date || null,
    category: fields.category?.trim() || null,
    regions: fields.regions,
    description: fields.description?.trim() || null,
  };
}

// Manual entries are trusted immediately — only AI-found ones need review.
export async function createCulturalEvent(fields: CulturalEventFields) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("cultural_events").insert({
    added_by: profile.id,
    status: "confirmed",
    source: "manual",
    ...normalizeFields(fields),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ant-ena");
}

export async function updateCulturalEvent(id: string, fields: CulturalEventFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("cultural_events").update(normalizeFields(fields)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ant-ena");
}

export async function setCulturalEventStatus(id: string, status: CulturalEventStatus) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("cultural_events").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ant-ena");
}

export async function deleteCulturalEvent(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("cultural_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ant-ena");
}

// The "Search now" button — same underlying search the weekly cron job
// runs, just triggered on demand.
export async function searchForNewEventsAction(): Promise<number> {
  await requireStaff();
  const supabase = await createClient();
  const count = await runCulturalEventsSearch(supabase);
  revalidatePath("/creative-direction/ant-ena");
  return count;
}

// The "Prefill holidays" button — recurring annual holidays/touchpoints,
// landing straight as "confirmed" rather than "suggested" since these are
// well-established facts, not speculative news. Safe to re-run any time
// (e.g. once a year for the next 12 months) — it skips anything whose title
// already exists.
export async function seedHolidaysAction(): Promise<number> {
  await requireStaff();
  const supabase = await createClient();
  const count = await runHolidaysSeed(supabase);
  revalidatePath("/creative-direction/ant-ena");
  return count;
}
