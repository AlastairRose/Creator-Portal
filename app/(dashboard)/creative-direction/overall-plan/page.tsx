import { getCreators, getCreatorPlan } from "@/lib/queries";
import OverallPlanCard from "@/components/creative-direction/OverallPlanCard";

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

  const plan = await getCreatorPlan(creator.id);

  return <OverallPlanCard creator={creator} plan={plan} />;
}
