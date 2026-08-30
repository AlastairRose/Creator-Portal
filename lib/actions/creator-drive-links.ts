"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";

export async function updateOnlyfansDriveLink(creatorId: string, driveLink: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("creator_drive_links")
    .upsert({ creator_id: creatorId, onlyfans_drive_link: driveLink.trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function updateCustomsDriveLink(creatorId: string, driveLink: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("creator_drive_links")
    .upsert({ creator_id: creatorId, customs_drive_link: driveLink.trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

// Where auto-created weekly Drive folders go when this creator's week is
// published. Leave blank to fall back to the default "Creator Portal /
// {creator name}" folder.
export async function updateWeeklyRootDriveLink(creatorId: string, driveLink: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("creator_drive_links")
    .upsert({ creator_id: creatorId, weekly_root_drive_link: driveLink.trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/overall-plan");
}
