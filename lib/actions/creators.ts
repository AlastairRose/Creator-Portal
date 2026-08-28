"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";

export type CreatorFields = {
  name: string;
  ig_handle: string | null;
  notes: string | null;
  baseline_seed: number | null;
  track_from_date: string;
};

// Writes to the same `creators` table Outlier Engine owns (shared Supabase
// project) — mirrors its own createCreator exactly (same fields/defaults),
// so a creator added here shows up there too and vice versa. baseline_seed
// and track_from_date only matter to Outlier Engine's own outlier-detection
// logic; Creator Portal doesn't otherwise use them, but a new creator
// should still get sensible values for when someone opens Outlier Engine.
export async function createCreator(fields: CreatorFields) {
  await requireStaff();
  if (!fields.name.trim()) throw new Error("Name can't be empty.");

  const supabase = await createClient();
  const { error } = await supabase.from("creators").insert({
    name: fields.name.trim(),
    ig_handle: fields.ig_handle?.trim() || null,
    notes: fields.notes?.trim() || null,
    baseline_seed: fields.baseline_seed,
    track_from_date: fields.track_from_date || new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/creators");
  revalidatePath("/");
}
