"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { SocialAccountManagedBy, SocialPlatform } from "@/lib/types";

export type SocialAccountFields = {
  is_active: boolean;
  managed_by: SocialAccountManagedBy | null;
  profile_url: string | null;
};

export async function upsertCreatorSocialAccount(
  creatorId: string,
  platform: SocialPlatform,
  fields: SocialAccountFields
) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("creator_social_accounts").upsert(
    {
      creator_id: creatorId,
      platform,
      is_active: fields.is_active,
      managed_by: fields.managed_by,
      profile_url: fields.profile_url?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id,platform" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/overall-plan");
}
