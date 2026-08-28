import { getCreators, getRdIdeas } from "@/lib/queries";
import RdIdeaBoard from "@/components/creative-direction/RdIdeaBoard";

export default async function RdPage() {
  const [ideas, creators] = await Promise.all([getRdIdeas(), getCreators()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">R&D</h1>
        <p className="mt-1 text-sm text-muted">
          Save ideas found online — tag them by vertical and which creators might suit them, then
          push one straight into a creator&apos;s week when you&apos;re ready to use it.
        </p>
      </div>

      <RdIdeaBoard ideas={ideas} creators={creators} />
    </div>
  );
}
