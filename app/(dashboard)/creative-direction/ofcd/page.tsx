import { getCreators, getOfcdIdeas } from "@/lib/queries";
import OfcdIdeaBoard from "@/components/creative-direction/OfcdIdeaBoard";

export default async function OfcdPage() {
  const [ideas, creators] = await Promise.all([getOfcdIdeas(), getCreators()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">OFCD</h1>
        <p className="mt-1 text-sm text-muted">
          A bank of OnlyFans content ideas — Sexting, PPV, and the rest, same as the request form.
          Save one here or straight from a creator&apos;s OnlyFans Content list, then add it to any
          creator&apos;s plan when you&apos;re ready.
        </p>
      </div>

      <OfcdIdeaBoard ideas={ideas} creators={creators} />
    </div>
  );
}
