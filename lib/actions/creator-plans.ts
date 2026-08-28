"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";

export type CreatorPlanFields = {
  agreed_reels_per_week: number | null;
  niche_branding: string | null;
  verticals_agreed: string[];
};

export async function upsertCreatorPlan(creatorId: string, fields: CreatorPlanFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("creator_plans").upsert({
    creator_id: creatorId,
    agreed_reels_per_week: fields.agreed_reels_per_week,
    niche_branding: fields.niche_branding?.trim() || null,
    verticals_agreed: fields.verticals_agreed.map((v) => v.trim()).filter(Boolean),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/overall-plan");
  revalidatePath("/creative-direction");
}
