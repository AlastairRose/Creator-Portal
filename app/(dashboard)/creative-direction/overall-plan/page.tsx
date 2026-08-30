import { getCreators, getCreatorPlan, getCreatorSocialAccounts, getCreatorDriveLinks } from "@/lib/queries";
import OverallPlanCard from "@/components/creative-direction/OverallPlanCard";
import AccountsSection from "@/components/creative-direction/AccountsSection";

export default async function OverallPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ creatorId?: string }>;
}) {
  const params = await searchParams;
  const allCreators = await getCreators();
  const creator = allCreators.find((c) => c.id === params.creatorId) ?? allCreators[0] ?? null;

  if (!creator) {
    return <p className="text-sm text-muted">Add a creator first.</p>;
  }

  const [plan, socialAccounts, driveLinks] = await Promise.all([
    getCreatorPlan(creator.id),
    getCreatorSocialAccounts(creator.id),
    getCreatorDriveLinks(creator.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <OverallPlanCard key={creator.id} creator={creator} plan={plan} driveLinks={driveLinks} />
      <AccountsSection creatorId={creator.id} accounts={socialAccounts} />
    </div>
  );
}
