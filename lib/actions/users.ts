"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/roles";
import type { Role } from "@/lib/types";

export type UserFormState = { error: string | null };

// Owner-only: creates the Supabase Auth user directly with a temporary
// password (no self-serve signup or email invite flow exists yet — the
// owner shares the temporary password with the person out of band, same
// "manual, no extra infra" spirit as Outlier Engine's allowlist approach).
export async function inviteUser(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireOwner();

  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const creatorId = String(formData.get("creator_id") ?? "").trim() || null;
  const tempPassword = String(formData.get("temp_password") ?? "");

  if (!email || !displayName || !role || !tempPassword) {
    return { error: "Fill in every field." };
  }
  if (tempPassword.length < 8) {
    return { error: "Temporary password must be at least 8 characters." };
  }
  if (role === "creator" && !creatorId) {
    return { error: "Pick which creator this login belongs to." };
  }
  if (role !== "creator" && creatorId) {
    return { error: "Only creator-role accounts should be linked to a creator." };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Could not create the account." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    display_name: displayName,
    role,
    creator_id: creatorId,
  });
  if (profileError) {
    // Roll back the orphaned auth user so a failed invite doesn't leave a
    // login with no profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export async function updateUserRole(profileId: string, role: Role, creatorId: string | null) {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, creator_id: role === "creator" ? creatorId : null })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function removeUser(profileId: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
