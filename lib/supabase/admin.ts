import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. Server-only — never import this from a client component.
// Used to create invited users (creators/staff) and their profile row, since
// the inviting owner isn't the new user's own auth id.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
