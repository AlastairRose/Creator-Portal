import { getCreators, getWinningReels } from "@/lib/queries";
import Winning30Board from "@/components/creative-direction/Winning30Board";

export default async function Winning30Page({
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

  const reels = await getWinningReels(creator.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Winning 30</h1>
        <p className="mt-1 text-sm text-muted">
          Previous winning reels worth reposting for {creator.name}, oldest last posted at the top.
        </p>
      </div>

      <Winning30Board key={creator.id} creatorId={creator.id} reels={reels} />
    </div>
  );
}
