import { requireOwner } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEncryptionConfigured } from "@/lib/onboarding/crypto";
import OnboardingSettingsForm from "@/components/admin/OnboardingSettingsForm";

export default async function OnboardingSettingsPage() {
  await requireOwner();
  const admin = createAdminClient();
  const { data } = await admin
    .from("onboarding_settings")
    .select("agreement_title, agreement_body, agreement_version, welcome_video_url, meta_business_id")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted">
          New creators go through these steps the first time they sign in: sign the agreement, give their details and ID,
          answer the model info questions, turn on notifications, then watch the welcome video. The first two are required
          before they can use the portal. Each creator&apos;s progress is on the Creators page.
        </p>
      </div>
      {!isEncryptionConfigured() && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          ONBOARDING_ENCRYPTION_KEY isn&apos;t set in Vercel, so creators can&apos;t save their account logins yet.
        </div>
      )}
      <OnboardingSettingsForm
        initial={{
          agreementTitle: data?.agreement_title ?? "Creator Agreement",
          agreementBody: data?.agreement_body ?? "",
          agreementVersion: data?.agreement_version ?? 1,
          welcomeVideoUrl: data?.welcome_video_url ?? "",
          metaBusinessId: data?.meta_business_id ?? "",
        }}
      />
    </div>
  );
}
