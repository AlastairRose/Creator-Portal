import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import { loadSignedAgreement } from "@/lib/onboarding/agreement-view";
import AgreementDocument from "@/components/onboarding/AgreementDocument";

export const metadata = { title: "My agreement – Creator Portal" };

// A creator's own signed agreement. Outside the dashboard layout so it
// prints as a clean document.
export default async function MyAgreementPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const data = await loadSignedAgreement(profile.creator_id);
  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-sm text-muted">
        You haven&apos;t signed an agreement yet. <a href="/onboarding" className="text-accent hover:underline">Go to onboarding</a>
      </main>
    );
  }
  return <AgreementDocument {...data} backHref="/" />;
}
