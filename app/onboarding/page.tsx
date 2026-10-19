import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboardingState } from "@/lib/onboarding/state";
import { toEmbedUrl } from "@/lib/onboarding/video";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Welcome – Creator Portal" };

// Outside the (dashboard) group on purpose: the dashboard layout sends new
// creators here until the required steps are done, so this page must not
// sit behind that same check.
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const state = await getOnboardingState(profile.creator_id);
  if (state.exempt || state.allDone) redirect("/");

  const admin = createAdminClient();
  const [{ data: settings }, { data: creator }] = await Promise.all([
    admin.from("onboarding_settings").select("agreement_title, agreement_body, agreement_version, welcome_video_url").eq("id", 1).maybeSingle(),
    admin.from("creators").select("name").eq("id", profile.creator_id).maybeSingle(),
  ]);

  const { step } = await searchParams;
  const requested = Number(step);
  const maxOpen = !state.done.agreement ? 1 : !state.done.details ? 2 : 5;
  const initialStep = requested >= 1 && requested <= maxOpen ? requested : (state.nextStep ?? 1);

  return (
    <OnboardingWizard
      creatorId={profile.creator_id}
      creatorName={creator?.name ?? profile.display_name}
      initialStep={initialStep}
      done={state.done}
      agreement={{
        title: settings?.agreement_title ?? "Creator Agreement",
        body: settings?.agreement_body ?? "",
        version: settings?.agreement_version ?? 1,
      }}
      videoEmbedUrl={toEmbedUrl(settings?.welcome_video_url)}
      defaultEmail={profile.email}
    />
  );
}
