import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateUK } from "@/lib/format";
import MetaAccessWizard from "@/components/meta-access/MetaAccessWizard";

export const dynamic = "force-dynamic";

// Creators give LB Collective partner access to their Instagram / Facebook.
export default async function MetaAccessPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const admin = createAdminClient();
  const [{ data: settings }, { data: access }] = await Promise.all([
    admin.from("onboarding_settings").select("meta_business_id").eq("id", 1).maybeSingle(),
    admin.from("creator_meta_access").select("*").eq("creator_id", profile.creator_id).maybeSingle(),
  ]);
  const businessId = (settings?.meta_business_id as string | null) ?? "";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Instagram Access</h1>
        <p className="mt-1 text-sm text-muted">
          Give LB Collective access to your Instagram (and Facebook) through Meta Business Suite, so we can help manage
          your content. You never share your password, you stay the owner, and you can remove our access at any time.
        </p>
      </div>

      {access?.status === "confirmed" ? (
        <section className="rounded-lg border border-success/30 bg-success/10 p-5 text-sm">
          <p className="font-semibold text-success">✓ Access received</p>
          <p className="mt-1 text-muted">
            We have access{access.instagram_handle ? ` to @${access.instagram_handle}` : ""} since{" "}
            {formatDateUK(access.confirmed_at)}. Nothing more to do.
          </p>
        </section>
      ) : !businessId ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          This isn&apos;t ready yet. Your manager will let you know when to do it.
        </p>
      ) : (
        <>
          {access?.status === "submitted" && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
              Thanks, you told us you&apos;d done this on {formatDateUK(access.submitted_at)}. We&apos;re checking it has
              come through. You only need to go through the steps again if we ask you to.
            </p>
          )}
          {access?.status === "help" && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              We&apos;ve been told you need help with this, and your manager will be in touch. You can also try again
              below.
            </p>
          )}
          <MetaAccessWizard businessId={businessId} initialHandle={(access?.instagram_handle as string | null) ?? ""} />
        </>
      )}
    </div>
  );
}
