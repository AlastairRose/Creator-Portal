import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES, type Profile } from "@/lib/types";

// Cached per-request so the dashboard layout and every nested page share one
// DB round trip instead of each fetching the signed-in user's profile again.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data as Profile | null;
});

// UX-level convenience only — redirects away from a page a role shouldn't
// see. The actual security boundary is Postgres RLS, not this check.
export async function requireStaff(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/");
  }
  return profile;
}

export async function requireOwner(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    redirect("/");
  }
  return profile;
}

export async function requireCreator(): Promise<Profile & { creator_id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) {
    redirect("/");
  }
  return profile as Profile & { creator_id: string };
}

export function isStaffRole(role: Profile["role"]): boolean {
  return (STAFF_ROLES as string[]).includes(role);
}
