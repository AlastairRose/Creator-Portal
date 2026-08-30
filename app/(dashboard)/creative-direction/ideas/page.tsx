import { getCreators, getIdeas } from "@/lib/queries";
import IdeaBoard from "@/components/creative-direction/IdeaBoard";

export default async function IdeasPage() {
  const [ideas, creators] = await Promise.all([getIdeas(), getCreators()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ideas</h1>
        <p className="mt-1 text-sm text-muted">
          Original ideas — your own, or submitted by a creator — tagged by vertical and which
          creators might suit them. Push one straight into a creator&apos;s week when ready.
        </p>
      </div>

      <IdeaBoard ideas={ideas} creators={creators} />
    </div>
  );
}
