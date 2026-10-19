import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import { loadSignedAgreement } from "@/lib/onboarding/agreement-view";
import AgreementDocument from "@/components/onboarding/AgreementDocument";

export const metadata = { title: "Signed agreement – Creator Portal" };

// Management's printable copy of a creator's signed agreement.
export default async function CreatorAgreementPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { creatorId } = await params;
  const allowed =
    profile.role === "owner" ||
    profile.role === "creative_director" ||
    (profile.role === "creator" && profile.creator_id === creatorId);
  if (!allowed) redirect("/");

  const data = await loadSignedAgreement(creatorId);
  if (!data) notFound();
  const backHref = profile.role === "creator" ? "/" : `/admin/creators/${creatorId}/onboarding`;
  return <AgreementDocument {...data} backHref={backHref} />;
}
